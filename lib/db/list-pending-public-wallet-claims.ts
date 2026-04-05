import { query } from '@/lib/db';

export type PendingPublicWalletClaimRow = {
  transaction_id: string;
  credit_account_id: string;
  customer_name: string;
  amount: number;
  payment_method: string | null;
  customer_reference: string | null;
  created_at: number;
};

export async function listPendingPublicWalletClaimsForBusiness(
  businessId: string
): Promise<PendingPublicWalletClaimRow[]> {
  const rows = await query<{
    transaction_id: string;
    credit_account_id: string;
    customer_name: string;
    amount: number;
    payment_method: string | null;
    customer_reference: string | null;
    created_at: number;
  }>(
    `SELECT
      wt.id AS transaction_id,
      wt.credit_account_id,
      ca.customer_name,
      wt.amount,
      wt.payment_method,
      wt.customer_reference,
      wt.created_at
     FROM wallet_transactions wt
     INNER JOIN credit_accounts ca ON ca.id = wt.credit_account_id
     WHERE ca.business_id = ?
       AND wt.type = 'credit'
       AND wt.public_claim_status = 'pending'
     ORDER BY wt.created_at ASC`,
    [businessId]
  );

  return rows.map((r) => ({
    transaction_id: r.transaction_id,
    credit_account_id: r.credit_account_id,
    customer_name: r.customer_name,
    amount: Number(r.amount),
    payment_method: r.payment_method,
    customer_reference: r.customer_reference,
    created_at: r.created_at,
  }));
}
