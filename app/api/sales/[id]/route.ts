import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { Sale, SaleItem } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

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

