import type {
  UserRole,
  UnitType,
  PaymentMethod,
  SaleStatus,
  PurchaseStatus,
  PurchaseItemStatus,
  AdjustmentReason,
  ShiftStatus,
  CreditTransactionType,
  CreditPaymentMethod,
} from '@/lib/constants';

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
  created_at: number;
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

export interface Item {
  id: string;
  business_id: string;
  category_id: string;
  parent_item_id: string | null; // null for parent items or standalone items
  name: string;
  variant_name: string | null; // e.g., "Big", "Small", "Red Kidney" (null for parent items)
  unit_type: UnitType;
  current_stock: number; // REAL in SQLite
  min_stock_level: number | null;
  current_sell_price: number;
  image_url: string | null;
  active: number; // 1 = true, 0 = false
  created_at: number;
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

export interface Purchase {
  id: string;
  business_id: string;
  recorded_by: string;
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

export interface InventoryBatch {
  id: string;
  business_id: string;
  item_id: string;
  source_breakdown_id: string | null;
  initial_quantity: number;
  quantity_remaining: number;
  buy_price_per_unit: number;
  received_at: number;
  created_at: number;
}

export interface Sale {
  id: string;
  business_id: string;
  user_id: string;
  shift_id: string | null;
  total_amount: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  voided_reason: string | null;
  voided_by: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: number;
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
  customer_phone: string | null;
  total_credit: number;
  last_transaction_at: number | null;
  created_at: number;
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

// ============================================
// Helper Types
// ============================================

// For inserting new records (omit auto-generated fields)
export type InsertBusiness = Omit<Business, 'created_at'>;
export type InsertDomain = Omit<Domain, 'created_at'>;
export type InsertUser = Omit<User, 'created_at'>;
export type InsertCategory = Omit<Category, 'created_at'>;
export type InsertItem = Omit<Item, 'created_at'>;
export type InsertSellingPrice = Omit<SellingPrice, 'created_at'>;
export type InsertPurchase = Omit<Purchase, 'created_at'>;
export type InsertPurchaseItem = Omit<PurchaseItem, 'created_at'>;
export type InsertPurchaseBreakdown = Omit<PurchaseBreakdown, 'confirmed_at'>;
export type InsertInventoryBatch = Omit<InventoryBatch, 'created_at' | 'received_at'>;
export type InsertSale = Omit<Sale, 'created_at' | 'sale_date'>;
export type InsertSaleItem = Omit<SaleItem, 'created_at'>;
export type InsertShift = Omit<Shift, 'started_at'>;
export type InsertCreditAccount = Omit<CreditAccount, 'created_at'>;
export type InsertCreditTransaction = Omit<CreditTransaction, 'created_at'>;
export type InsertStockAdjustment = Omit<StockAdjustment, 'created_at'>;

