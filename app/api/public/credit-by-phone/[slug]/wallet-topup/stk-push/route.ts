import { NextRequest } from 'next/server';
import {
  initiatePublicWalletTopupStkPush,
  parsePublicWalletTopupAmountKes,
} from '@/lib/db/public-credit-pesapal-stk';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { getPublicSiteUrl } from '@/lib/utils/request-base-url';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Public: start Pesapal hosted M-Pesa checkout to top up the customer store wallet (same slug as credit status link).
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

    let body: { amount?: unknown } = {};
    try {
      body = (await request.json()) as { amount?: unknown };
    } catch {
      body = {};
    }

    const amountKes = parsePublicWalletTopupAmountKes(body.amount);
    if (amountKes == null) {
      return jsonResponse(
        {
          success: false,
          message: 'Enter a valid amount in KES',
          code: 'invalid_amount',
        },
        400
      );
    }

    const result = await initiatePublicWalletTopupStkPush(slug, amountKes, {
      callbackBaseUrl,
    });

    if (!result.ok) {
      const map: Record<string, { status: number; message: string }> = {
        bad_slug: { status: 400, message: result.message },
        not_found: { status: 404, message: result.message },
        ambiguous: { status: 409, message: result.message },
        disabled: { status: 403, message: result.message },
        invalid_amount: { status: 400, message: result.message },
        not_configured: { status: 503, message: result.message },
        pesapal_error: { status: 503, message: result.message },
      };
      const m = map[result.code] ?? { status: 400, message: result.message };
      if (result.code === 'pesapal_error') {
        console.error('[public wallet stk-push] pesapal_error:', result.message);
      }
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
    console.error('public wallet-topup stk-push:', e);
    return jsonResponse({ success: false, message: 'Server error' }, 500);
  }
}
