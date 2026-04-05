import { NextRequest } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { isAuthResponse, requireRole } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';
import { toProperCustomerName } from '@/lib/utils/customer-name';
import { parseCreditPhones, serializeCreditPhones } from '@/lib/utils/credit-phones';
import { SQL_PAYMENT_APPLIES_TO_BALANCE } from '@/lib/db/credit-payment-claim-sql';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Merge duplicate credit customer profiles: moves all transactions into one account and deletes the others.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(['owner', 'admin']);
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const keepAccountId =
      typeof body?.keepAccountId === 'string' ? body.keepAccountId.trim() : '';
    const mergeAccountIds: string[] = [];
    const mergeSeen = new Set<string>();
    if (Array.isArray(body?.mergeAccountIds)) {
      for (const raw of body.mergeAccountIds) {
        if (typeof raw !== 'string' || !raw.trim()) continue;
        const id = raw.trim();
        if (id === keepAccountId || mergeSeen.has(id)) continue;
        mergeSeen.add(id);
        mergeAccountIds.push(id);
      }
    }

    const customerNameOpt =
      typeof body?.customerName === 'string' ? body.customerName.trim() : '';
    const customerPhoneOpt =
      typeof body?.customerPhone === 'string' ? body.customerPhone.trim() : '';
    const bodyCustomerPhones: string[] = [];
    if (Array.isArray(body?.customerPhones)) {
      for (const raw of body.customerPhones) {
        if (typeof raw !== 'string' || !raw.trim()) continue;
        bodyCustomerPhones.push(raw.trim());
      }
    }

    if (!keepAccountId) {
      return jsonResponse({ success: false, message: 'Account to keep is required' }, 400);
    }
    if (mergeAccountIds.length === 0) {
      return jsonResponse(
        { success: false, message: 'Select at least one other account to merge' },
        400
      );
    }

    const allIds = [keepAccountId, ...mergeAccountIds];
    const placeholders = allIds.map(() => '?').join(',');

    const rows = await query<{ id: string }>(
      `SELECT id FROM credit_accounts WHERE business_id = ? AND id IN (${placeholders})`,
      [auth.businessId, ...allIds]
    );

    if (rows.length !== allIds.length) {
      return jsonResponse(
        { success: false, message: 'One or more accounts were not found in your business' },
        400
      );
    }

    const keepAccount = await queryOne<{
      customer_name: string;
      customer_phone: string | null;
    }>(
      `SELECT customer_name, customer_phone FROM credit_accounts WHERE id = ? AND business_id = ?`,
      [keepAccountId, auth.businessId]
    );

    const mergePh = mergeAccountIds.map(() => '?').join(',');
    await execute(
      `UPDATE credit_transactions SET credit_account_id = ? WHERE credit_account_id IN (${mergePh})`,
      [keepAccountId, ...mergeAccountIds]
    );

    await execute(
      `UPDATE wallet_transactions SET credit_account_id = ? WHERE credit_account_id IN (${mergePh})`,
      [keepAccountId, ...mergeAccountIds]
    );

    const owedRow = await queryOne<{ owed: number; last_ts: number | null }>(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'debt' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'payment' AND ${SQL_PAYMENT_APPLIES_TO_BALANCE} THEN amount ELSE 0 END), 0) AS owed,
        MAX(created_at) AS last_ts
       FROM credit_transactions WHERE credit_account_id = ?`,
      [keepAccountId]
    );

    const newBalance = Number(owedRow?.owed ?? 0);
    const lastAt = owedRow?.last_ts ?? null;

    const walletSumRow = await queryOne<{ w: number }>(
      `SELECT COALESCE(SUM(COALESCE(wallet_balance, 0)), 0) AS w
       FROM credit_accounts WHERE business_id = ? AND id IN (${placeholders})`,
      [auth.businessId, ...allIds]
    );
    const mergedWalletBalance = Number(walletSumRow?.w ?? 0);

    const phoneRows = await query<{ customer_phone: string | null }>(
      `SELECT customer_phone FROM credit_accounts WHERE business_id = ? AND id IN (${placeholders})`,
      [auth.businessId, ...allIds]
    );
    const unionPhones = new Set<string>();
    for (const r of phoneRows) {
      for (const p of parseCreditPhones(r.customer_phone)) {
        unionPhones.add(p);
      }
    }

    let nextName = (keepAccount?.customer_name ?? '').trim() || '';
    let nextPhoneStored: string | null;

    if (bodyCustomerPhones.length > 0) {
      nextPhoneStored = serializeCreditPhones(bodyCustomerPhones);
    } else {
      if (customerPhoneOpt.length > 0) {
        unionPhones.add(customerPhoneOpt);
      }
      nextPhoneStored = serializeCreditPhones([...unionPhones]);
    }

    if (customerNameOpt.length > 0) {
      nextName = customerNameOpt;
    }

    nextName = toProperCustomerName(nextName);
    if (!nextName) {
      return jsonResponse(
        { success: false, message: 'Merged profile must have a customer name' },
        400
      );
    }

    await execute(
      `UPDATE credit_accounts SET
        customer_name = ?,
        customer_phone = ?,
        total_credit = ?,
        wallet_balance = ?,
        last_transaction_at = ?
       WHERE id = ? AND business_id = ?`,
      [nextName, nextPhoneStored, newBalance, mergedWalletBalance, lastAt, keepAccountId, auth.businessId]
    );

    const delPh = mergeAccountIds.map(() => '?').join(',');
    await execute(
      `DELETE FROM credit_accounts WHERE business_id = ? AND id IN (${delPh})`,
      [auth.businessId, ...mergeAccountIds]
    );

    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'credit_merge',
      entityId: keepAccountId,
      entityNameSnapshot: keepAccount?.customer_name,
      details: {
        mergedAccountIds: mergeAccountIds,
        newBalance,
        renamed: Boolean(customerNameOpt || customerPhoneOpt || bodyCustomerPhones.length > 0),
      },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: `Merged ${mergeAccountIds.length} duplicate profile${mergeAccountIds.length === 1 ? '' : 's'} into one customer`,
      data: {
        keepAccountId,
        mergedCount: mergeAccountIds.length,
        newBalance,
      },
    });
  } catch (error) {
    console.error('Error merging credit accounts:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to merge credit accounts',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
