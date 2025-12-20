// Unit types
export const UNIT_TYPES = ['kg', 'g', 'piece', 'bunch', 'tray', 'litre', 'ml'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

// User roles
export const USER_ROLES = ['owner', 'admin', 'cashier', 'superadmin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Payment methods
export const PAYMENT_METHODS = ['cash', 'mpesa', 'credit', 'split'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Sale status
export const SALE_STATUS = ['completed', 'voided'] as const;
export type SaleStatus = (typeof SALE_STATUS)[number];

// Purchase status
export const PURCHASE_STATUS = ['pending', 'partial', 'complete'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUS)[number];

// Purchase item status
export const PURCHASE_ITEM_STATUS = ['pending', 'broken_down'] as const;
export type PurchaseItemStatus = (typeof PURCHASE_ITEM_STATUS)[number];

// Stock adjustment reasons
export const ADJUSTMENT_REASONS = ['spoilage', 'theft', 'counting_error', 'damage', 'other'] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

// Shift status
export const SHIFT_STATUS = ['open', 'closed'] as const;
export type ShiftStatus = (typeof SHIFT_STATUS)[number];

// Credit transaction types
export const CREDIT_TRANSACTION_TYPES = ['debt', 'payment'] as const;
export type CreditTransactionType = (typeof CREDIT_TRANSACTION_TYPES)[number];

// Credit payment methods (for credit transactions)
export const CREDIT_PAYMENT_METHODS = ['cash', 'mpesa'] as const;
export type CreditPaymentMethod = (typeof CREDIT_PAYMENT_METHODS)[number];

