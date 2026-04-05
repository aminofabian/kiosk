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
  /** Prepaid store balance (usable at checkout; e.g. cash overpayment credited to wallet). */
  walletBalance: number;
  /** Current loyalty points for this customer at this store */
  loyaltyPointsBalance: number;
  /** Store earn rate (points per 1 KES of sale when customer is linked at checkout); 0 = earning off */
  loyaltyPointsPerKes: number;
  settled: boolean;
  lifetimeDebtTotal: number;
  debtCount: number;
  paymentCount: number;
  lastActivityAt: number | null;
  /** Recent debt transactions with sale line items where available (newest first). */
  debtDetails: PublicCreditDebtEntry[];
  /** Pesapal STK / hosted checkout is configured (M-Pesa prompt button can be shown). */
  pesapalPromptAvailable: boolean;
  /**
   * Customer-recorded payments waiting for admin approval (not yet applied to balance).
   */
  pendingPaymentApprovals: Array<{
    amount: number;
    paymentMethod: 'cash' | 'mpesa';
    submittedAt: number;
  }>;
  /** Customer-reported wallet top-ups awaiting admin approval */
  pendingWalletApprovals: Array<{
    amount: number;
    paymentMethod: 'cash' | 'mpesa';
    submittedAt: number;
    /** M-Pesa confirmation code or receipt ref when provided */
    reference: string | null;
  }>;
};
