import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { CreditAccount } from '@/lib/db/types';

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

    let accounts: CreditAccount[];

    if (coreDigits && coreDigits.length >= 6) {
      // Search by phone: core digits match 0712..., 254712..., +254..., etc.
      accounts = await query<CreditAccount>(
        `SELECT * FROM credit_accounts 
         WHERE business_id = ? AND customer_phone IS NOT NULL
         AND customer_phone LIKE ?
         ORDER BY total_credit DESC, last_transaction_at DESC`,
        [auth.businessId, `%${coreDigits}%`]
      );
    } else {
      accounts = await query<CreditAccount>(
        `SELECT * FROM credit_accounts 
         WHERE business_id = ? 
         ORDER BY total_credit DESC, last_transaction_at DESC`,
        [auth.businessId]
      );
    }

    return jsonResponse({
      success: true,
      data: accounts,
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

