import { NextRequest } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse, requireRole } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';
import { toProperCustomerName } from '@/lib/utils/customer-name';
import {
  enrichCreditAccountRow,
  parseCreditPhones,
  serializeCreditPhones,
} from '@/lib/utils/credit-phones';
import type { CreditAccount, CreditTransaction, SaleItem } from '@/lib/db/types';

interface SaleItemWithDetails extends SaleItem {
  item_name: string;
  item_unit_type: string;
}

interface CreditTransactionWithDetails extends CreditTransaction {
  user_name?: string;
  recorder_role?: string | null;
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
        u.role as recorder_role,
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
        account: account ? enrichCreditAccountRow(account) : null,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['owner', 'admin']);
    if (isAuthResponse(auth)) return auth;

    const { id: accountId } = await params;
    const body = await request.json();

    const rawName = typeof body?.customerName === 'string' ? body.customerName.trim() : '';
    const customerName = toProperCustomerName(rawName);
    if (!customerName) {
      return jsonResponse({ success: false, message: 'Customer name is required' }, 400);
    }

    const existing = await queryOne<{
      id: string;
      customer_name: string;
      customer_phone: string | null;
    }>(
      `SELECT id, customer_name, customer_phone FROM credit_accounts WHERE id = ? AND business_id = ?`,
      [accountId, auth.businessId]
    );

    if (!existing) {
      return jsonResponse({ success: false, message: 'Credit account not found' }, 404);
    }

    let customerPhoneStored: string | null = existing.customer_phone;

    if (body?.customerPhones !== undefined) {
      if (!Array.isArray(body.customerPhones)) {
        return jsonResponse({ success: false, message: 'customerPhones must be an array' }, 400);
      }
      const list = body.customerPhones
        .filter((x: unknown) => typeof x === 'string')
        .map((s: string) => s.trim())
        .filter(Boolean);
      customerPhoneStored = serializeCreditPhones(list);
    } else if (body?.customerPhone === null) {
      customerPhoneStored = null;
    } else if (typeof body?.customerPhone === 'string') {
      const t = body.customerPhone.trim();
      customerPhoneStored = t.length > 0 ? serializeCreditPhones([t]) : null;
    } else if (body?.customerPhone !== undefined) {
      return jsonResponse({ success: false, message: 'Invalid customerPhone' }, 400);
    }

    await execute(
      `UPDATE credit_accounts SET customer_name = ?, customer_phone = ? WHERE id = ? AND business_id = ?`,
      [customerName, customerPhoneStored, accountId, auth.businessId]
    );

    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'credit_account',
      entityId: accountId,
      entityNameSnapshot: customerName,
      details: {
        customerPhones: parseCreditPhones(customerPhoneStored),
        previousName: existing.customer_name,
      },
      performedBy: auth.userId,
    }).catch(() => {});

    const account = await queryOne<CreditAccount>(
      `SELECT * FROM credit_accounts WHERE id = ? AND business_id = ?`,
      [accountId, auth.businessId]
    );

    return jsonResponse({
      success: true,
      message: 'Customer updated',
      data: { account: account ? enrichCreditAccountRow(account) : null },
    });
  } catch (error) {
    console.error('Error updating credit account:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update credit customer',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

