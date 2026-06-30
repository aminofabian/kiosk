import type {
  UserRole,
  UnitType,
  ItemType,
  PaymentMethod,
  SaleRecordPaymentMethod,
  SaleStatus,
  PurchaseStatus,
  PurchaseItemStatus,
  AdjustmentReason,
  ShiftStatus,
  CreditTransactionType,
  CreditPaymentMethod,
} from "@/lib/constants";

// ============================================
// Database Table Types
// ============================================

export interface Business {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  settings: string | null; // JSON stored as string
  active: number; // 1 = active, 0 = suspended
  /** Points per 1 KES of sale total when customer linked; 0 disables earning */
  loyalty_points_per_kes?: number;
  created_at: number; // Unix timestamp
}

export interface SuperAdmin {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  active: number;
  created_at: number;
}

export interface Domain {
  id: string;
  domain: string;
  business_id: string;
  is_primary: number; // 1 = primary, 0 = secondary
  active: number; // 1 = active, 0 = suspended
  created_at: number;
}

export interface User {
  id: string;
  business_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  pin: string | null;
  active: number; // 1 = true, 0 = false (SQLite boolean)
  department: string | null; // department name for department_staff role (e.g. "Produce", "Bakery")
  created_by: string | null; // user who created this user (null for owners/self-registered)
  created_at: number;
}

/** Server-only secret is stored as SHA-256 hex in `token_hash`; `token_prefix` is for display. */
export interface ExternalApiKey {
  id: string;
  business_id: string;
  user_id: string;
  label: string | null;
  token_hash: string;
  token_prefix: string;
  active: number;
  created_at: number;
  last_used_at: number | null;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  position: number;
  icon: string | null;
  active: number; // 1 = true, 0 = false
  created_at: number;
}

export interface Aisle {
  id: string;
  business_id: string;
  name: string;
  number: string | null;
  sort_order: number;
  created_at: number;
}

export interface Item {
  id: string;
  business_id: string;
  category_id: string;
  parent_item_id: string | null; // null for parent items or standalone items
  name: string;
  variant_name: string | null; // e.g., "Big", "Small", "Red Kidney" (null for parent items)
  unit_type: UnitType;
  item_type: ItemType;
  current_stock: number; // REAL in SQLite
  min_stock_level: number | null;
  /** Par / target level to restock to when below minimum */
  expected_stock_level: number | null;
  current_sell_price: number;
  image_url: string | null;
  barcode: string | null; // Optional barcode (EAN-13, UPC, etc.)
  barcode_exempt?: number; // 1 = intentionally no barcode needed
  barcode_exempt_reason?: string | null; // Reason key from BARCODE_EXEMPT_REASONS
  product_code: string | null; // Optional 3-5 char code for batch numbering (e.g. TOM, ONI)
  expiry_date: number | null; // Optional expiry date as Unix timestamp
  // Bundle pricing: allows selling items in bundles (e.g., "3 tomatoes for KES 20")
  bundle_quantity: number | null; // Number of units in a bundle (e.g., 3)
  bundle_price: number | null; // Price for the bundle (e.g., 20)
  bundle_name: string | null; // Optional friendly name (e.g., "3 for 20", "Half Dozen")
  // Packaging units: bulk ordering (e.g., "Carton" = 18 packets)
  packaging_unit_name: string | null; // e.g., "Carton", "Sack", "Crate"
  packaging_unit_qty: number | null; // items per packaging unit (e.g., 18)
  aisle?: string | null; // e.g., "Produce", "Dairy" (added via migration)
  aisle_number?: string | null; // e.g., "A3", "12" (added via migration)
  active: number; // 1 = true, 0 = false
  created_at: number;
  /** FIFO batch number (from API when available, e.g. POS search) */
  batch_number?: string | null;
}

// Helper type for parent items (grouping containers)
export interface ParentItem extends Item {
  parent_item_id: null;
  variant_name: null;
}

// Helper type for variant items
export interface VariantItem extends Item {
  parent_item_id: string;
  variant_name: string;
}

export interface SellingPrice {
  id: string;
  item_id: string;
  price: number;
  effective_from: number;
  set_by: string;
  created_at: number;
}

export interface BuyingPrice {
  id: string;
  item_id: string;
  supplier_id: string | null;
  price: number;
  effective_from: number;
  set_by: string | null;
  notes: string | null;
  created_at: number;
}

export interface Purchase {
  id: string;
  business_id: string;
  recorded_by: string;
  supplier_id: string | null;
  supplier_name: string | null;
  purchase_date: number; // Unix timestamp
  total_amount: number;
  extra_costs: number;
  notes: string | null;
  status: PurchaseStatus;
  created_at: number;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  item_id: string | null;
  item_name_snapshot: string;
  quantity_note: string;
  amount: number;
  notes: string | null;
  status: PurchaseItemStatus;
  created_at: number;
}

export interface PurchaseBreakdown {
  id: string;
  purchase_item_id: string;
  item_id: string;
  usable_quantity: number;
  wastage_quantity: number;
  buy_price_per_unit: number;
  notes: string | null;
  confirmed_by: string;
  confirmed_at: number;
}

export type BatchStatus = "active" | "depleted" | "deactivated";

export interface InventoryBatch {
  id: string;
  business_id: string;
  item_id: string;
  source_breakdown_id: string | null;
  supplier_bill_id: string | null;
  batch_number: string | null;
  status: BatchStatus;
  supplier_id: string | null;
  initial_quantity: number;
  quantity_remaining: number;
  buy_price_per_unit: number;
  received_at: number;
  expiry_date: number | null;
  created_at: number;
}

export interface Sale {
  id: string;
  business_id: string;
  user_id: string;
  shift_id: string | null;
  total_amount: number;
  payment_method: SaleRecordPaymentMethod;
  status: SaleStatus;
  voided_reason: string | null;
  voided_by: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: number | null;
  created_at: number;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  item_id: string;
  inventory_batch_id: string | null;
  quantity_sold: number;
  sell_price_per_unit: number;
  buy_price_per_unit: number;
  profit: number;
  item_type_snapshot: ItemType | null; // Item type at time of sale for historical accuracy
  created_at: number;
}

export type RefundMethod = "cash" | "mpesa" | "wallet" | "credit_note";

export interface SaleReturn {
  id: string;
  business_id: string;
  sale_id: string;
  processed_by: string;
  shift_id: string | null;
  refund_method: RefundMethod;
  total_refund_amount: number;
  reason: string;
  credit_account_id: string | null;
  mpesa_reference: string | null;
  created_at: number;
}

export interface SaleReturnItem {
  id: string;
  return_id: string;
  sale_item_id: string;
  item_id: string;
  inventory_batch_id: string | null;
  quantity_returned: number;
  refund_amount: number;
  created_at: number;
}

export interface Shift {
  id: string;
  business_id: string;
  user_id: string;
  opening_cash: number;
  expected_closing_cash: number;
  actual_closing_cash: number | null;
  cash_difference: number | null;
  started_at: number;
  ended_at: number | null;
  status: ShiftStatus;
}

export interface CreditAccount {
  id: string;
  business_id: string;
  customer_name: string;
  /** Primary phone for display; credits API sets this to the first of `customer_phones` */
  customer_phone: string | null;
  /** All numbers when returned from credits APIs (stored as JSON in DB column `customer_phone`) */
  customer_phones?: string[];
  total_credit: number;
  /** Prepaid store balance (usable at checkout; credited on cash overpayment when customer is linked) */
  wallet_balance: number;
  /** Loyalty points balance (earn on linked sales when business earn rate is set) */
  loyalty_points_balance?: number;
  last_transaction_at: number | null;
  created_at: number;
  /** Sum of all debt transactions; set when loaded from the credits list API */
  lifetime_debt_total?: number;
  /** User who recorded the most recent debt (credits list API) */
  last_credit_by_name?: string | null;
  last_credit_by_role?: string | null;
  last_credit_by_user_id?: string | null;
  /** Timestamp of the oldest debt that hasn't been fully paid yet */
  oldest_unpaid_debt_at?: number | null;
  /** 1 if a cashier-submitted payment is awaiting admin approval */
  has_pending_payment?: number;
}

export interface CreditTransaction {
  id: string;
  credit_account_id: string;
  sale_id: string | null;
  type: CreditTransactionType;
  amount: number;
  payment_method: CreditPaymentMethod | null;
  notes: string | null;
  recorded_by: string;
  created_at: number;
  /** Customer self-reported payment from public link; pending until admin approves */
  public_claim_status?: "pending" | "rejected" | null;
  claim_reviewed_at?: number | null;
  claim_reviewed_by?: string | null;
  /** JSON array of line items copied at debt time; used when sale/items rows are gone */
  debt_line_items_json?: string | null;
  /** Payment approval: NULL = applied/approved, 'pending' = awaiting admin approval, 'rejected' = declined */
  payment_approval_status?: "pending" | "rejected" | "approved" | null;
  /** Admin who approved/rejected the payment */
  payment_approved_by?: string | null;
  /** Timestamp when the payment was approved/rejected */
  payment_approved_at?: number | null;
}

export type LoyaltyTransactionType = "earn" | "redeem" | "adjust";

export interface LoyaltyTransaction {
  id: string;
  credit_account_id: string;
  sale_id: string | null;
  type: LoyaltyTransactionType;
  points: number;
  notes: string | null;
  recorded_by: string;
  created_at: number;
}

export interface WalletTransaction {
  id: string;
  credit_account_id: string;
  sale_id: string | null;
  type: "credit" | "debit";
  amount: number;
  notes: string | null;
  recorded_by: string;
  created_at: number;
  /** Customer-reported top-up from public link; pending until admin approves */
  public_claim_status?: "pending" | "rejected" | null;
  claim_reviewed_at?: number | null;
  claim_reviewed_by?: string | null;
  payment_method?: "cash" | "mpesa" | null;
  /** M-Pesa confirmation code or receipt reference from customer */
  customer_reference?: string | null;
}

export interface StockAdjustment {
  id: string;
  business_id: string;
  item_id: string;
  system_stock: number;
  actual_stock: number;
  difference: number;
  reason: AdjustmentReason;
  notes: string | null;
  adjusted_by: string;
  created_at: number;
}

export type StockApprovalStatus = "pending" | "approved" | "rejected";

export interface StockApprovalRequest {
  id: string;
  business_id: string;
  item_id: string;
  adjustment_type: "increase" | "decrease";
  quantity: number;
  reason: AdjustmentReason;
  notes: string | null;
  requested_by: string;
  status: StockApprovalStatus;
  approved_by: string | null;
  approved_at: number | null;
  rejection_reason: string | null;
  created_at: number;
}

export type BalanceApprovalStatus = "pending" | "approved" | "rejected";
export type BalanceType = "opening" | "closing";

export interface BalanceApprovalRequest {
  id: string;
  business_id: string;
  shift_id: string | null;
  user_id: string;
  balance_type: BalanceType;
  amount: number;
  expected_amount: number | null;
  notes: string | null;
  status: BalanceApprovalStatus;
  approved_by: string | null;
  approved_at: number | null;
  rejection_reason: string | null;
  created_at: number;
  // Denomination breakdown
  denom_1: number;
  denom_5: number;
  denom_10: number;
  denom_20: number;
  denom_40: number;
  denom_50: number;
  denom_100: number;
  denom_200: number;
  denom_500: number;
  denom_1000: number;
  // For closing balance
  cash_expenses: number;
}

export type SupplierBillStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface SupplierBill {
  id: string;
  business_id: string;
  supplier_id: string | null;
  supplier_name: string;
  supplier_phone: string | null;
  supplier_invoice_no: string | null;
  bill_description: string;
  amount: number;
  due_date: number;
  status: SupplierBillStatus;
  payment_date: number | null;
  payment_method: string | null;
  payment_notes: string | null;
  created_by: string;
  paid_by: string | null;
  notes: string | null;
  preferred_payment_method: string | null;
  payment_details: string | null;
  created_at: number;
}

export type ExpenseCategory = "fixed" | "variable";
export type ExpenseFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "one-time";

export interface Expense {
  id: string;
  business_id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: ExpenseFrequency;
  start_date: number;
  notes: string | null;
  active: number;
  include_in_drawer?: number; // 1 = include in cash drawer, 0 = exclude
  created_at: number;
  created_by: string | null;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: number;
  used: number;
  created_at: number;
}

// ============================================
// Count Shift Types (Department Stock Manager)
// ============================================

export type CountShiftStatus =
  | "open"
  | "counting"
  | "morning_complete"
  | "closed";
export type CountItemStatus = "pending" | "counted" | "not_located";
export type CountBatchStatus =
  | "pending"
  | "matched"
  | "escalated"
  | "acknowledged"
  | "dismissed"
  | "adjusted";

export interface CountShift {
  id: string;
  business_id: string;
  user_id: string;
  department: string;
  status: CountShiftStatus;
  opened_at: number;
  closed_at: number | null;
  created_at: number;
}

export interface CountBatch {
  id: string;
  count_shift_id: string;
  item_id: string;
  /** Morning count — submitted when opening the shift */
  morning_count: number | null;
  morning_count_status: CountItemStatus;
  morning_counted_at: number | null;
  /** System stock snapshot taken at shift open */
  system_stock_morning: number;
  /** Evening count — submitted when closing the shift */
  evening_count: number | null;
  evening_count_status: CountItemStatus;
  evening_counted_at: number | null;
  /** System stock snapshot taken at shift close */
  system_stock_evening: number | null;
  /** Variance analysis after shift close */
  variance_morning: number | null;
  variance_evening: number | null;
  variance_intraday: number | null;
  status: CountBatchStatus;
  escalation_notes: string | null;
  selection_source: string | null;
  stock_adjustment_id: string | null;
  created_at: number;
}

export type CountBatchEscalationActionType =
  | "dismiss"
  | "approve_adjustment";

export interface CountBatchEscalationAction {
  id: string;
  count_batch_id: string;
  business_id: string;
  action: CountBatchEscalationActionType;
  reviewed_by: string;
  reviewed_at: number;
  notes: string | null;
  stock_adjustment_id: string | null;
}

export interface CountItemPool {
  id: string;
  business_id: string;
  item_id: string;
  department: string | null;
  pinned: number; // 1 = always included
  excluded: number; // 1 = never selected
  last_selected_at: number | null;
  created_at: number;
}

// ============================================
// Helper Types
// ============================================

// For inserting new records (omit auto-generated fields)
export type InsertBusiness = Omit<Business, "created_at">;
export type InsertDomain = Omit<Domain, "created_at">;
export type InsertUser = Omit<User, "created_at">;
export type InsertCategory = Omit<Category, "created_at">;
export type InsertItem = Omit<Item, "created_at">;
export type InsertSellingPrice = Omit<SellingPrice, "created_at">;
export type InsertPurchase = Omit<Purchase, "created_at">;
export type InsertPurchaseItem = Omit<PurchaseItem, "created_at">;
export type InsertPurchaseBreakdown = Omit<PurchaseBreakdown, "confirmed_at">;
export type InsertInventoryBatch = Omit<
  InventoryBatch,
  "created_at" | "received_at"
>;
export type InsertSale = Omit<Sale, "created_at" | "sale_date">;
export type InsertSaleItem = Omit<SaleItem, "created_at">;
export type InsertShift = Omit<Shift, "started_at">;
export type InsertCreditAccount = Omit<CreditAccount, "created_at">;
export type InsertCreditTransaction = Omit<CreditTransaction, "created_at">;
export type InsertStockAdjustment = Omit<StockAdjustment, "created_at">;
export type InsertExpense = Omit<Expense, "created_at">;
export type InsertPasswordResetToken = Omit<PasswordResetToken, "created_at">;
export type InsertCountShift = Omit<CountShift, "created_at" | "opened_at">;
export type InsertCountBatch = Omit<CountBatch, "created_at">;
export type InsertCountItemPool = Omit<
  CountItemPool,
  "created_at" | "last_selected_at"
>;
