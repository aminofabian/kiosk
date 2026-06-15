import { NextRequest } from 'next/server';
import { query, queryOne, transaction } from '@/lib/db';
import { reverseLoyaltyForVoidedSale } from '@/lib/db/loyalty';
import type { Sale, SaleItem } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { hasPermission } from '@/lib/auth/permissions';
import { parseBusinessSettings } from '@/lib/utils/business-settings';
import { logActivityInTransaction } from '@/lib/db/activity-log';
import { resolveSaleId } from '@/lib/db/resolve-sale-id';
import { batchStatusWhenRestockedSql } from '@/lib/db/batch-lifecycle';

interface SalePayment {
  id: string;
  sale_id: string;
  payment_method: 'cash' | 'mpesa' | 'credit' | 'wallet';
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

    const canViewAll = hasPermission(auth.role, 'view_all_sales');

    const { id: rawSaleId } = await params;

    const resolved = await resolveSaleId(auth.businessId, rawSaleId, {
      userId: auth.userId,
      restrictToUser: !canViewAll,
    });

    if (!resolved.ok) {
      if (resolved.reason === 'ambiguous') {
        return jsonResponse(
          {
            success: false,
            message: 'Multiple sales match this reference. Enter more characters from the receipt.',
          },
          409
        );
      }
      return jsonResponse(
        { success: false, message: 'Sale not found' },
        404
      );
    }

    const saleId = resolved.saleId;

    const sale = await queryOne<
      Sale & { business_name: string; user_name: string | null; business_settings: string | null }
    >(
      `SELECT 
        s.*,
        b.name as business_name,
        b.settings as business_settings,
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
      Omit<SaleItem, 'buy_price_per_unit' | 'profit'> & {
        item_name: string;
        item_unit_type: string;
        batch_number: string | null;
      }
    >(
      `SELECT 
        si.id, si.sale_id, si.item_id, si.inventory_batch_id, si.quantity_sold,
        si.sell_price_per_unit,
        si.item_type_snapshot, si.created_at,
        ${canViewAll ? 'si.buy_price_per_unit, si.profit,' : ''}
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

    const salePayments = await query<SalePayment>(
      `SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY created_at ASC`,
      [saleId]
    );

    const splitPayments =
      salePayments.length > 0
        ? salePayments
        : sale.payment_method === 'split'
          ? []
          : undefined;

    const { business_settings: _settings, ...saleData } = sale;
    const receiptSettings = parseBusinessSettings(sale.business_settings).receipt;

    return jsonResponse({
      success: true,
      data: {
        sale: saleData,
        items: saleItems,
        splitPayments,
        receiptSettings,
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
 * PATCH /api/sales/[id] - Void a sale
 * Admins/owners with view_all_sales can void any sale.
 * Cashiers with void_own_sale can void their own sales only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const canVoidAll = hasPermission(auth.role, 'view_all_sales');
    const canVoidOwn = hasPermission(auth.role, 'void_own_sale');
    if (!canVoidAll && !canVoidOwn) {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const { id: saleId } = await params;
    const body = await request.json().catch(() => ({}));
    const { action, reason } = body as { action?: string; reason?: string };

    if (action !== 'void') {
      return jsonResponse(
        { success: false, message: 'Invalid action. Use action: "void"' },
        400
      );
    }

    const voidedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!voidedReason) {
      return jsonResponse(
        { success: false, message: 'A reason is required to void a sale' },
        400
      );
    }

    const sale = await queryOne<
      Sale & { shift_id: string | null; payment_method: string; user_id: string }
    >(
      `SELECT id, business_id, user_id, status, total_amount, payment_method, shift_id
       FROM sales WHERE id = ? AND business_id = ?`,
      [saleId, auth.businessId]
    );

    if (!sale) {
      return jsonResponse({ success: false, message: 'Sale not found' }, 404);
    }

    if (!canVoidAll && sale.user_id !== auth.userId) {
      return jsonResponse(
        { success: false, message: 'You can only void your own sales' },
        403
      );
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

    await transaction(async (tx) => {
      for (const item of saleItems) {
        await tx.execute(
          `UPDATE items SET current_stock = current_stock + ?
           WHERE id = ? AND business_id = ?`,
          [item.quantity_sold, item.item_id, auth.businessId]
        );
        if (item.inventory_batch_id) {
          await tx.execute(
            `UPDATE inventory_batches
             SET quantity_remaining = quantity_remaining + ?,
                 status = ${batchStatusWhenRestockedSql()}
             WHERE id = ?`,
            [item.quantity_sold, item.inventory_batch_id]
          );
        }
      }

      const creditDebts = await tx.query<{ credit_account_id: string; amount: number }>(
        `SELECT credit_account_id, amount FROM credit_transactions
         WHERE sale_id = ? AND type = 'debt'`,
        [saleId]
      );
      for (const debt of creditDebts) {
        await tx.execute(
          `UPDATE credit_accounts
           SET total_credit = total_credit - ?
           WHERE id = ? AND total_credit >= ?`,
          [debt.amount, debt.credit_account_id, debt.amount]
        );
      }

      const walletRows = await tx.query<{
        credit_account_id: string;
        type: string;
        amount: number;
      }>(
        `SELECT credit_account_id, type, amount FROM wallet_transactions WHERE sale_id = ?`,
        [saleId]
      );
      for (const w of walletRows) {
        if (w.type === 'debit') {
          await tx.execute(
            `UPDATE credit_accounts SET wallet_balance = wallet_balance + ? WHERE id = ?`,
            [w.amount, w.credit_account_id]
          );
        } else if (w.type === 'credit') {
          await tx.execute(
            `UPDATE credit_accounts SET wallet_balance = wallet_balance - ? WHERE id = ? AND wallet_balance + 0.00001 >= ?`,
            [w.amount, w.credit_account_id, w.amount]
          );
        }
      }
      if (walletRows.length > 0) {
        await tx.execute(`DELETE FROM wallet_transactions WHERE sale_id = ?`, [saleId]);
      }

      let cashAmount = 0;
      if (sale.payment_method === 'cash') {
        cashAmount = sale.total_amount;
      } else if (sale.payment_method === 'split') {
        const cashRow = await tx.queryOne<{ amount: number }>(
          `SELECT amount FROM sale_payments WHERE sale_id = ? AND payment_method = 'cash'`,
          [saleId]
        );
        cashAmount = cashRow?.amount ?? 0;
      }
      if (sale.shift_id && cashAmount > 0) {
        await tx.execute(
          `UPDATE shifts SET expected_closing_cash = expected_closing_cash - ?
           WHERE id = ? AND expected_closing_cash >= ?`,
          [cashAmount, sale.shift_id, cashAmount]
        );
      }

      await tx.execute(
        `UPDATE sales SET status = 'voided', voided_reason = ?, voided_by = ?
         WHERE id = ? AND business_id = ?`,
        [voidedReason, auth.userId, saleId, auth.businessId]
      );

      await logActivityInTransaction(tx, {
        businessId: auth.businessId,
        action: 'void',
        entityType: 'sale',
        entityId: saleId,
        entityNameSnapshot: `Sale ${saleId.slice(0, 8)}`,
        details: {
          reason: voidedReason,
          totalAmount: sale.total_amount,
          paymentMethod: sale.payment_method,
          itemCount: saleItems.length,
        },
        performedBy: auth.userId,
      });
    });

    await reverseLoyaltyForVoidedSale(saleId, auth.businessId);

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
