import { NextRequest } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import type { Sale, SaleItem } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

interface SalePayment {
  id: string;
  sale_id: string;
  payment_method: 'cash' | 'mpesa' | 'credit';
  amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: number;
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: saleId } = await params;

    const sale = await queryOne<
      Sale & { business_name: string; user_name: string | null }
    >(
      `SELECT 
        s.*,
        b.name as business_name,
        u.name as user_name
       FROM sales s
       JOIN businesses b ON s.business_id = b.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.business_id = ?`,
      [saleId, auth.businessId]
    );

    if (!sale) {
      return jsonResponse(
        { success: false, message: 'Sale not found' },
        404
      );
    }

    const saleItems = await query<
      SaleItem & {
        item_name: string;
        item_unit_type: string;
        batch_number: string | null;
      }
    >(
      `SELECT 
        si.*,
        i.name as item_name,
        i.unit_type as item_unit_type,
        ib.batch_number
       FROM sale_items si
       JOIN items i ON si.item_id = i.id
       LEFT JOIN inventory_batches ib ON si.inventory_batch_id = ib.id
       WHERE si.sale_id = ?
       ORDER BY si.created_at ASC`,
      [saleId]
    );

    // Fetch split payments if payment method is 'split'
    let splitPayments: SalePayment[] = [];
    if (sale.payment_method === 'split') {
      splitPayments = await query<SalePayment>(
        `SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY created_at ASC`,
        [saleId]
      );
    }

    return jsonResponse({
      success: true,
      data: {
        sale,
        items: saleItems,
        splitPayments: splitPayments.length > 0 ? splitPayments : undefined,
      },
    });
  } catch (error) {
    console.error('Error fetching sale:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch sale',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * PATCH /api/sales/[id] - Void a sale (admin/owner only)
 * Reverses stock, credit, and shift cash; marks sale as voided.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('view_all_sales');
    if (isAuthResponse(auth)) return auth;

    const { id: saleId } = await params;
    const body = await request.json().catch(() => ({}));
    const { action, reason } = body as { action?: string; reason?: string };

    if (action !== 'void') {
      return jsonResponse(
        { success: false, message: 'Invalid action. Use action: "void"' },
        400
      );
    }

    const sale = await queryOne<
      Sale & { shift_id: string | null; payment_method: string }
    >(
      `SELECT id, business_id, status, total_amount, payment_method, shift_id
       FROM sales WHERE id = ? AND business_id = ?`,
      [saleId, auth.businessId]
    );

    if (!sale) {
      return jsonResponse({ success: false, message: 'Sale not found' }, 404);
    }

    if (sale.status === 'voided') {
      return jsonResponse(
        { success: false, message: 'Sale is already voided' },
        400
      );
    }

    const saleItems = await query<
      SaleItem & { item_id: string; quantity_sold: number; inventory_batch_id: string | null }
    >(
      `SELECT item_id, quantity_sold, inventory_batch_id
       FROM sale_items WHERE sale_id = ?`,
      [saleId]
    );

    // 1. Restore item stock
    for (const item of saleItems) {
      await execute(
        `UPDATE items SET current_stock = current_stock + ?
         WHERE id = ? AND business_id = ?`,
        [item.quantity_sold, item.item_id, auth.businessId]
      );
      // Restore inventory batch if it was used
      if (item.inventory_batch_id) {
        await execute(
          `UPDATE inventory_batches
           SET quantity_remaining = quantity_remaining + ?,
               status = CASE WHEN status = 'depleted' THEN 'active' ELSE status END
           WHERE id = ?`,
          [item.quantity_sold, item.inventory_batch_id]
        );
      }
    }

    // 2. Reverse credit (debt from this sale)
    const creditDebts = await query<{ credit_account_id: string; amount: number }>(
      `SELECT credit_account_id, amount FROM credit_transactions
       WHERE sale_id = ? AND type = 'debt'`,
      [saleId]
    );
    for (const debt of creditDebts) {
      await execute(
        `UPDATE credit_accounts
         SET total_credit = total_credit - ?
         WHERE id = ? AND total_credit >= ?`,
        [debt.amount, debt.credit_account_id, debt.amount]
      );
    }

    // 3. Reverse shift expected_closing_cash for cash portion
    let cashAmount = 0;
    if (sale.payment_method === 'cash') {
      cashAmount = sale.total_amount;
    } else if (sale.payment_method === 'split') {
      const cashRow = await queryOne<{ amount: number }>(
        `SELECT amount FROM sale_payments WHERE sale_id = ? AND payment_method = 'cash'`,
        [saleId]
      );
      cashAmount = cashRow?.amount ?? 0;
    }
    if (sale.shift_id && cashAmount > 0) {
      await execute(
        `UPDATE shifts SET expected_closing_cash = expected_closing_cash - ?
         WHERE id = ? AND expected_closing_cash >= ?`,
        [cashAmount, sale.shift_id, cashAmount]
      );
    }

    // 4. Mark sale as voided
    const voidedReason = typeof reason === 'string' ? reason.trim() || null : null;
    await execute(
      `UPDATE sales SET status = 'voided', voided_reason = ?, voided_by = ?
       WHERE id = ? AND business_id = ?`,
      [voidedReason, auth.userId, saleId, auth.businessId]
    );

    return jsonResponse({
      success: true,
      message: 'Sale voided successfully',
      data: { saleId },
    });
  } catch (error) {
    console.error('Error voiding sale:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to void sale',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
