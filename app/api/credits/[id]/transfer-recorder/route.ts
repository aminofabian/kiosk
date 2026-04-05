import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { isAuthResponse, requireRole } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';

type Scope = 'debts' | 'all';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Reassign `recorded_by` on credit transactions for an account (staff attribution).
 * Default scope: debt entries only (who "gave" credit). Optional: all rows including payments.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['owner', 'admin']);
    if (isAuthResponse(auth)) return auth;

    const { id: accountId } = await params;
    const body = await request.json();
    const toUserId = typeof body?.toUserId === 'string' ? body.toUserId.trim() : '';
    const scope: Scope = body?.scope === 'all' ? 'all' : 'debts';

    if (!toUserId) {
      return jsonResponse({ success: false, message: 'Target staff member is required' }, 400);
    }

    const account = await queryOne<{ id: string; customer_name: string }>(
      `SELECT id, customer_name FROM credit_accounts WHERE id = ? AND business_id = ?`,
      [accountId, auth.businessId]
    );

    if (!account) {
      return jsonResponse({ success: false, message: 'Credit account not found' }, 404);
    }

    const targetUser = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM users WHERE id = ? AND business_id = ? AND active = 1`,
      [toUserId, auth.businessId]
    );

    if (!targetUser) {
      return jsonResponse(
        { success: false, message: 'That staff member was not found or is inactive' },
        400
      );
    }

    const typeClause = scope === 'all' ? '' : `AND type = 'debt'`;

    const { rowsAffected } = await execute(
      `UPDATE credit_transactions
       SET recorded_by = ?
       WHERE credit_account_id = ? ${typeClause}`,
      [toUserId, accountId]
    );

    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'credit',
      entityId: accountId,
      entityNameSnapshot: account.customer_name,
      details: {
        action: 'transfer_recorder',
        toUserId,
        toUserName: targetUser.name,
        scope,
        rowsUpdated: rowsAffected,
      },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message:
        rowsAffected === 0
          ? 'No matching records to update'
          : `Updated ${rowsAffected} record${rowsAffected === 1 ? '' : 's'}`,
      data: { updatedCount: rowsAffected, scope },
    });
  } catch (error) {
    console.error('Error transferring credit recorder:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to transfer creditor attribution',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
