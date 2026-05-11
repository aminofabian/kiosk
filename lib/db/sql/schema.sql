-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================
-- 1. businesses (Tenants/Kiosks)
-- ============================================
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  settings TEXT, -- JSON stored as TEXT
  credit_settings TEXT DEFAULT '{}', -- JSON: { allow_new_credit_accounts: bool }
  active INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = suspended
  loyalty_points_per_kes REAL NOT NULL DEFAULT 0.01, -- 0 = off in settings; default 0.01 ≈ 1 pt per 100 KES
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================
-- 1.5. super_admins (Platform Administrators)
-- ============================================
CREATE TABLE IF NOT EXISTS super_admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);

-- ============================================
-- 1.6. domains (Domain-to-Business Mapping)
-- ============================================
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE, -- e.g., "biashara.co.ke", "shop.kiosk.co.ke"
  business_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0, -- 1 = primary domain, 0 = secondary
  active INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = suspended
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
CREATE INDEX IF NOT EXISTS idx_domains_business_id ON domains(business_id);
CREATE INDEX IF NOT EXISTS idx_domains_active ON domains(domain, active);

-- ============================================
-- 2. users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'cashier')),
  pin TEXT, -- 4-digit PIN for quick login
  active INTEGER NOT NULL DEFAULT 1, -- 1 = true, 0 = false
  can_give_credit INTEGER NOT NULL DEFAULT 0, -- 1 = allowed to give credit on POS
  created_by TEXT, -- user who created this user (null for owners/self-registered)
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(business_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(business_id, email);

-- ============================================
-- 3. categories
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  icon TEXT, -- emoji or icon name
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_business_id ON categories(business_id);
CREATE INDEX IF NOT EXISTS idx_categories_position ON categories(business_id, position);

-- ============================================
-- 4. items (Products with Variant Support)
-- ============================================
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  parent_item_id TEXT, -- nullable, self-referential for variants
  name TEXT NOT NULL,
  variant_name TEXT, -- e.g., "Big", "Small", "Red Kidney" (null for parent items)
  unit_type TEXT NOT NULL CHECK (unit_type IN ('kg', 'g', 'piece', 'bunch', 'tray', 'litre', 'ml')),
  item_type TEXT NOT NULL DEFAULT 'retail',
  current_stock REAL NOT NULL DEFAULT 0, -- denormalized for speed
  min_stock_level REAL, -- nullable
  current_sell_price REAL NOT NULL DEFAULT 0, -- denormalized for speed
  image_url TEXT,
  packaging_unit_name TEXT, -- e.g., "Carton", "Sack", "Crate" (bulk packaging unit name)
  packaging_unit_qty REAL, -- items per packaging unit (e.g., 18 packets per carton)
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (parent_item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_business_id ON items(business_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_active ON items(business_id, active);
CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_item_id);
CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(business_id, item_type);

-- ============================================
-- 5. selling_prices (Price History)
-- ============================================
CREATE TABLE IF NOT EXISTS selling_prices (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  price REAL NOT NULL,
  effective_from INTEGER NOT NULL DEFAULT (unixepoch()),
  set_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (set_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_selling_prices_item_id ON selling_prices(item_id);
CREATE INDEX IF NOT EXISTS idx_selling_prices_effective_from ON selling_prices(item_id, effective_from DESC);

-- ============================================
-- 6. suppliers (Vendors/Markets)
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  location TEXT,
  notes TEXT,
  supplier_type TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE(business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(business_id, active);

-- ============================================
-- 6.5. buying_prices (Cost Price History)
-- ============================================
CREATE TABLE IF NOT EXISTS buying_prices (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  supplier_id TEXT,
  price REAL NOT NULL,
  effective_from INTEGER NOT NULL DEFAULT (unixepoch()),
  set_by TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (set_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_buying_prices_item_supplier ON buying_prices(item_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_buying_prices_effective ON buying_prices(item_id, supplier_id, effective_from DESC);

-- ============================================
-- 7. purchases (Buying Trips)
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  supplier_id TEXT,
  supplier_name TEXT, -- kept for backward compatibility
  purchase_date INTEGER NOT NULL, -- Unix timestamp
  total_amount REAL NOT NULL,
  extra_costs REAL NOT NULL DEFAULT 0, -- transport, tips, etc.
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'complete')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_business_id ON purchases(business_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(business_id, status);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(business_id, purchase_date DESC);

-- ============================================
-- 8. purchase_items (Raw Purchase Notes)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL,
  item_id TEXT, -- nullable, may not be linked yet
  item_name_snapshot TEXT NOT NULL, -- preserves what was written
  quantity_note TEXT NOT NULL, -- e.g., "2 crates", "1 bag"
  amount REAL NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'broken_down')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id ON purchase_items(item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_status ON purchase_items(purchase_id, status);

-- ============================================
-- 9. purchase_breakdowns (Truth Emerges)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_breakdowns (
  id TEXT PRIMARY KEY,
  purchase_item_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  usable_quantity REAL NOT NULL,
  wastage_quantity REAL NOT NULL DEFAULT 0,
  buy_price_per_unit REAL NOT NULL,
  notes TEXT,
  confirmed_by TEXT NOT NULL,
  confirmed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchase_breakdowns_purchase_item_id ON purchase_breakdowns(purchase_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_breakdowns_item_id ON purchase_breakdowns(item_id);

-- ============================================
-- 10. inventory_batches (Cost Tracking - FIFO Source)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_batches (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  source_breakdown_id TEXT, -- nullable for initial stock batches
  batch_number TEXT, -- human-readable e.g. TOM-20260308-01
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'deactivated')),
  supplier_id TEXT,
  initial_quantity REAL NOT NULL,
  quantity_remaining REAL NOT NULL,
  buy_price_per_unit REAL NOT NULL,
  received_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expiry_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (source_breakdown_id) REFERENCES purchase_breakdowns(id) ON DELETE RESTRICT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_business_id ON inventory_batches(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_item_id ON inventory_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_fifo ON inventory_batches(item_id, received_at ASC, quantity_remaining);

-- ============================================
-- 11. sales
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL, -- cashier
  shift_id TEXT, -- nullable
  total_amount REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'credit', 'split')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
  voided_reason TEXT,
  voided_by TEXT,
  customer_name TEXT, -- for credit sales
  customer_phone TEXT, -- for credit sales
  sale_date INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(business_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(business_id, status);

-- ============================================
-- 12. sale_items (Profit Locked Here)
-- ============================================
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  inventory_batch_id TEXT, -- nullable, for FIFO tracking
  quantity_sold REAL NOT NULL,
  sell_price_per_unit REAL NOT NULL, -- COPIED at sale time
  buy_price_per_unit REAL NOT NULL, -- COPIED from batch at sale time
  profit REAL NOT NULL, -- CALCULATED and STORED
  item_type_snapshot TEXT, -- Type at time of sale (no CHECK; types from settings)
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_item_id ON sale_items(item_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch_id ON sale_items(inventory_batch_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_type ON sale_items(item_type_snapshot);

-- ============================================
-- 12.5. sale_payments (Split Payment Support)
-- ============================================
CREATE TABLE IF NOT EXISTS sale_payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'credit', 'wallet')),
  amount REAL NOT NULL,
  customer_name TEXT, -- for credit portion
  customer_phone TEXT, -- for credit portion
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);

-- ============================================
-- 13. shifts (Cashier Accountability)
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  opening_cash REAL NOT NULL,
  expected_closing_cash REAL NOT NULL DEFAULT 0, -- calculated
  actual_closing_cash REAL,
  cash_difference REAL,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  ended_at INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_shifts_business_id ON shifts(business_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(business_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(business_id, started_at DESC);

-- ============================================
-- 14. credit_accounts (Customer Debts + Wallet)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_accounts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT, -- JSON array of strings, e.g. ["0712…","0733…"]; legacy plain text ok until migrated
  total_credit REAL NOT NULL DEFAULT 0, -- running balance
  wallet_balance REAL NOT NULL DEFAULT 0, -- prepaid store credit (overpayment / top-ups)
  loyalty_points_balance INTEGER NOT NULL DEFAULT 0,
  last_transaction_at INTEGER,
  oldest_unpaid_debt_at INTEGER, -- timestamp of the oldest debt still unpaid
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- ============================================
-- 14b. wallet_transactions (customer store wallet ledger)
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  credit_account_id TEXT NOT NULL,
  sale_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount REAL NOT NULL,
  notes TEXT,
  recorded_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  public_claim_status TEXT,
  claim_reviewed_at INTEGER,
  claim_reviewed_by TEXT,
  payment_method TEXT,
  customer_reference TEXT,
  FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (claim_reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_account ON wallet_transactions(credit_account_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_sale ON wallet_transactions(sale_id);

-- ============================================
-- 14c. loyalty_transactions (earn / redeem / adjust)
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id TEXT PRIMARY KEY,
  credit_account_id TEXT NOT NULL,
  sale_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust')),
  points INTEGER NOT NULL,
  notes TEXT,
  recorded_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON loyalty_transactions(credit_account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_sale ON loyalty_transactions(sale_id);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_business_id ON credit_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_phone ON credit_accounts(business_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_name ON credit_accounts(business_id, customer_name);

-- ============================================
-- 15. credit_transactions (tab debt / payments)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  credit_account_id TEXT NOT NULL,
  sale_id TEXT, -- nullable, if debt created from sale
  type TEXT NOT NULL CHECK (type IN ('debt', 'payment')),
  amount REAL NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'mpesa')), -- nullable, only for payments
  notes TEXT,
  recorded_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  public_claim_status TEXT, -- NULL = normal; 'pending' = customer self-report awaiting admin; 'rejected' = declined
  claim_reviewed_at INTEGER,
  claim_reviewed_by TEXT,
  debt_line_items_json TEXT, -- snapshot of sale lines when debt recorded (survives sale delete / null sale_id)
  payment_approval_status TEXT CHECK (payment_approval_status IN ('pending', 'rejected', 'approved')), -- NULL = approved/applied
  payment_approved_by TEXT, -- user who approved/rejected the payment
  payment_approved_at INTEGER, -- timestamp when approved/rejected
  FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (claim_reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_account_id ON credit_transactions(credit_account_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_sale_id ON credit_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_date ON credit_transactions(credit_account_id, created_at DESC);

-- ============================================
-- 15b. public_credit_pesapal_pending (M-Pesa prompt / Pesapal STK for public credit links)
-- ============================================
CREATE TABLE IF NOT EXISTS public_credit_pesapal_pending (
  id TEXT PRIMARY KEY,
  credit_account_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  order_tracking_id TEXT NOT NULL UNIQUE,
  merchant_reference TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL,
  balance_snapshot REAL NOT NULL,
  kind TEXT NOT NULL DEFAULT 'tab' CHECK (kind IN ('tab', 'wallet')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  applied_at INTEGER,
  FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_public_credit_pesapal_pending_account ON public_credit_pesapal_pending(credit_account_id);
CREATE INDEX IF NOT EXISTS idx_public_credit_pesapal_pending_tracking ON public_credit_pesapal_pending(order_tracking_id);

-- ============================================
-- 16. stock_adjustments
-- ============================================
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  system_stock REAL NOT NULL,
  actual_stock REAL NOT NULL,
  difference REAL NOT NULL, -- actual_stock - system_stock
  reason TEXT NOT NULL CHECK (reason IN ('restock', 'spoilage', 'theft', 'counting_error', 'damage', 'other')),
  notes TEXT,
  adjusted_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_business_id ON stock_adjustments(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item_id ON stock_adjustments(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date ON stock_adjustments(business_id, created_at DESC);

-- ============================================
-- 17. expenses (Operating Costs)
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fixed', 'variable')),
  amount REAL NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'one-time')),
  start_date INTEGER NOT NULL,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  include_in_drawer INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_by TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_active ON expenses(business_id, active);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- ============================================
-- External HTTP API keys (integrations, mobile backends)
-- ============================================
CREATE TABLE IF NOT EXISTS external_api_keys (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  label TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at INTEGER,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_external_api_keys_business_id ON external_api_keys(business_id);
CREATE INDEX IF NOT EXISTS idx_external_api_keys_token_hash ON external_api_keys(token_hash);
