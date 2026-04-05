import { NextRequest } from 'next/server';
import {
  approvePublicCreditPaymentClaim,
  rejectPublicCreditPaymentClaim,
} from '@/lib/db/review-public-credit-payment-claim';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { isAuthResponse, requireRole } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Owner/admin: approve or reject a customer-reported payment from the public credit link.
 * Body: { "action": "approve" | "reject" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const auth = await requireRole(['owner', 'admin']);
    if (isAuthResponse(auth)) return auth;

    const { transactionId } = await params;
    let body: { action?: string } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : null;
    if (!action) {
      return jsonResponse({ success: false, message: 'Body must include action: "approve" or "reject"' }, 400);
    }

    const result =
      action === 'approve'
        ? await approvePublicCreditPaymentClaim(auth.businessId, transactionId, auth.userId)
        : await rejectPublicCreditPaymentClaim(auth.businessId, transactionId, auth.userId);

    if (!result.ok) {
      const status =
        result.code === 'not_found'
          ? 404
          : result.code === 'bad_state'
            ? 409
            : result.code === 'shift_required'
              ? 422
              : 409;
      return jsonResponse({ success: false, message: result.message, code: result.code }, status);
    }

    return jsonResponse({
      success: true,
      message: action === 'approve' ? 'Payment approved and balance updated.' : 'Payment claim rejected.',
      data: { newBalance: result.newBalance },
    });
  } catch (e) {
    console.error('credit claim review:', e);
    return jsonResponse({ success: false, message: 'Server error' }, 500);
  }
}
