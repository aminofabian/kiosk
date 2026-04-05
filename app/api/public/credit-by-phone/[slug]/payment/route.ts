import { NextRequest } from 'next/server';
import { recordPublicFullBalancePayment } from '@/lib/db/public-credit-self-pay';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Public: record a payment for the **entire** outstanding balance (customer self-service).
 * Optional body: { "paymentMethod": "mpesa" | "cash" } (default mpesa).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    let paymentMethod: 'cash' | 'mpesa' = 'mpesa';
    try {
      const body = await request.json();
      if (body?.paymentMethod === 'cash' || body?.paymentMethod === 'mpesa') {
        paymentMethod = body.paymentMethod;
      }
    } catch {
      /* empty body ok */
    }

    const result = await recordPublicFullBalancePayment(slug, paymentMethod);

    if (!result.ok) {
      const map: Record<typeof result.code, { status: number; message: string }> = {
        bad_slug: { status: 400, message: 'Invalid link' },
        not_found: { status: 404, message: 'No account found' },
        ambiguous: {
          status: 409,
          message:
            'Multiple stores share this database. Set CREDITS_PUBLIC_BUSINESS_ID and try again.',
        },
        disabled: { status: 403, message: 'Recording payment from this page is disabled' },
        nothing_owed: { status: 400, message: 'There is no balance to pay' },
        no_user: { status: 503, message: 'Store is not configured for online payment recording' },
        conflict: {
          status: 409,
          message: 'Balance changed — refresh the page and try again, or pay at the store',
        },
      };
      const m = map[result.code];
      return jsonResponse({ success: false, message: m.message }, m.status);
    }

    return jsonResponse({
      success: true,
      message: 'Payment recorded. Your balance is cleared.',
      data: { newBalance: result.newBalance, transactionId: result.transactionId },
    });
  } catch (e) {
    console.error('public credit payment:', e);
    return jsonResponse({ success: false, message: 'Server error' }, 500);
  }
}
