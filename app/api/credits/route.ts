import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { CreditAccount } from '@/lib/db/types';
import {
  enrichCreditAccountRow,
  sqlCreditAccountMatchesPhoneDigits,
} from '@/lib/utils/credit-phones';

/** Extract core 9 digits for Kenyan phone matching (0712345678 -> 712345678) */
function phoneCoreDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length >= 12) return digits.slice(-9);
  if (digits.startsWith('0') && digits.length >= 10) return digits.slice(1);
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const phoneParam = searchParams.get('phone');
    const coreDigits = phoneParam?.trim() ? phoneCoreDigits(phoneParam.trim()) : null;

    const listSelect = `
      ca.id,
      ca.business_id,
      ca.customer_name,
      ca.customer_phone,
      ca.total_credit,
      ca.last_transaction_at,
      ca.created_at,
      COALESCE((
        SELECT SUM(ct.amount)
        FROM credit_transactions ct
        WHERE ct.credit_account_id = ca.id AND ct.type = 'debt'
      ), 0) AS lifetime_debt_total,
      (
        SELECT u.name FROM credit_transactions ct
        INNER JOIN users u ON ct.recorded_by = u.id
        WHERE ct.credit_account_id = ca.id AND ct.type = 'debt'
        ORDER BY ct.created_at DESC LIMIT 1
      ) AS last_credit_by_name,
      (
        SELECT u.role FROM credit_transactions ct
        INNER JOIN users u ON ct.recorded_by = u.id
        WHERE ct.credit_account_id = ca.id AND ct.type = 'debt'
        ORDER BY ct.created_at DESC LIMIT 1
      ) AS last_credit_by_role,
      (
        SELECT u.id FROM credit_transactions ct
        INNER JOIN users u ON ct.recorded_by = u.id
        WHERE ct.credit_account_id = ca.id AND ct.type = 'debt'
        ORDER BY ct.created_at DESC LIMIT 1
      ) AS last_credit_by_user_id
    `;

    let accounts: CreditAccount[];

    if (coreDigits && coreDigits.length >= 6) {
      const ph = sqlCreditAccountMatchesPhoneDigits('ca.customer_phone', coreDigits);
      accounts = await query<CreditAccount>(
        `SELECT ${listSelect}
         FROM credit_accounts ca
         WHERE ca.business_id = ? AND ${ph.sql}
         ORDER BY ca.total_credit DESC, ca.last_transaction_at DESC`,
        [auth.businessId, ...ph.params]
      );
    } else {
      accounts = await query<CreditAccount>(
        `SELECT ${listSelect}
         FROM credit_accounts ca
         WHERE ca.business_id = ?
         ORDER BY ca.total_credit DESC, ca.last_transaction_at DESC`,
        [auth.businessId]
      );
    }

    return jsonResponse({
      success: true,
      data: accounts.map(enrichCreditAccountRow),
    });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch credits',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

