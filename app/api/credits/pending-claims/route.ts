import { listPendingPublicPaymentClaimsForBusiness } from '@/lib/db/list-pending-public-payment-claims';
import { listPendingPublicWalletClaimsForBusiness } from '@/lib/db/list-pending-public-wallet-claims';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { isAuthResponse, requireRole } from '@/lib/auth/api-auth';
import { toProperCustomerName } from '@/lib/utils/customer-name';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requireRole(['owner', 'admin']);
    if (isAuthResponse(auth)) return auth;

    const [tabRows, walletRows] = await Promise.all([
      listPendingPublicPaymentClaimsForBusiness(auth.businessId),
      listPendingPublicWalletClaimsForBusiness(auth.businessId),
    ]);

    const claims = [
      ...tabRows.map((r) => ({
        kind: 'tab' as const,
        transactionId: r.transaction_id,
        creditAccountId: r.credit_account_id,
        customerName: toProperCustomerName(r.customer_name),
        amount: r.amount,
        paymentMethod:
          r.payment_method === 'cash' || r.payment_method === 'mpesa' ? r.payment_method : 'mpesa',
        createdAt: r.created_at,
        customerReference: null as string | null,
      })),
      ...walletRows.map((r) => ({
        kind: 'wallet' as const,
        transactionId: r.transaction_id,
        creditAccountId: r.credit_account_id,
        customerName: toProperCustomerName(r.customer_name),
        amount: r.amount,
        paymentMethod:
          r.payment_method === 'cash' || r.payment_method === 'mpesa' ? r.payment_method : 'mpesa',
        createdAt: r.created_at,
        customerReference: r.customer_reference?.trim() || null,
      })),
    ].sort((a, b) => a.createdAt - b.createdAt);

    return jsonResponse({
      success: true,
      data: { claims },
    });
  } catch (e) {
    console.error('pending-claims GET:', e);
    return jsonResponse({ success: false, message: 'Failed to load pending claims' }, 500);
  }
}
