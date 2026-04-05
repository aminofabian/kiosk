import { NextRequest } from 'next/server';
import { pollPublicCreditStkAndApply } from '@/lib/db/public-credit-pesapal-stk';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Public: poll Pesapal payment status and apply credit when completed (same slug secret as the link).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;
    const orderTrackingId = decodeURIComponent(orderId || '').trim();
    if (!orderTrackingId) {
      return jsonResponse({ success: false, message: 'Missing order reference' }, 400);
    }

    const result = await pollPublicCreditStkAndApply(slug, orderTrackingId);

    if (!result.ok) {
      const map: Record<string, { status: number; message: string }> = {
        bad_slug: { status: 400, message: result.message },
        not_found: { status: 404, message: result.message },
        ambiguous: { status: 409, message: result.message },
        disabled: { status: 403, message: result.message },
        unknown_order: { status: 404, message: result.message },
        no_user: { status: 503, message: result.message },
        status_error: { status: 502, message: result.message },
      };
      const m = map[result.code] ?? { status: 400, message: result.message };
      return jsonResponse({ success: false, message: m.message, code: result.code }, m.status);
    }

    return jsonResponse({
      success: true,
      data: {
        state: result.state,
        message: result.message,
        newBalance: result.newBalance,
      },
    });
  } catch (e) {
    console.error('public credit stk-status:', e);
    return jsonResponse({ success: false, message: 'Server error' }, 500);
  }
}
