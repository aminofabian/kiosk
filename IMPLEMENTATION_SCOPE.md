# Grocery POS - Detailed Implementation Scope

> **This document breaks down the entire project into actionable steps with time estimates.**

---

## 📊 Timeline Overview

| Phase | Duration | Cumulative |
|-------|----------|------------|
| **Foundation** | 2-3 days | 2-3 days |
| **Phase 1: Selling Core** | 5-7 days | 7-10 days |
| **Phase 2: Stock Management** | 4-5 days | 11-15 days |
| **Phase 3: Profit & FIFO** | 3-4 days | 14-19 days |
| **Phase 4: Credit Sales** | 2-3 days | 16-22 days |
| **Phase 5: Shifts** | 2-3 days | 18-25 days |
| **Phase 6: Reports** | 3-4 days | 21-29 days |
| **Phase 7: Multi-Tenancy & Auth** | 4-5 days | 25-34 days |
| **Phase 8: Product Variants** | 2-3 days | 27-37 days |

**Total Estimated Time: 27-37 days (5-8 weeks part-time, 4-5 weeks full-time)**

---

## 🏗️ FOUNDATION: Project Setup

### Step 0.1: Database Setup
**Time: 2-3 hours**

**Tasks:**
1. Set up Turso account and create database
2. Get database URL and auth token from Turso dashboard
3. Install Turso client: `npm install @libsql/client`
4. Create database connection utility using libSQL client
5. Set up environment variables (`.env.local`):
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
6. Test database connection

**Files to Create:**
- `lib/db/index.ts` (database connection with Turso)
- `lib/db/sql/` (folder for SQL files)
- `.env.local` (Turso credentials)

**Deliverable:** Database connection working, ready for schema creation

---

### Step 0.2: Database Schema Implementation
**Time: 4-6 hours**

**Tasks:**
1. Create SQL schema file with all 15 tables from schema (Section 4 of grocery-pos.md)
2. Define enums (roles, payment methods, statuses, etc.)
   - **Note:** Turso uses SQLite, which doesn't have native enums
   - Use `text()` with check constraints (e.g., `CHECK (role IN ('owner', 'admin', 'cashier'))`)
   - Define enums in `lib/constants.ts` for TypeScript type safety
3. Set up foreign keys and indexes
4. Create migration runner utility
5. Run SQL to create all tables

**Turso/SQLite Considerations:**
- Use `text()` for enum fields with CHECK constraints
- UUIDs: Use `text()` type (store as strings)
- Timestamps: Use `integer()` for Unix timestamps or `text()` for ISO strings
- Decimals: Use `real()` for floating point or `text()` for exact decimals (store as strings)
- Foreign keys: Enable with `PRAGMA foreign_keys = ON;`

**Files to Create:**
- `lib/db/sql/schema.sql` (complete SQL schema)
- `lib/db/migrate.ts` (migration runner utility)
- `lib/db/index.ts` (database client + helper functions for executing SQL)
- `lib/db/types.ts` (TypeScript types matching schema)
- `lib/constants.ts` (all enums as constants)

**Database Helper Functions to Create:**
- `db.execute(sql, params)` - Execute SQL with parameters
- `db.query(sql, params)` - Query and return results
- `db.queryOne(sql, params)` - Query and return single row
- Helper for transactions (if needed)

**Tables to Create:**
- businesses
- users
- categories
- items
- selling_prices
- purchases
- purchase_items
- purchase_breakdowns
- inventory_batches
- sales
- sale_items
- shifts
- credit_accounts
- credit_transactions
- stock_adjustments

**Deliverable:** All tables exist in database, types available

---

### Step 0.3: Project Structure & Constants
**Time: 2-3 hours**

**Tasks:**
1. Create folder structure:
   ```
   /app
     /pos
     /admin
   /components
     /pos
     /admin
     /ui (shadcn components)
   /lib
     /db
     /hooks
     /stores (Zustand)
     /utils
   ```
2. Install Zustand: `npm install zustand`
3. Create constants file with all enums
4. Set up TypeScript paths in `tsconfig.json`

**Files to Create:**
- `lib/constants.ts` (all enums)
- `lib/stores/cart-store.ts` (cart state - placeholder)
- `lib/stores/user-store.ts` (user state - placeholder)

**Deliverable:** Project structure ready, constants defined

---

### Step 0.4: UI Foundation (shadcn/ui Setup)
**Time: 2-3 hours**

**Tasks:**
1. Install shadcn/ui: `npx shadcn@latest init`
2. Install essential components:
   - Button
   - Card
   - Input
   - Dialog
   - Select
   - Badge
   - Separator
3. Set up Tailwind theme for touch-friendly sizes
4. Create base layout components

**Files to Create:**
- `components/ui/` (shadcn components)
- `app/layout.tsx` (update with proper structure)

**Deliverable:** UI components ready, theme configured

---

## 🎯 PHASE 1: Selling Core (MVP)

**Goal:** Complete a sale from item selection to receipt

---

### Step 1.1: Seed Data (Categories & Items)
**Time: 2-3 hours**

**Tasks:**
1. Create seed script: `lib/db/seed.ts`
2. Create 5-10 sample categories (Vegetables, Fruits, Grains, etc.)
3. Create 20-30 sample items with:
   - Different unit types (kg, piece, bunch)
   - Dummy stock values (for Phase 1)
   - Selling prices
4. Create one dummy business
5. Run seed script

**Files to Create:**
- `lib/db/seed.ts`
- `scripts/seed.ts` (optional npm script)

**Deliverable:** Database has sample data to work with

---

### Step 1.2: Category List Component
**Time: 3-4 hours**

**Tasks:**
1. Create API route: `app/api/categories/route.ts`
2. Fetch categories (filtered by business_id - hardcoded for now)
3. Create `components/pos/CategoryList.tsx`
4. Display categories in grid/list
5. Touch-friendly buttons (min 48px height)
6. Add active state styling

**Files to Create:**
- `app/api/categories/route.ts`
- `components/pos/CategoryList.tsx`
- `lib/hooks/use-categories.ts` (optional)

**Deliverable:** Categories display, can select category

---

### Step 1.3: Item Grid Component
**Time: 4-5 hours**

**Tasks:**
1. Create API route: `app/api/items/route.ts`
2. Fetch items by category (filtered by business_id)
3. Create `components/pos/ItemGrid.tsx`
4. Display items in grid (3-4 columns)
5. Show item name, price, stock (if low, show badge)
6. Touch-friendly cards
7. Handle category selection

**Files to Create:**
- `app/api/items/route.ts`
- `components/pos/ItemGrid.tsx`
- `lib/hooks/use-items.ts` (optional)

**Deliverable:** Items display when category selected

---

### Step 1.4: Cart Store (Zustand)
**Time: 2-3 hours**

**Tasks:**
1. Create `lib/stores/cart-store.ts`
2. Define cart state:
   - items: Array<{ itemId, name, price, quantity, unitType }>
   - total: number
3. Actions:
   - addItem(item, quantity)
   - updateQuantity(itemId, quantity)
   - removeItem(itemId)
   - clearCart()
4. Persist to localStorage (optional for Phase 1)

**Files to Create:**
- `lib/stores/cart-store.ts`

**Deliverable:** Cart state management working

---

### Step 1.5: Add to Cart Flow
**Time: 3-4 hours**

**Tasks:**
1. Create `components/pos/QuantityInput.tsx`
   - For weight items: decimal keypad
   - For count items: +/- buttons + number input
2. Create `components/pos/AddToCartDialog.tsx`
   - Shows item details
   - Quantity input
   - Add button
3. Wire up ItemGrid → click item → open dialog → add to cart
4. Show cart badge/count in header

**Files to Create:**
- `components/pos/QuantityInput.tsx`
- `components/pos/AddToCartDialog.tsx`
- `components/pos/CartBadge.tsx`

**Deliverable:** Can add items to cart with quantity

---

### Step 1.6: Cart View Component
**Time: 4-5 hours**

**Tasks:**
1. Create `app/pos/cart/page.tsx`
2. Create `components/pos/CartView.tsx`
3. Display all cart items:
   - Item name, quantity, unit price, subtotal
   - Edit quantity button
   - Remove button
4. Show cart total at bottom
5. "Continue Shopping" button
6. "Checkout" button (disabled if cart empty)

**Files to Create:**
- `app/pos/cart/page.tsx`
- `components/pos/CartView.tsx`
- `components/pos/CartItem.tsx`

**Deliverable:** Can view and edit cart

---

### Step 1.7: Checkout Page (Cash Only)
**Time: 5-6 hours**

**Tasks:**
1. Create `app/pos/checkout/page.tsx`
2. Create `components/pos/CheckoutForm.tsx`
3. Display order summary (items, quantities, total)
4. Payment method selection (only Cash for Phase 1)
5. Cash received input
6. Calculate change automatically
7. "Complete Sale" button
8. Handle form validation

**Files to Create:**
- `app/pos/checkout/page.tsx`
- `components/pos/CheckoutForm.tsx`
- `components/pos/PaymentMethodSelector.tsx` (cash only for now)

**Deliverable:** Can complete cash sale

---

### Step 1.8: Sale API & Database Insert
**Time: 4-5 hours**

**Tasks:**
1. Create API route: `app/api/sales/route.ts` (POST)
2. Create sale record in database:
   - Insert into `sales` table
   - Insert into `sale_items` table (one per cart item)
   - Hardcode user_id (no auth yet)
   - Set payment_method to 'cash'
   - Calculate total from cart
3. Update item stock (simple decrement for Phase 1, no FIFO yet)
4. Clear cart after successful sale
5. Return sale ID

**Files to Create:**
- `app/api/sales/route.ts`
- `lib/db/queries/sales.ts` (raw SQL helper functions)

**Deliverable:** Sales saved to database, stock updated

---

### Step 1.9: Receipt View
**Time: 3-4 hours**

**Tasks:**
1. Create `app/pos/receipt/[id]/page.tsx`
2. Create API route: `app/api/sales/[id]/route.ts` (GET)
3. Fetch sale with items
4. Display receipt:
   - Business name (hardcoded)
   - Sale date/time
   - Items list with quantities and prices
   - Subtotal, total
   - Payment method
   - Sale ID
5. "Print" button (window.print())
6. "New Sale" button (goes back to POS)

**Files to Create:**
- `app/pos/receipt/[id]/page.tsx`
- `app/api/sales/[id]/route.ts`
- `components/pos/Receipt.tsx`

**Deliverable:** Can view receipt after sale

---

### Step 1.10: Main POS Page Integration
**Time: 3-4 hours**

**Tasks:**
1. Create `app/pos/page.tsx`
2. Layout:
   - Header with cart badge
   - Category list (left sidebar or top tabs)
   - Item grid (main area)
3. Wire up navigation:
   - Click item → add to cart
   - Click cart badge → go to cart
   - From cart → checkout
   - From checkout → receipt
4. Add loading states
5. Add error handling

**Files to Create:**
- `app/pos/page.tsx`
- `components/pos/POSLayout.tsx`

**Deliverable:** Complete POS flow working end-to-end

---

### Step 1.11: Phase 1 Testing & Polish
**Time: 4-6 hours**

**Tasks:**
1. Test complete flow:
   - Select category → select item → add to cart → checkout → receipt
2. Test edge cases:
   - Empty cart checkout
   - Zero quantity
   - Negative stock (should allow for Phase 1)
3. Fix UI/UX issues:
   - Touch target sizes
   - Loading states
   - Error messages
4. Mobile/tablet responsiveness
5. Performance check

**Deliverable:** Phase 1 complete and tested

---

## 📦 PHASE 2: Stock Management

**Goal:** Record purchases and create inventory batches

---

### Step 2.1: Purchase Recording UI
**Time: 4-5 hours**

**Tasks:**
1. Create `app/admin/purchases/page.tsx`
2. Create `components/admin/PurchaseForm.tsx`
3. Form fields:
   - Supplier name (optional)
   - Purchase date
   - Total amount
   - Extra costs
   - Notes
4. "Add Purchase Item" button
5. Purchase items list (can add multiple)
6. Each purchase item:
   - Item name (text input - free form)
   - Quantity note (e.g., "2 crates")
   - Amount
   - Link to item dropdown (optional)
7. Save purchase (status: pending)

**Files to Create:**
- `app/admin/purchases/page.tsx`
- `components/admin/PurchaseForm.tsx`
- `components/admin/PurchaseItemRow.tsx`
- `app/api/purchases/route.ts` (POST)

**Deliverable:** Can record a purchase with items

---

### Step 2.2: Purchase List View
**Time: 2-3 hours**

**Tasks:**
1. Create purchase list component
2. Show all purchases:
   - Date, supplier, total amount
   - Status badge (pending/partial/complete)
   - Actions: View, Breakdown
3. Filter by status
4. Sort by date (newest first)

**Files to Create:**
- `components/admin/PurchaseList.tsx`
- `app/api/purchases/route.ts` (GET)

**Deliverable:** Can view all purchases

---

### Step 2.3: Purchase Breakdown UI
**Time: 6-8 hours**

**Tasks:**
1. Create `app/admin/purchases/[id]/breakdown/page.tsx`
2. Show purchase details
3. For each purchase item (status: pending):
   - Show item name snapshot
   - Show quantity note
   - Show amount spent
   - Breakdown form:
     - Link to item (if not linked)
     - Usable quantity (decimal input)
     - Wastage quantity (decimal input)
     - Buy price per unit (auto-calculate: amount / usable_quantity, editable)
     - Notes
   - "Confirm Breakdown" button
4. When confirmed:
   - Create purchase_breakdown record
   - Update purchase_item status to 'broken_down'
   - Update purchase status (pending → partial → complete)

**Files to Create:**
- `app/admin/purchases/[id]/breakdown/page.tsx`
- `components/admin/BreakdownForm.tsx`
- `app/api/purchases/[id]/breakdown/route.ts` (POST)

**Deliverable:** Can break down purchase items

---

### Step 2.4: Inventory Batch Creation
**Time: 3-4 hours**

**Tasks:**
1. When breakdown is confirmed, create inventory_batch:
   - item_id from breakdown
   - initial_quantity = usable_quantity
   - quantity_remaining = usable_quantity
   - buy_price_per_unit from breakdown
   - received_at = confirmed_at
2. Update item.current_stock (increment by usable_quantity)
3. If wastage > 0, optionally create stock_adjustment (or skip for Phase 2)
4. Test batch creation

**Files to Create:**
- `lib/db/queries/inventory.ts` (raw SQL functions for batch operations)
- Update breakdown API to call this

**Deliverable:** Batches created, stock updated

---

### Step 2.5: Stock View
**Time: 3-4 hours**

**Tasks:**
1. Create `app/admin/stock/page.tsx`
2. Display all items with:
   - Name, category
   - Current stock
   - Unit type
   - Min stock level (if set)
   - Low stock indicator
3. Filter by category
4. Search by name
5. Sort by stock level (lowest first)

**Files to Create:**
- `app/admin/stock/page.tsx`
- `components/admin/StockList.tsx`
- `app/api/stock/route.ts` (GET)

**Deliverable:** Can view current stock levels

---

### Step 2.6: Phase 2 Testing
**Time: 2-3 hours**

**Tasks:**
1. Test purchase flow:
   - Record purchase → breakdown → verify batch created → verify stock updated
2. Test multiple batches for same item
3. Verify stock view shows correct numbers

**Deliverable:** Phase 2 complete

---

## 💰 PHASE 3: Profit & FIFO

**Goal:** Accurate profit tracking with FIFO batch consumption

---

### Step 3.1: FIFO Batch Selection Logic
**Time: 4-5 hours**

**Tasks:**
1. Create `lib/utils/fifo.ts`
2. Implement `getBatchesForSale(itemId, quantity)`:
   - Execute raw SQL: `SELECT * FROM inventory_batches WHERE item_id = ? AND quantity_remaining > 0 ORDER BY received_at ASC`
   - Select batches until quantity is met
   - Return array of { batchId, quantity, buyPrice }
3. Handle partial batch consumption
4. Handle insufficient stock (allow negative for now)
5. Write unit tests (optional but recommended)

**Files to Create:**
- `lib/utils/fifo.ts`
- `lib/utils/fifo.test.ts` (optional)

**Deliverable:** FIFO logic working

---

### Step 3.2: Update Sale API for FIFO
**Time: 3-4 hours**

**Tasks:**
1. Update `app/api/sales/route.ts`
2. For each cart item:
   - Call FIFO function to get batches
   - Create sale_item records (one per batch consumed)
   - Store inventory_batch_id in sale_item
   - Store buy_price_per_unit (from batch)
   - Calculate profit: (sell_price - buy_price) × quantity
   - Update batch.quantity_remaining
3. Update item.current_stock (decrement)

**Files to Create:**
- Update existing sale API (use raw SQL)
- Update `lib/db/queries/sales.ts` (raw SQL functions)

**Deliverable:** Sales use FIFO, profit calculated

---

### Step 3.3: Selling Price Management
**Time: 3-4 hours**

**Tasks:**
1. Create `app/admin/items/[id]/edit/page.tsx`
2. Form to update selling price:
   - Current price display
   - New price input
   - Effective from date (default: now)
3. On save:
   - Create new selling_prices record
   - Update item.current_sell_price (denormalized)
4. Show price history (optional for Phase 3)

**Files to Create:**
- `app/admin/items/[id]/edit/page.tsx`
- `components/admin/PriceEditForm.tsx`
- `app/api/items/[id]/price/route.ts` (POST)

**Deliverable:** Can update item prices

---

### Step 3.4: Profit Display (Basic)
**Time: 2-3 hours**

**Tasks:**
1. Update receipt to show profit per item (optional)
2. Or create simple profit view:
   - `app/admin/profit/page.tsx`
   - Show total profit for today
   - Show profit by item (sum of sale_items.profit)

**Files to Create:**
- `app/admin/profit/page.tsx` (optional)
- `app/api/profit/route.ts` (GET)

**Deliverable:** Can see profit data

---

### Step 3.5: Phase 3 Testing
**Time: 2-3 hours**

**Tasks:**
1. Test FIFO:
   - Create multiple batches with different prices
   - Make sale
   - Verify oldest batch consumed first
   - Verify profit calculated correctly
2. Test price changes don't affect past sales
3. Verify profit calculations

**Deliverable:** Phase 3 complete

---

## 💳 PHASE 4: Credit Sales

**Goal:** Allow credit sales and track customer debts

---

### Step 4.1: Credit Payment Option
**Time: 3-4 hours**

**Tasks:**
1. Update `components/pos/PaymentMethodSelector.tsx`
2. Add "Credit" option
3. When credit selected, show form:
   - Customer name (required)
   - Customer phone (optional)
4. Update checkout to handle credit
5. Update sale API to:
   - Set payment_method to 'credit'
   - Store customer_name and customer_phone

**Files to Create:**
- Update existing checkout components
- `components/pos/CreditForm.tsx`

**Deliverable:** Can select credit payment

---

### Step 4.2: Credit Account Creation
**Time: 3-4 hours**

**Tasks:**
1. On credit sale, create or update credit_account:
   - Find existing by customer_phone (if provided) or customer_name
   - If not found, create new
   - Update total_credit (increment by sale total)
2. Create credit_transaction:
   - type: 'debt'
   - amount: sale total
   - link to sale_id
3. Update sale API

**Files to Create:**
- `lib/db/queries/credits.ts` (raw SQL functions)
- Update sale API

**Deliverable:** Credit accounts created on sale

---

### Step 4.3: Outstanding Credits View
**Time: 3-4 hours**

**Tasks:**
1. Create `app/admin/credits/page.tsx`
2. List all credit_accounts with:
   - Customer name, phone
   - Total credit (outstanding balance)
   - Last transaction date
3. Click to view transactions
4. "Collect Payment" button

**Files to Create:**
- `app/admin/credits/page.tsx`
- `components/admin/CreditList.tsx`
- `app/api/credits/route.ts` (GET)

**Deliverable:** Can view outstanding credits

---

### Step 4.4: Payment Collection
**Time: 4-5 hours**

**Tasks:**
1. Create `app/admin/credits/[id]/payment/page.tsx`
2. Show customer details and balance
3. Payment form:
   - Amount (default: full balance, editable)
   - Payment method (cash/mpesa)
   - Notes
4. On submit:
   - Create credit_transaction (type: 'payment')
   - Update credit_account.total_credit (decrement)
   - If amount >= balance, mark as paid (optional flag)

**Files to Create:**
- `app/admin/credits/[id]/payment/page.tsx`
- `components/admin/PaymentForm.tsx`
- `app/api/credits/[id]/payment/route.ts` (POST)

**Deliverable:** Can collect credit payments

---

### Step 4.5: Phase 4 Testing
**Time: 2 hours**

**Tasks:**
1. Test credit sale flow
2. Test payment collection
3. Verify balances update correctly

**Deliverable:** Phase 4 complete

---

## 👤 PHASE 5: Shifts & Accountability

**Goal:** Track cashier shifts and cash differences

---

### Step 5.1: Shift Opening
**Time: 3-4 hours**

**Tasks:**
1. Create `app/pos/shift/open/page.tsx`
2. Form:
   - Opening cash amount (required)
3. On submit:
   - Create shift record (status: 'open')
   - Store opening_cash
   - Store started_at
   - Redirect to POS
4. Check if shift already open (prevent duplicates)

**Files to Create:**
- `app/pos/shift/open/page.tsx`
- `components/pos/ShiftOpenForm.tsx`
- `app/api/shifts/route.ts` (POST)

**Deliverable:** Can open shift

---

### Step 5.2: Link Sales to Shifts
**Time: 2-3 hours**

**Tasks:**
1. Update sale API to:
   - Get current open shift for user
   - Link sale to shift (shift_id)
2. Update expected_closing_cash calculation:
   - opening_cash + sum of cash sales in shift
3. Update shift on each sale

**Files to Create:**
- Update sale API (raw SQL)
- `lib/db/queries/shifts.ts` (raw SQL functions)

**Deliverable:** Sales linked to shifts

---

### Step 5.3: Shift Closing
**Time: 4-5 hours**

**Tasks:**
1. Create `app/pos/shift/close/page.tsx`
2. Show shift summary:
   - Opening cash
   - Expected closing cash
   - Number of sales
   - Total sales amount
3. Form:
   - Actual closing cash (counted physically)
4. On submit:
   - Calculate cash_difference
   - Update shift (status: 'closed', ended_at, actual_closing_cash, cash_difference)
5. Show difference (positive/negative)

**Files to Create:**
- `app/pos/shift/close/page.tsx`
- `components/pos/ShiftCloseForm.tsx`
- `app/api/shifts/[id]/close/route.ts` (POST)

**Deliverable:** Can close shift

---

### Step 5.4: Shift History
**Time: 2-3 hours**

**Tasks:**
1. Create `app/admin/shifts/page.tsx`
2. List all shifts:
   - Date, cashier name
   - Opening/closing cash
   - Cash difference (highlight if not zero)
   - Status
3. Filter by user, date range

**Files to Create:**
- `app/admin/shifts/page.tsx`
- `components/admin/ShiftList.tsx`
- `app/api/shifts/route.ts` (GET)

**Deliverable:** Can view shift history

---

### Step 5.5: Phase 5 Testing
**Time: 2 hours**

**Tasks:**
1. Test shift open → sales → shift close
2. Verify cash calculations
3. Test multiple shifts

**Deliverable:** Phase 5 complete

---

## 📊 PHASE 6: Reports & Insights

**Goal:** Provide actionable business insights

---

### Step 6.1: Daily Sales Summary
**Time: 3-4 hours**

**Tasks:**
1. Create `app/admin/dashboard/page.tsx`
2. Show today's summary:
   - Total sales (count, amount)
   - Total profit
   - Profit margin %
   - Top 5 items by sales
   - Low stock alerts
3. Date picker to view other days

**Files to Create:**
- `app/admin/dashboard/page.tsx`
- `components/admin/DashboardStats.tsx`
- `app/api/dashboard/route.ts` (GET)

**Deliverable:** Dashboard with daily summary

---

### Step 6.2: Sales Report
**Time: 4-5 hours**

**Tasks:**
1. Create `app/admin/reports/sales/page.tsx`
2. Filters:
   - Date range
   - Payment method
   - Cashier
3. Table:
   - Sale ID, date, cashier, items, total, payment method
4. Export to CSV (optional)

**Files to Create:**
- `app/admin/reports/sales/page.tsx`
- `components/admin/SalesReport.tsx`
- `app/api/reports/sales/route.ts` (GET)

**Deliverable:** Sales report with filters

---

### Step 6.3: Profit Report
**Time: 4-5 hours**

**Tasks:**
1. Create `app/admin/reports/profit/page.tsx`
2. Show profit by:
   - Period (day/week/month)
   - Item (top profit items, loss-making items)
   - Category
3. Charts (optional, use recharts or similar)
4. Profit margin trends

**Files to Create:**
- `app/admin/reports/profit/page.tsx`
- `components/admin/ProfitReport.tsx`
- `app/api/reports/profit/route.ts` (GET)

**Deliverable:** Profit analysis reports

---

### Step 6.4: Stock Adjustments
**Time: 4-5 hours**

**Tasks:**
1. Create `app/admin/stock/adjust/page.tsx`
2. Stock take form:
   - Select item
   - Show system stock
   - Enter actual stock
   - System calculates difference
   - Select reason (spoilage, theft, etc.)
   - Notes
3. On submit:
   - Create stock_adjustment record
   - Update item.current_stock
   - Update inventory_batches if needed (optional)

**Files to Create:**
- `app/admin/stock/adjust/page.tsx`
- `components/admin/StockAdjustmentForm.tsx`
- `app/api/stock/adjust/route.ts` (POST)

**Deliverable:** Can record stock adjustments

---

### Step 6.5: Restock Alerts
**Time: 2-3 hours**

**Tasks:**
1. Add restock alerts to dashboard
2. Query items where current_stock <= min_stock_level
3. Show list with:
   - Item name
   - Current stock
   - Min level
   - Days since last purchase (optional)

**Files to Create:**
- Update dashboard
- `app/api/stock/alerts/route.ts` (GET)

**Deliverable:** Restock alerts visible

---

### Step 6.6: Phase 6 Testing
**Time: 2-3 hours**

**Tasks:**
1. Test all reports
2. Verify calculations
3. Test filters

**Deliverable:** Phase 6 complete

---

## 🔐 PHASE 7: Multi-Tenancy & Auth

**Goal:** Secure multi-tenant system with proper authentication

---

### Step 7.1: Authentication Setup
**Time: 4-5 hours**

**Tasks:**
1. Install NextAuth.js or similar: `npm install next-auth`
2. Set up authentication:
   - Email/password login
   - Session management
3. Create login page: `app/login/page.tsx`
4. Create middleware to protect routes
5. Set up password hashing (bcrypt)

**Files to Create:**
- `app/login/page.tsx`
- `app/api/auth/[...nextauth]/route.ts`
- `middleware.ts`
- `lib/auth/config.ts`

**Deliverable:** Authentication working

---

### Step 7.2: Business Registration
**Time: 3-4 hours**

**Tasks:**
1. Create `app/register/page.tsx`
2. Form:
   - Business name
   - Owner name
   - Email
   - Password
   - Currency (default: KES)
3. On submit:
   - Create business
   - Create user (role: owner)
   - Auto-login

**Files to Create:**
- `app/register/page.tsx`
- `components/auth/RegisterForm.tsx`
- `app/api/auth/register/route.ts` (POST)

**Deliverable:** Can register new business

---

### Step 7.3: User Management (Owner Only)
**Time: 4-5 hours**

**Tasks:**
1. Create `app/admin/users/page.tsx`
2. List all users in business
3. Add user form:
   - Name, email, role, PIN (4 digits)
4. Edit user (change role, deactivate)
5. Delete user (soft delete: set active=false)

**Files to Create:**
- `app/admin/users/page.tsx`
- `components/admin/UserList.tsx`
- `components/admin/UserForm.tsx`
- `app/api/users/route.ts` (GET, POST, PUT, DELETE)

**Deliverable:** Can manage users

---

### Step 7.4: Role-Based Access Control
**Time: 3-4 hours**

**Tasks:**
1. Create `lib/auth/permissions.ts`
2. Define permission checks:
   - canSell()
   - canViewProfit()
   - canManageItems()
   - etc.
3. Add middleware/guards to protected routes
4. Hide UI elements based on role
5. Add API route protection

**Files to Create:**
- `lib/auth/permissions.ts`
- Update middleware
- Update API routes

**Deliverable:** RBAC enforced

---

### Step 7.5: PIN-Based Cashier Login
**Time: 2-3 hours**

**Tasks:**
1. Create `app/pos/login/page.tsx`
2. Simple PIN entry (4 digits)
3. Find user by PIN and business_id
4. Create session
5. Redirect to POS

**Files to Create:**
- `app/pos/login/page.tsx`
- `components/pos/PINLogin.tsx`
- `app/api/auth/pin/route.ts` (POST)

**Deliverable:** Cashiers can login with PIN

---

### Step 7.6: Business Context & Scoping
**Time: 3-4 hours**

**Tasks:**
1. Update all API routes to:
   - Get business_id from session
   - Filter all SQL queries by business_id (add WHERE business_id = ?)
2. Create `lib/hooks/use-business.ts`
3. Update all database query functions to include business_id in WHERE clauses
4. Test data isolation

**Files to Create:**
- Update all API routes (raw SQL with business_id filtering)
- `lib/hooks/use-business.ts`
- Update all query functions (raw SQL)

**Deliverable:** Complete data isolation

---

### Step 7.7: Phase 7 Testing
**Time: 3-4 hours**

**Tasks:**
1. Test registration → login → use system
2. Test role permissions
3. Test data isolation (create 2 businesses, verify separation)
4. Security audit (no cross-tenant access)

**Deliverable:** Phase 7 complete, system secure

---

## 📦 PHASE 8: Product Variants

> **Goal:** Support product variations (size, strain, unit type) with independent pricing and stock tracking.

### Step 8.1: Schema Update for Variants
**Time: 1-2 hours**

**Tasks:**
1. Add `parent_item_id` column to items table (nullable, self-referential FK)
2. Add `variant_name` column to items table (e.g., "Big", "Small", "Per Kg", "Per Piece")
3. Create migration script for existing databases
4. Update `Item` TypeScript interface with new fields
5. Add index for parent_item_id lookups

**Schema Changes:**
```sql
ALTER TABLE items ADD COLUMN parent_item_id TEXT;
ALTER TABLE items ADD COLUMN variant_name TEXT;
CREATE INDEX idx_items_parent ON items(parent_item_id);
```

**Rules:**
- **Parent items**: `parent_item_id = NULL`, `variant_name = NULL`, `current_stock = 0`, `current_sell_price = 0`
- **Variant items**: `parent_item_id` set, `variant_name` set, has real stock/price
- Parent items are display containers; only variants are sellable
- Each variant has its own `unit_type`, `current_sell_price`, and `current_stock`

**Files to Modify:**
- `lib/db/sql/schema.sql`
- `lib/db/types.ts`
- `lib/db/migrate-item-variants.ts` (new)

**Deliverable:** Schema supports parent/variant relationship

---

### Step 8.2: Items API Update
**Time: 2-3 hours**

**Tasks:**
1. Update GET `/api/items` with new query parameters:
   - `parentsOnly=true` - Return only parent items (for admin management)
   - `parentId={id}` - Return variants of a specific parent
   - `sellableOnly=true` - Return only sellable items (variants + standalone)
2. Update POST `/api/items` to support:
   - `isParent: true` - Create parent item (container)
   - `parentItemId` - Create variant under parent
   - `variantName` - Variant display name
3. Update GET `/api/items/[id]` to include variant count and variants list
4. Update PUT `/api/items/[id]` to handle variant name updates

**Example Structures:**
```
Tomatoes (parent)
├── Per Kg (variant) - unit: kg, price: 100, stock: 50kg
└── Per Piece (variant) - unit: piece, price: 10, stock: 200pcs

Eggs (parent)
├── Per Piece (variant) - unit: piece, price: 15, stock: 500pcs
└── Per Tray (variant) - unit: tray, price: 400, stock: 20 trays

Beans (parent)
├── Red Kidney (variant) - unit: kg, price: 150, stock: 30kg
└── Black-eyed (variant) - unit: kg, price: 120, stock: 25kg
```

**Files to Modify:**
- `app/api/items/route.ts`
- `app/api/items/[id]/route.ts`

**Deliverable:** API supports full parent/variant CRUD

---

### Step 8.3: Admin Items UI Update
**Time: 3-4 hours**

**Tasks:**
1. Update ItemForm with mode selector (Standalone / Parent / Variant)
2. Parent mode: simplified form (name, category only - no price/stock)
3. Variant mode: parent selector + variant name + full price/stock fields
4. Update items list to show expandable parent items with variants
5. Add "Add Variant" button on parent item details
6. Show variant count badge on parent items
7. Visual distinction (purple ring/badge) for parent items

**UI Flow - Creating Product with Variants:**
1. Create parent item (e.g., "Tomatoes") - select category only
2. Click parent → "Add Variant"
3. Enter variant name ("Per Kg"), unit type, price, stock
4. Repeat for other variants ("Per Piece")

**Files to Modify:**
- `components/admin/ItemForm.tsx`
- `app/admin/items/page.tsx`

**Deliverable:** Admin can create and manage parent items with variants

---

### Step 8.4: POS Variant Selection
**Time: 2-3 hours**

**Tasks:**
1. Update ItemGrid to identify parent items (show badge, different styling)
2. Create VariantSelector drawer component
3. When parent item clicked → open VariantSelector showing all variants
4. Each variant shows: name, unit type, price, stock available
5. Selecting variant → opens AddToCartDialog with that variant
6. Separate available vs out-of-stock variants in selector
7. Update mobile POS view with same functionality

**POS Flow:**
```
Category Selected → Show Items (parents + standalone)
                 ↓
User taps "Tomatoes" (parent)
                 ↓
Variant Drawer Opens:
  ├── Per Kg - KES 100/kg - 50kg available
  └── Per Piece - KES 10/piece - 200 available
                 ↓
User selects "Per Kg" → Add to Cart Dialog
```

**Files to Create:**
- `components/pos/VariantSelector.tsx`

**Files to Modify:**
- `components/pos/ItemGrid.tsx`
- `app/pos/page.tsx`

**Deliverable:** POS supports variant selection flow

---

### Step 8.5: Reports & Dashboard Update
**Time: 1-2 hours**

**Tasks:**
1. Update profit API with `groupByParent` option to aggregate variant sales
2. Update dashboard API to optionally group top items by parent
3. Add variant_name and parent_name to report results
4. Exclude parent items from low stock alerts (they don't have stock)
5. Update dashboard UI to show variant info where relevant

**Files to Modify:**
- `app/api/profit/route.ts`
- `app/api/dashboard/route.ts`

**Deliverable:** Reports correctly handle variants

---

### Step 8.6: Phase 8 Testing
**Time: 2-3 hours**

**Tasks:**
1. Test creating parent item with multiple variants
2. Test different unit types per variant (kg, piece, tray)
3. Test POS flow: select parent → choose variant → add to cart
4. Test sales recording with variant items
5. Test profit reports with variant aggregation
6. Test stock tracking per variant
7. Verify existing standalone items still work

**Test Scenarios:**
- Create "Tomatoes" with "Per Kg" and "Per Piece" variants
- Sell 2kg of tomatoes, verify correct variant's stock decreases
- Check profit report shows individual variant and aggregated parent totals

**Deliverable:** Phase 8 complete, variants fully functional

---

## 🎨 POLISH & DEPLOYMENT

### Step 9.1: UI/UX Polish
**Time: 4-6 hours**

**Tasks:**
1. Responsive design (tablet/mobile)
2. Loading states everywhere
3. Error handling and messages
4. Empty states
5. Animations (subtle)
6. Accessibility (keyboard nav, screen readers)

**Deliverable:** Polished UI

---

### Step 9.2: Performance Optimization
**Time: 3-4 hours**

**Tasks:**
1. Add database indexes (CREATE INDEX statements)
2. Optimize SQL queries (avoid N+1, use JOINs where needed)
3. Add caching where appropriate
4. Image optimization
5. Code splitting

**Deliverable:** Fast, optimized app

---

### Step 9.3: Testing & Bug Fixes
**Time: 4-6 hours**

**Tasks:**
1. End-to-end testing
2. Edge case testing
3. Bug fixes
4. User acceptance testing (if possible)

**Deliverable:** Stable, tested system

---

### Step 9.4: Deployment
**Time: 2-3 hours**

**Tasks:**
1. Set up Vercel project
2. Configure Turso database (already set up, just add env vars)
3. Add environment variables to Vercel:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
4. Deploy
5. Test production

**Deliverable:** Live application

---

## 📝 NOTES

### Dependencies Between Steps

- **Step 0.1-0.4** must be done first (foundation)
- **Step 1.1** (seed data) needed before **Step 1.2**
- **Step 1.4** (cart store) needed before **Step 1.5**
- **Step 2.3** (breakdown) needed before **Step 2.4** (batches)
- **Step 3.1** (FIFO) needed before **Step 3.2** (sale API update)
- **Step 7.1** (auth) needed before **Step 7.2-7.6**
- **Step 8.1** (schema) needed before **Step 8.2-8.5**
- **Step 8.2** (API) needed before **Step 8.3-8.4**

### Time Estimates Assumptions

- **Part-time**: 4-6 hours/day
- **Full-time**: 8 hours/day
- Estimates assume intermediate React/Next.js knowledge
- Add 20-30% buffer for unexpected issues

### What to Start With

**Today:**
1. Step 0.1: Database Setup
2. Step 0.2: Schema Implementation
3. Step 0.3: Project Structure
4. Step 0.4: UI Foundation

**This Week:**
- Complete Foundation (Steps 0.1-0.4)
- Start Phase 1 (Steps 1.1-1.4)

**Next Week:**
- Complete Phase 1 (Steps 1.5-1.11)
- Start Phase 2

---

## ✅ CHECKLIST TEMPLATE

Copy this for each step:

```
[ ] Step X.X: [Name]
  [ ] Task 1
  [ ] Task 2
  [ ] Task 3
  [ ] Files created
  [ ] Tested
  [ ] Committed to git
```

---

**Remember:** Follow the CURSOR RULES in grocery-pos.md. Stay in phase. Don't skip ahead.

