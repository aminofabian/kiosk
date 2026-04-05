import { NextRequest } from 'next/server';
import { recordPublicWalletTopupClaim } from '@/lib/db/public-wallet-claim';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Public: customer-reported wallet top-up (amount + M-Pesa code / notes) — pending admin approval.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    let body: {
      amount?: unknown;
      paymentMethod?: unknown;
      mpesaTransactionCode?: unknown;
      customerReference?: unknown;
      notes?: unknown;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      /* empty */
    }

    const paymentMethod =
      body.paymentMethod === 'cash' || body.paymentMethod === 'mpesa' ? body.paymentMethod : null;
    if (!paymentMethod) {
      return jsonResponse(
        { success: false, message: 'Choose payment method: cash or mpesa' },
        400
      );
    }

    const amount =
      typeof body.amount === 'number'
        ? body.amount
        : typeof body.amount === 'string'
          ? Number(body.amount.replace(/,/g, '').trim())
          : NaN;

    const result = await recordPublicWalletTopupClaim(slug, {
      amount,
      paymentMethod,
      mpesaTransactionCode:
        typeof body.mpesaTransactionCode === 'string' ? body.mpesaTransactionCode : undefined,
      customerReference:
        typeof body.customerReference === 'string' ? body.customerReference : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });

    if (!result.ok) {
      const map: Record<typeof result.code, { status: number; message: string }> = {
        bad_slug: { status: 400, message: 'Invalid link' },
        not_found: { status: 404, message: 'No account found' },
        ambiguous: {
          status: 409,
          message:
            'Multiple stores share this database. Set CREDITS_PUBLIC_BUSINESS_ID and try again.',
        },
        disabled: { status: 403, message: 'Recording from this page is disabled' },
        no_user: { status: 503, message: 'Store is not configured for online recording' },
        invalid_amount: { status: 400, message: 'Enter a valid amount in KES' },
        invalid_reference: {
          status: 400,
          message: 'Enter your M-Pesa confirmation code (transaction ID)',
        },
      };
      const m = map[result.code];
      return jsonResponse({ success: false, message: m.message }, m.status);
    }

    return jsonResponse({
      success: true,
      message:
        'Top-up submitted. Your wallet balance updates after the store reviews and approves it.',
      data: {
        transactionId: result.transactionId,
        pendingApproval: true,
      },
    });
  } catch (e) {
    console.error('public wallet-claim:', e);
    return jsonResponse({ success: false, message: 'Server error' }, 500);
  }
}
