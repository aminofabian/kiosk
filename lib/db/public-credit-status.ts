import { query, queryOne } from '@/lib/db';
import { parseCreditPhones } from '@/lib/utils/credit-phones';
import { customerFirstName, maskPhoneForPublicDisplay } from '@/lib/utils/credit-public-slug';
import type {
  PublicCreditDebtEntry,
  PublicCreditDebtLineItem,
  PublicCreditStatusPayload,
} from '@/lib/types/public-credit-status';
import { resolvePublicCreditAccountBySlug } from '@/lib/db/public-credit-resolve';
import { isPesapalStkConfigured } from '@/lib/pesapal';
import { SQL_PAYMENT_APPLIES_TO_BALANCE } from '@/lib/db/credit-payment-claim-sql';

export type { PublicCreditStatusPayload };

const PUBLIC_DEBT_DETAILS_LIMIT = 40;

async function loadPublicDebtDetails(accountId: string): Promise<PublicCreditDebtEntry[]> {
  const debts = await query<{
    amount: number;
    created_at: number;
    sale_id: string | null;
    notes: string | null;
  }>(
    `SELECT amount, created_at, sale_id, notes
     FROM credit_transactions
     WHERE credit_account_id = ? AND type = 'debt'
     ORDER BY created_at DESC
     LIMIT ${PUBLIC_DEBT_DETAILS_LIMIT}`,
    [accountId]
  );

  if (debts.length === 0) {
    return [];
  }

  const saleIds = [...new Set(debts.map((d) => d.sale_id).filter(Boolean))] as string[];
  const itemsBySaleId: Record<string, PublicCreditDebtLineItem[]> = {};

  if (saleIds.length > 0) {
    const ph = saleIds.map(() => '?').join(',');
    const rows = await query<{
      sale_id: string;
      quantity_sold: number;
      sell_price_per_unit: number;
      item_name: string;
      item_unit_type: string;
    }>(
      `SELECT si.sale_id, si.quantity_sold, si.sell_price_per_unit,
              i.name AS item_name, i.unit_type AS item_unit_type
       FROM sale_items si
       JOIN items i ON si.item_id = i.id
       WHERE si.sale_id IN (${ph})
       ORDER BY si.created_at ASC`,
      saleIds
    );

    for (const r of rows) {
      const q = Number(r.quantity_sold);
      const ppu = Number(r.sell_price_per_unit);
      const line: PublicCreditDebtLineItem = {
        name: r.item_name,
        quantity: q,
        unitLabel: r.item_unit_type,
        lineTotal: Math.round(q * ppu * 100) / 100,
      };
      if (!itemsBySaleId[r.sale_id]) {
        itemsBySaleId[r.sale_id] = [];
      }
      itemsBySaleId[r.sale_id].push(line);
    }
  }

  return debts.map((d) => ({
    recordedAt: d.created_at,
    amount: Number(d.amount),
    note: d.notes,
    items: d.sale_id ? itemsBySaleId[d.sale_id] ?? [] : [],
  }));
}

/**
 * Optional: set CREDITS_PUBLIC_BUSINESS_ID to your business UUID so public links only resolve
 * for that store. If unset, the slug must match exactly one credit account in the database.
 */
export async function getPublicCreditStatusBySlug(
  slugParam: string
): Promise<
  | { ok: true; data: PublicCreditStatusPayload }
  | { ok: false; code: 'bad_slug' | 'not_found' | 'ambiguous' }
> {
  const resolved = await resolvePublicCreditAccountBySlug(slugParam);
  if (!resolved.ok) {
    return resolved;
  }

  const acc = resolved.data;
  const phones = parseCreditPhones(acc.customerPhone);
  const pesapalPromptAvailable = isPesapalStkConfigured();

  const stats = await queryOne<{
    lifetime_debt: number;
    debt_count: number;
    payment_count: number;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'debt' THEN amount ELSE 0 END), 0) AS lifetime_debt,
      COALESCE(SUM(CASE WHEN type = 'debt' THEN 1 ELSE 0 END), 0) AS debt_count,
      COALESCE(SUM(CASE WHEN type = 'payment' AND ${SQL_PAYMENT_APPLIES_TO_BALANCE} THEN 1 ELSE 0 END), 0) AS payment_count
     FROM credit_transactions WHERE credit_account_id = ?`,
    [acc.accountId]
  );

  const lifetimeDebtTotal = Number(stats?.lifetime_debt ?? 0);
  const debtCount = Number(stats?.debt_count ?? 0);
  const paymentCount = Number(stats?.payment_count ?? 0);
  const totalCredit = acc.totalCredit;

  const debtDetails = await loadPublicDebtDetails(acc.accountId);

  const pendingRows = await query<{
    amount: number;
    payment_method: string | null;
    created_at: number;
  }>(
    `SELECT amount, payment_method, created_at
     FROM credit_transactions
     WHERE credit_account_id = ? AND type = 'payment' AND public_claim_status = 'pending'
     ORDER BY created_at DESC`,
    [acc.accountId]
  );

  const pendingPaymentApprovals = pendingRows
    .filter((r) => r.payment_method === 'cash' || r.payment_method === 'mpesa')
    .map((r) => ({
      amount: Number(r.amount),
      paymentMethod: r.payment_method as 'cash' | 'mpesa',
      submittedAt: r.created_at,
    }));

  const pendingWalletRows = await query<{
    amount: number;
    payment_method: string | null;
    customer_reference: string | null;
    created_at: number;
  }>(
    `SELECT amount, payment_method, customer_reference, created_at
     FROM wallet_transactions
     WHERE credit_account_id = ? AND type = 'credit' AND public_claim_status = 'pending'
     ORDER BY created_at DESC`,
    [acc.accountId]
  );

  const pendingWalletApprovals = pendingWalletRows
    .filter((r) => r.payment_method === 'cash' || r.payment_method === 'mpesa')
    .map((r) => ({
      amount: Number(r.amount),
      paymentMethod: r.payment_method as 'cash' | 'mpesa',
      submittedAt: r.created_at,
      reference: r.customer_reference?.trim() || null,
    }));

  return {
    ok: true,
    data: {
      businessName: acc.businessName,
      customerName: acc.customerName,
      firstName: customerFirstName(acc.customerName),
      maskedPhone: maskPhoneForPublicDisplay(phones, acc.targetNorm),
      slugDigits: acc.slugDigits,
      totalCredit,
      walletBalance: acc.walletBalance,
      loyaltyPointsBalance: acc.loyaltyPointsBalance,
      loyaltyPointsPerKes: acc.loyaltyPointsPerKes,
      settled: totalCredit <= 0,
      lifetimeDebtTotal,
      debtCount,
      paymentCount,
      lastActivityAt: acc.lastTransactionAt,
      debtDetails,
      pesapalPromptAvailable,
      pendingPaymentApprovals,
      pendingWalletApprovals,
    },
  };
}
