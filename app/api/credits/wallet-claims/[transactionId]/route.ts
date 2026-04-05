import { NextRequest } from 'next/server';
import {
  approvePublicWalletTopupClaim,
  rejectPublicWalletTopupClaim,
} from '@/lib/db/review-public-wallet-claim';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { isAuthResponse, requireRole } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Owner/admin: approve or reject a customer-reported wallet top-up from the public link.
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
        ? await approvePublicWalletTopupClaim(auth.businessId, transactionId, auth.userId)
        : await rejectPublicWalletTopupClaim(auth.businessId, transactionId, auth.userId);

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
      message:
        action === 'approve' ? 'Wallet top-up approved and balance updated.' : 'Wallet claim rejected.',
      data: { newWalletBalance: result.newWalletBalance },
    });
  } catch (e) {
    console.error('wallet claim review:', e);
    return jsonResponse({ success: false, message: 'Server error' }, 500);
  }
}
