import { NextRequest } from 'next/server';
import { initiatePublicCreditStkPush } from '@/lib/db/public-credit-pesapal-stk';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Public: start Pesapal hosted checkout / M-Pesa prompt for the current credit balance.
 * Body (optional): { "phone": "0712…" } — required if the account has no phone on file.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    let phone: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.phone === 'string') {
        phone = body.phone.trim() || null;
      }
    } catch {
      /* empty body */
    }

    const origin = request.headers.get('origin') || request.headers.get('host') || '';
    const protocol = origin.includes('localhost') ? 'http' : 'https';
    const callbackBaseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`;

    const result = await initiatePublicCreditStkPush(slug, {
      callbackBaseUrl,
      phoneNumber: phone,
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
        phone_required: { status: 400, message: result.message },
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
