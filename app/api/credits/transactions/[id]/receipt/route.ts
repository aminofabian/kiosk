import { query, queryOne } from '@/lib/db';
import type { Sale, SaleItem } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { parseCreditDebtLineItemsJson } from '@/lib/db/credit-debt-line-snapshot';

interface SalePayment {
  id: string;
  sale_id: string;
  payment_method: 'cash' | 'mpesa' | 'credit' | 'wallet';
  amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: number;
}

function isDebtType(raw: string | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const n = raw.trim().toLowerCase();
  return n === 'debt' || n === 'credit' || n === 'tab' || n === 'owed';
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: transactionId } = await params;

    const tx = await queryOne<{
      id: string;
      credit_account_id: string;
      sale_id: string | null;
      type: string;
      amount: number;
      recorded_by: string;
      created_at: number;
      debt_line_items_json: string | null;
      customer_name: string;
      business_id: string;
      business_name: string;
      user_name: string | null;
    }>(
      `SELECT ct.id, ct.credit_account_id, ct.sale_id, ct.type, ct.amount, ct.recorded_by, ct.created_at,
              ct.debt_line_items_json,
              ca.customer_name, ca.business_id,
              b.name as business_name,
              u.name as user_name
       FROM credit_transactions ct
       JOIN credit_accounts ca ON ct.credit_account_id = ca.id
       JOIN businesses b ON ca.business_id = b.id
       LEFT JOIN users u ON ct.recorded_by = u.id
       WHERE ct.id = ? AND ca.business_id = ?`,
      [transactionId, auth.businessId]
    );

    if (!tx) {
      return jsonResponse({ success: false, message: 'Transaction not found' }, 404);
    }

    if (!isDebtType(tx.type)) {
      return jsonResponse(
        { success: false, message: 'Only credit (tab) debt receipts can be reprinted' },
        400
      );
    }

    if (tx.sale_id) {
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
        [tx.sale_id, auth.businessId]
      );

      if (sale) {
        const saleItems = await query<
          SaleItem & {
            item_name: string;
            item_unit_type: string;
            batch_number: string | null;
          }
        >(
          `SELECT 
            si.*,
            COALESCE(i.name, 'Item (removed)') as item_name,
            COALESCE(i.unit_type, 'pc') as item_unit_type,
            ib.batch_number
           FROM sale_items si
           LEFT JOIN items i ON si.item_id = i.id
           LEFT JOIN inventory_batches ib ON si.inventory_batch_id = ib.id
           WHERE si.sale_id = ?
           ORDER BY si.created_at ASC`,
          [tx.sale_id]
        );

        const salePayments = await query<SalePayment>(
          `SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY created_at ASC`,
          [tx.sale_id]
        );

        const splitPayments =
          salePayments.length > 0
            ? salePayments
            : sale.payment_method === 'split'
              ? []
              : undefined;

        return jsonResponse({
          success: true,
          data: {
            sale,
            items: saleItems,
            splitPayments,
          },
        });
      }
    }

    const snap = parseCreditDebtLineItemsJson(tx.debt_line_items_json);
    if (!snap?.length) {
      return jsonResponse(
        {
          success: false,
          message: 'Receipt not available: no sale link and no saved line items for this debt',
        },
        404
      );
    }

    const saleLike = {
      id: tx.sale_id ?? tx.id,
      business_id: tx.business_id,
      user_id: tx.recorded_by,
      shift_id: null as string | null,
      total_amount: tx.amount,
      payment_method: 'credit' as const,
      status: 'completed' as const,
      voided_reason: null as string | null,
      voided_by: null as string | null,
      customer_name: tx.customer_name,
      customer_phone: null as string | null,
      sale_date: tx.created_at,
      created_at: tx.created_at,
      business_name: tx.business_name,
      user_name: tx.user_name,
    };

    const items = snap.map((r) => ({
      id: r.id,
      sale_id: saleLike.id,
      item_id: '',
      inventory_batch_id: null as string | null,
      quantity_sold: r.quantity_sold,
      sell_price_per_unit: r.sell_price_per_unit,
      buy_price_per_unit: 0,
      profit: 0,
      item_type_snapshot: null as SaleItem['item_type_snapshot'],
      created_at: tx.created_at,
      item_name: r.item_name,
      item_unit_type: r.item_unit_type,
      batch_number: null as string | null,
    }));

    return jsonResponse({
      success: true,
      data: {
        sale: saleLike,
        items,
        splitPayments: undefined as SalePayment[] | undefined,
      },
    });
  } catch (error) {
    console.error('Error building credit debt receipt:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to load receipt',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
