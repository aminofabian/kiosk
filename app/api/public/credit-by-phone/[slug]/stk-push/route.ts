import { NextRequest } from 'next/server';
import { initiatePublicCreditStkPush } from '@/lib/db/public-credit-pesapal-stk';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { getPublicSiteUrl } from '@/lib/utils/request-base-url';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Public: start Pesapal hosted M-Pesa checkout for the current credit balance (same flow as POS checkout).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const callbackBaseUrl = getPublicSiteUrl(request);
    if (!callbackBaseUrl) {
      return jsonResponse(
        { success: false, message: 'Could not determine public site URL for payment callback' },
        500
      );
    }

    const result = await initiatePublicCreditStkPush(slug, {
      callbackBaseUrl,
    });

    if (!result.ok) {
      const map: Record<string, { status: number; message: string }> = {
        bad_slug: { status: 400, message: result.message },
        not_found: { status: 404, message: result.message },
        ambiguous: { status: 409, message: result.message },
        disabled: { status: 403, message: result.message },
        nothing_owed: { status: 400, message: result.message },
        not_configured: { status: 503, message: result.message },
        pesapal_error: { status: 502, message: result.message },
      };
      const m = map[result.code] ?? { status: 400, message: result.message };
      return jsonResponse({ success: false, message: m.message, code: result.code }, m.status);
    }

    return jsonResponse({
      success: true,
      data: {
        orderTrackingId: result.orderTrackingId,
        merchantReference: result.merchantReference,
        redirectUrl: result.redirectUrl,
      },
    });
  } catch (e) {
    console.error('public credit stk-push:', e);
    return jsonResponse({ success: false, message: 'Server error' }, 500);
  }
}
