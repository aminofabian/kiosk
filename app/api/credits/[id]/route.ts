import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { CreditAccount, CreditTransaction, SaleItem } from '@/lib/db/types';

interface SaleItemWithDetails extends SaleItem {
  item_name: string;
  item_unit_type: string;
}

interface CreditTransactionWithDetails extends CreditTransaction {
  user_name?: string;
  sale_date?: number;
  items?: SaleItemWithDetails[];
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: accountId } = await params;

    const account = await queryOne<CreditAccount>(
      `SELECT * FROM credit_accounts 
       WHERE id = ? AND business_id = ?`,
      [accountId, auth.businessId]
    );

    if (!account) {
      return jsonResponse(
        { success: false, message: 'Credit account not found' },
        404
      );
    }

    // Fetch all transactions for this account
    const transactions = await query<CreditTransactionWithDetails>(
      `SELECT 
        ct.*,
        u.name as user_name,
        s.id as sale_id,
        s.sale_date as sale_date
       FROM credit_transactions ct
       LEFT JOIN users u ON ct.recorded_by = u.id
       LEFT JOIN sales s ON ct.sale_id = s.id
       WHERE ct.credit_account_id = ?
       ORDER BY ct.created_at DESC`,
      [accountId]
    );

    // Fetch sale items for each transaction that has a sale_id
    const saleIds = transactions
      .filter((t) => t.sale_id)
      .map((t) => t.sale_id as string);

    if (saleIds.length > 0) {
      const placeholders = saleIds.map(() => '?').join(',');
      const allSaleItems = await query<SaleItemWithDetails & { sale_id: string }>(
        `SELECT 
          si.*,
          si.sale_id as sale_id,
          i.name as item_name,
          i.unit_type as item_unit_type
         FROM sale_items si
         JOIN items i ON si.item_id = i.id
         WHERE si.sale_id IN (${placeholders})
         ORDER BY si.created_at ASC`,
        saleIds
      );

      // Group items by sale_id
      const itemsBySaleId: Record<string, SaleItemWithDetails[]> = {};
      for (const item of allSaleItems) {
        if (!itemsBySaleId[item.sale_id]) {
          itemsBySaleId[item.sale_id] = [];
        }
        itemsBySaleId[item.sale_id].push(item);
      }

      // Attach items to transactions
      for (const transaction of transactions) {
        if (transaction.sale_id) {
          transaction.items = itemsBySaleId[transaction.sale_id] || [];
        }
      }
    }

    return jsonResponse({
      success: true,
      data: {
        account,
        transactions,
      },
    });
  } catch (error) {
    console.error('Error fetching credit account:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch credit account',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

