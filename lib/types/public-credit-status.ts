export type PublicCreditDebtLineItem = {
  name: string;
  quantity: number;
  unitLabel: string;
  lineTotal: number;
};

/** One credit (debt) transaction — line items when it came from a sale. */
export type PublicCreditDebtEntry = {
  recordedAt: number;
  amount: number;
  note: string | null;
  items: PublicCreditDebtLineItem[];
};

export type PublicCreditStatusPayload = {
  businessName: string;
  customerName: string;
  firstName: string;
  maskedPhone: string;
  slugDigits: string;
  totalCredit: number;
  settled: boolean;
  lifetimeDebtTotal: number;
  debtCount: number;
  paymentCount: number;
  lastActivityAt: number | null;
  /** Recent debt transactions with sale line items where available (newest first). */
  debtDetails: PublicCreditDebtEntry[];
  /** Pesapal STK / hosted checkout is configured (M-Pesa prompt button can be shown). */
  pesapalPromptAvailable: boolean;
  /** Account has a phone on file to pre-target the M-Pesa prompt; if false, customer should enter a number. */
  stkPromptHasStoredPhone: boolean;
};
