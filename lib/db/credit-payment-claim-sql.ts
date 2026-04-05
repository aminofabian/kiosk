/**
 * For payment rows: true when the payment applies to the customer’s balance (excludes pending/rejected public claims).
 */
export const SQL_PAYMENT_APPLIES_TO_BALANCE =
  "(public_claim_status IS NULL OR public_claim_status NOT IN ('pending', 'rejected'))";
