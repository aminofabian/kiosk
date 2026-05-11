import { NextRequest } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireRole, isAuthResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/credits/settings
 *
 * Returns:
 * - users: list of all users with their can_give_credit status
 * - credit_settings: the business's credit_settings JSON blob
 */
export async function GET() {
  try {
    const auth = await requireRole(['owner', 'admin']);
    if (isAuthResponse(auth)) return auth;

    const users = await query<{
      id: string;
      name: string;
      email: string;
      role: string;
      active: number;
      can_give_credit: number;
    }>(
      `SELECT id, name, email, role, active, can_give_credit
       FROM users
       WHERE business_id = ?
       ORDER BY role, name ASC`,
      [auth.businessId]
    );

    const business = await queryOne<{ credit_settings: string | null }>(
      `SELECT credit_settings FROM businesses WHERE id = ?`,
      [auth.businessId]
    );

    let creditSettings: { allow_new_credit_accounts?: boolean } = {};
    try {
      if (business?.credit_settings) {
        creditSettings = JSON.parse(business.credit_settings);
      }
    } catch {
      // ignore parse error
    }

    return jsonResponse({
      success: true,
      data: {
        users,
        creditSettings,
      },
    });
  } catch (error) {
    console.error('Error fetching credit settings:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch credit settings',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * PATCH /api/credits/settings
 *
 * Update credit settings for the business.
 * Body can contain:
 * - creditSettings: { allow_new_credit_accounts?: boolean }
 * - userId: string | null — set can_give_credit for a specific user
 * - canGiveCredit: boolean — new value for can_give_credit if userId provided
 * - resetAll: boolean — when true, sets can_give_credit = 0 for all cashiers
 * - grantAll: boolean — when true, sets can_give_credit = 1 for all users
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireRole(['owner', 'admin']);
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();

    // Update business-level credit settings
    if (body.creditSettings !== undefined) {
      const current = await queryOne<{ credit_settings: string | null }>(
        `SELECT credit_settings FROM businesses WHERE id = ?`,
        [auth.businessId]
      );
      let currentSettings: Record<string, unknown> = {};
      try {
        if (current?.credit_settings) {
          currentSettings = JSON.parse(current.credit_settings);
        }
      } catch {
        // ignore
      }
      const merged = { ...currentSettings, ...body.creditSettings };
      await execute(
        `UPDATE businesses SET credit_settings = ? WHERE id = ?`,
        [JSON.stringify(merged), auth.businessId]
      );
    }

    // Update a single user's can_give_credit
    if (body.userId !== undefined) {
      if (typeof body.canGiveCredit !== 'boolean') {
        return jsonResponse(
          { success: false, message: 'canGiveCredit must be a boolean' },
          400
        );
      }
      const user = await queryOne<{ id: string }>(
        `SELECT id FROM users WHERE id = ? AND business_id = ?`,
        [body.userId, auth.businessId]
      );
      if (!user) {
        return jsonResponse(
          { success: false, message: 'User not found in this business' },
          404
        );
      }
      await execute(
        `UPDATE users SET can_give_credit = ? WHERE id = ? AND business_id = ?`,
        [body.canGiveCredit ? 1 : 0, body.userId, auth.businessId]
      );
    }

    // Reset all cashiers (set can_give_credit = 0)
    if (body.resetAll === true) {
      await execute(
        `UPDATE users SET can_give_credit = 0
         WHERE business_id = ? AND role = 'cashier'`,
        [auth.businessId]
      );
    }

    // Grant all users (set can_give_credit = 1)
    if (body.grantAll === true) {
      await execute(
        `UPDATE users SET can_give_credit = 1 WHERE business_id = ?`,
        [auth.businessId]
      );
    }

    return jsonResponse({ success: true, message: 'Credit settings updated' });
  } catch (error) {
    console.error('Error updating credit settings:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update credit settings',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
