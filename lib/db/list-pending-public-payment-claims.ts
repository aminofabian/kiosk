import { query } from '@/lib/db';

export type PendingPublicPaymentClaimRow = {
  transaction_id: string;
  credit_account_id: string;
  customer_name: string;
  amount: number;
  payment_method: string | null;
  created_at: number;
};

export async function listPendingPublicPaymentClaimsForBusiness(
  businessId: string
): Promise<PendingPublicPaymentClaimRow[]> {
  const rows = await query<{
    transaction_id: string;
    credit_account_id: string;
    customer_name: string;
    amount: number;
    payment_method: string | null;
    created_at: number;
  }>(
    `SELECT
      ct.id AS transaction_id,
      ct.credit_account_id,
      ca.customer_name,
      ct.amount,
      ct.payment_method,
      ct.created_at
     FROM credit_transactions ct
     INNER JOIN credit_accounts ca ON ca.id = ct.credit_account_id
     WHERE ca.business_id = ?
       AND ct.type = 'payment'
       AND ct.public_claim_status = 'pending'
     ORDER BY ct.created_at ASC`,
    [businessId]
  );

  return rows.map((r) => ({
    transaction_id: r.transaction_id,
    credit_account_id: r.credit_account_id,
    customer_name: r.customer_name,
    amount: Number(r.amount),
    payment_method: r.payment_method,
    created_at: r.created_at,
  }));
}
