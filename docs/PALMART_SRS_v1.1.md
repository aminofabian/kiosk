# Palmart Mini Mart — Comprehensive Business & Systems Requirements Specification (SRS)

**Version:** 1.1  
**Owner:** Fabian Amino  
**Business Name:** Palmart Mini Mart  
**Location:** Mirema Drive, Safari Park Gardens Area, Nairobi, Kenya  
**Document Type:** Business + Operations + Technology + Growth Blueprint  
**Supersedes:** SRS v1.0 / v2.0 vision-only drafts, `PALMART_SRS_SUPPLEMENT.md`

**Structure**

| Part | Sections | Content |
|------|----------|---------|
| **I** | §1–25 | Business vision, store layout, roadmap |
| **II** | Appendices A–P | Operations spec mapped to Palmart POS |

**Related docs:** `PALMART_LAUNCH_CHECKLIST.md` (printable), `DEPARTMENT_SUPPLY_MANAGEMENT.md`, `DEPARTMENT_CYCLE_COUNT.md`, `DEPARTMENT_FORWARD_CASHIER_FLOW_GAPS.md`

---

# Launch Checklist — Staff Onboarding (One Page)

> **Print this page.** Standalone copy: [`PALMART_LAUNCH_CHECKLIST.md`](./PALMART_LAUNCH_CHECKLIST.md) · Full detail in Part II (Appendices A–P).  
> **Store:** Mirema Drive · **System:** Palmart POS · **Currency:** KES · **Payments:** Cash · M-Pesa · Tab · Wallet

## Before doors open (Owner — one-time setup)

| ☐ | Task | Where |
|---|------|-------|
| ☐ | Add product types: `retail`, `produce`, `grocery`, `dairy` | Admin → Settings |
| ☐ | Tag every item with correct `item_type` (match store zone) | Admin → Items |
| ☐ | Create aisles: Entrance · Produce Bench · Dry Goods · Chillers · Till | Admin → Aisles |
| ☐ | Create users: 2× cashier, dept staff, sourcing/admin | Admin → Users |
| ☐ | Dept staff: role `department_staff`, types `produce` + `grocery` | Admin → Users |
| ☐ | Cashiers: set PIN; enable `can_give_credit` only if needed | Admin → Users |
| ☐ | Add suppliers; assign to departments for PO workflow | Admin → Department Supply |
| ☐ | Set loyalty rate (or 0 to disable) | Admin → Settings |
| ☐ | Test M-Pesa STK on one small sale | POS checkout |

## Store zones → who sells what

| Zone | Products | Who sells | App |
|------|----------|-----------|-----|
| **A** Entrance | Snacks, soda, water | Cashier | `/pos` |
| **B** Produce | Veg, fruits, dhania | Dept staff → **Forward** | `/department` |
| **C** Dry goods | Rice, beans, spices | Dept staff → **Forward** | `/department` |
| **D** Chillers | Milk, yogurt, cold drinks | Cashier (+ dept restock) | `/pos` / `/department` |
| **E** Till | Payment only | Cashier | `/pos` |

## Cashier — first shift

| ☐ | Do this |
|---|---------|
| ☐ | Log in at `/pos` (email or PIN) |
| ☐ | **Open shift** — count float by denomination (incl. KES 40 note) |
| ☐ | Wait for admin balance approval if prompted |
| ☐ | Sell Zone A / D items directly; scan barcode or tap item |
| ☐ | **Pending orders** panel — resume dept-forwarded carts, then checkout |
| ☐ | Payments: Cash · M-Pesa · Tab (if allowed) · Wallet · Split |
| ☐ | Returns: POS returns → cash / M-Pesa / wallet / credit note |
| ☐ | **Close shift** — recount cash; note any variance |
| ☐ | Never share PIN; never view profit screens |

## Department staff — first shift

| ☐ | Do this |
|---|---------|
| ☐ | Log in at `/department` on phone |
| ☐ | **Sell** tab — add produce/grocery items for customer |
| ☐ | Tap **Forward to cashier** (you cannot take payment) |
| ☐ | **Stock** tab — record spoilage, damage, theft same day |
| ☐ | **Supply** tab — create PO only for assigned suppliers |
| ☐ | **Records** — petty expenses, losses |
| ☐ | Watch notification when cashier completes your order |

## Opening (every day)

| ☐ | Cashier: open shift + float count |
| ☐ | Admin: approve opening balance if required |
| ☐ | Restock Zone A; check chillers |
| ☐ | Dept: record overnight wastage before selling |

## Closing (every day)

| ☐ | Dept: record day's spoilage / damage |
| ☐ | Cashier: close shift + cash count |
| ☐ | Admin: approve close; review variance ≤ **KES 200** target |
| ☐ | Owner: daily report (`/admin/reports/daily`) + M-Pesa reconcile |

## Payments quick reference

| Method | When | Drawer? |
|--------|------|---------|
| Cash | Walk-in default | Yes |
| M-Pesa | STK at checkout | No |
| Tab | Regular customer on credit | No |
| Wallet | Customer prepaid balance | No |
| Split | Cash + M-Pesa | Cash part only |

**Rule:** Wallet applies first, then other payment for the balance.

## When something goes wrong

| Problem | Action |
|---------|--------|
| Dept order stuck pending | Cashier: Pending panel → Resume |
| Wrong stock count | Dept/admin: Stock adjust with reason |
| Cashier stock change | Request approval — admin approves queue |
| Customer pays tab later | `/c/[phone]` or Admin → Credits |
| Internet down | POS: cash sales queue offline; sync when back |
| Report numbers look wrong | Use **completed** sales only (not pending forwards) |

## Emergency contacts

| Role | Name | Phone |
|------|------|-------|
| Owner | Fabian Amino | _fill in_ |
| Admin / sourcing | _fill in_ | _fill in_ |

---

*Continue to §1 Executive Summary for full business vision · Appendix N for detailed open/close lists*

---

# 1. Executive Summary

Palmart is not intended to be a traditional neighborhood shop.

It is designed as a **modern, technology-driven neighborhood retail ecosystem** combining:

* Physical Mini Mart
* Grocery Store
* Fresh Produce Market
* Local Delivery Service
* Inventory Intelligence Platform
* Customer Loyalty Platform
* E-commerce Store
* Future POS SaaS Product

The long-term vision is:

> Build the operating system for small and medium retail businesses in Kenya.

The physical mini mart serves as the proof of concept and testing ground.

Everything that succeeds inside Palmart eventually becomes a feature inside the Palmart POS platform.

---

# 2. Business Vision

## Mission

To make neighborhood shopping faster, more affordable, and more convenient while providing retailers with enterprise-level tools.

## Vision

To become:

* The most organized mini mart in the Mirema area
* The most technology-enabled neighborhood retailer
* The blueprint for thousands of future Palmart-powered stores

---

# 3. Store Concept

Palmart is a hybrid between:

* Mini Mart
* Grocery Store
* Fresh Produce Shop
* Convenience Store
* Last-mile Delivery Hub

The store focuses on daily essentials.

---

# 4. Physical Store Layout

Current estimated dimensions:

Width: ~1.3m

Length: ~4m

### Store Zones

---

## Zone A — Entrance & Fast Movers

Products:

* Soft drinks
* Water
* Snacks
* Biscuits
* Sweets

Purpose:

Impulse purchases.

---

## Zone B — Fresh Produce

Products:

* Tomatoes
* Onions
* Garlic
* Avocados
* Spinach
* Kales
* Cabbages
* Dhania
* Fruits

Purpose:

Daily household purchases.

---

## Zone C — Cereals & Dry Foods

Products:

* Rice
* Beans
* Green grams
* Lentils
* Maize
* Wheat products

Purpose:

Higher basket value purchases.

---

## Zone D — Refrigeration

Equipment:

* Two 3-door chillers

Products:

* Soda
* Juice
* Milk
* Yogurt
* Energy drinks

Purpose:

Traffic driver.

---

## Zone E — Checkout Area

Two-cashier setup.

Counter Length:

~1.5m

Features:

* Dual cashier stations
* Shared customer loading zone
* Customer bagging area
* Receipt printing area

---

# 5. Product Categories

---

## Fresh Produce

Examples:

* Tomatoes
* Onions
* Garlic
* Ginger
* Avocados
* Kales
* Spinach
* Dhania
* Cabbage
* Beetroot
* Carrots
* Courgettes
* Cucumbers

Characteristics:

* Daily replenishment
* Fast spoilage
* Requires waste tracking

---

## Fruits

Examples:

* Pineapple
* Watermelon
* Mangoes
* Oranges
* Bananas

---

## Cereals

Examples:

* Rice
* Beans
* Green grams
* Ndengu
* Kamande

---

## Beverages

Examples:

* Soda
* Water
* Juice
* Energy drinks

---

## Dairy

Examples:

* Milk
* Yogurt

---

## Spices

Examples:

* Garlic
* Ginger
* Ukwaju
* Mishiri

---

## Household

Examples:

* Cleaning products
* Detergents
* Lotion
* Soap

---

## Stationery (Future)

Examples:

* Books
* Pens
* Pencils
* Photocopy paper

---

# 6. Customer Segments

---

## Students

Area:

Mirema

Needs:

* Snacks
* Drinks
* Stationery

---

## Families

Needs:

* Weekly groceries
* Vegetables
* Fruits

---

## Working Professionals

Needs:

* Convenience
* Delivery

---

## Walk-in Customers

Needs:

* Fast checkout

---

### Customer Segment Features (To Build)

- Customer type field on credit accounts: `regular` | `student` | `family` | `professional` | `wholesale` | `vip`
- Segment-based analytics dashboard
- Segment-specific promotions and pricing
- Segment filters on sales and profit reports

---

# 7. Operating Model

---

## Daily Opening

Staff records:

* Opening cash
* Float denominations

System records:

* Opening shift

---

## Daily Sales

Every sale:

* Recorded
* Timestamped
* User tracked

---

## Daily Closing

System calculates:

* Cash expected
* Sales totals
* Expenses
* Variances

---

# 8. Inventory Management Philosophy

Inventory is the heart of Palmart.

Goal:

Know:

* What was purchased
* What was sold
* What was damaged
* What was stolen
* What expired

At any moment.

---

# 9. Stock Lifecycle

Supplier Purchase

↓

Stock Intake

↓

Inventory

↓

Shelf Placement

↓

Sale

↓

Stock Reduction

↓

Profit Calculation

---

# 10. Inventory Adjustments

Reasons:

### Damage

Examples:

* Broken bottle
* Rotten tomato

---

### Theft

Examples:

* Employee theft
* Shoplifting

---

### Expiry

Examples:

* Spoiled milk

---

### Internal Use

Examples:

* Consumed by staff

---

# 11. Supplier Management

Track:

* Suppliers
* Bills
* Deliveries
* Outstanding balances

---

## Supplier Bill Workflow

Create Bill

↓

Add Products

↓

Receive Stock

↓

Update Inventory

↓

Track Payment

---

### Supplier Management Features (To Build)

- Supplier payment tracking dashboard with overdue bills
- Supplier performance metrics (on-time delivery rate, quality ratings)
- Supplier price comparison tool across vendors
- Auto-create purchase orders from low-stock alerts

---

# 12. Batch Tracking

Every stock intake creates a batch.

Track:

* Purchase cost
* Quantity
* Supplier
* Expiry date

Benefits:

* FIFO
* Margin calculations
* Expiry alerts

---

### Batch Tracking Features (To Build)

- Automated expiry alerts at configurable thresholds (7 days, 3 days, 1 day before expiry)
- Batch-level margin reporting (profit per batch per supplier)
- FEFO (First Expiry First Out) option for perishable produce alongside FIFO

---

# 13. Profit System

---

## Item Profit

Profit =
Selling Price − Cost Price

---

## Product Profit

Profit =
Profit × Quantity Sold

---

## Daily Profit

Sales
− Cost of Goods Sold

=

Gross Profit

---

## Net Profit

Gross Profit
− Expenses

=

Net Profit

---

### Profit Features (To Build)

- Margin analysis per category and per supplier
- Profit trend charts (daily, weekly, monthly)
- Most / least profitable product rankings
- Break-even analysis dashboard

---

# 14. Expense Management

Examples:

* Rent
* Salaries
* Water
* Electricity
* Internet
* Licenses
* Packaging

Track:

Daily

Weekly

Monthly

Yearly

---

### Expense Features (To Build)

- Expense categorization templates for mini mart use case
- Budget vs. actual expense comparison
- Recurring expense automation (auto-log monthly rent, salaries)
- Expense-to-revenue ratio dashboard

---

# 15. Staff Structure

Current:

### Owner

Fabian

Responsibilities:

* Strategy
* Procurement
* Technology

---

### Cashier

Responsibilities:

* Sales
* Customer service
* Process returns (with manager approval for high-value items)

---

### Delivery & Grocery Staff

Responsibilities:

* Deliveries
* Shelf replenishment
* Stock receiving
* Zone organization

---

### Market Sourcing Staff

Responsibilities:

* Produce sourcing
* Supplier relationship management
* Market price intelligence

---

### Staff Features (To Build)

- "Delivery Staff" role with delivery assignment tracking
- "Market Sourcing Staff" role with purchase order creation permissions
- Staff performance dashboard: sales per cashier, deliveries per driver
- Staff attendance and shift scheduling

---

# 16. Role Permissions

## Admin

Everything.

---

## Cashier

Can:

* Sell
* Process returns (requires PIN confirmation for refunds)
* Record walk-in customer details

Cannot:

* View profits

---

## Department Staff

Can:

* Prepare carts (pending sales forwarded to cashier)
* Create invoices / purchase orders
* Record damages
* Record theft
* Update stock (permission-based)
* Record stock takes

Cannot:

* Finalize sales
* View profits
* Access financial reports

---

## Delivery Staff (New Role)

Can:

* View assigned delivery orders
* Update delivery status
* Record delivery fees collected

Cannot:

* Access POS terminal
* View financial data

---

## Market Sourcing Staff (New Role)

Can:

* Create purchase orders
* Record supplier prices
* Receive stock into inventory

Cannot:

* Finalize sales
* View profit data

---

# 17. Customer Loyalty System

Track:

* Purchase history
* Visit frequency
* Lifetime spend
* Loyalty points earned and redeemed

Benefits:

* Personalized promotions
* Repeat business
* Customer tier advancement

---

### Loyalty Features (To Build)

- Customer profile page showing full purchase history with line items
- Visit frequency metric (visits per week/month)
- Lifetime spend widget on customer profile
- Customer tier system: Regular → Silver → Gold → VIP based on spend thresholds
- Tier-based automatic discounts
- Promotion targeting engine: filter customers by segment, frequency, spend, last visit date
- Loyalty points redemption at checkout

---

# 18. Delivery System

Customers can:

* Order remotely via phone, WhatsApp, or e-commerce site

Staff can:

* Deliver locally within Mirema / Safari Park Gardens area

Track:

* Order
* Driver
* Status
* Delivery fee

---

### Delivery Features (To Build)

**Database Schema:**

```sql
CREATE TABLE delivery_orders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  sale_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_fee REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  assigned_driver_id TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  delivered_at INTEGER,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_driver_id) REFERENCES users(id) ON DELETE SET NULL
);
```

**API Endpoints:**

- `POST /api/delivery` — Create delivery order
- `GET /api/delivery` — List delivery orders (filterable by status, driver, date)
- `PATCH /api/delivery/[id]` — Update delivery status
- `GET /api/delivery/[id]` — Get delivery details

**UI Pages:**

- `app/admin/delivery/page.tsx` — Delivery management dashboard
- `components/pos/DeliveryOrderForm.tsx` — Create delivery from POS
- `components/admin/DeliveryList.tsx` — Delivery order list with status filters

**Delivery Staff View:**

- `app/delivery/page.tsx` — Driver's assigned deliveries
- Delivery status update buttons
- Delivery fee collection tracking

---

# 19. E-Commerce Platform

Domain:

Palmart.co.ke

Capabilities:

* Browse products
* Order online
* Delivery requests
* Promotions

---

### E-Commerce Features (To Build)

**Public Storefront:**

- `app/(public)/page.tsx` — Product catalog with category filtering
- `app/(public)/product/[id]/page.tsx` — Product detail page
- `app/(public)/cart/page.tsx` — Shopping cart
- `app/(public)/checkout/page.tsx` — Checkout with delivery/pickup options

**Customer Account:**

- Customer registration with phone number (OTP verification)
- Order history view
- Loyalty points balance
- Saved delivery addresses

**API Endpoints:**

- `GET /api/public/products` — Browse products with category/price filters and search
- `GET /api/public/products/[id]` — Product detail
- `POST /api/public/orders` — Place order (creates pending sale + delivery order)
- `GET /api/public/orders/[id]` — Order status
- `GET /api/public/promotions` — Active promotions

**Inventory Sync:**

- Real-time stock availability shown on public storefront
- Auto-hide out-of-stock products
- Low-stock badge ("Only 3 left!")

**Payment:**

- M-Pesa STK push integration via Pesapal (already partially integrated)
- Cash on delivery option
- Wallet balance payment for logged-in customers

---

# 20. Analytics System

---

## Sales Analytics

Track:

* Hourly sales
* Daily sales
* Weekly sales

### To Build:

- Hourly sales heatmap (time-of-day analysis)
- Day-of-week comparison
- Week-over-week growth rate
- Sales by payment method breakdown
- Sales by product category pie chart

---

## Customer Analytics

Track:

* Customers served
* Average basket size
* Peak hours

### To Build:

- Average basket size metric (total sales ÷ number of transactions)
- Peak hour identification (busiest 2-hour windows)
- Customer retention rate (repeat customers ÷ total customers)
- New vs. returning customer ratio

---

## Inventory Analytics

Track:

* Fast movers
* Slow movers
* Dead stock

### To Build:

- Fast mover leaderboard (top 20 items by sales velocity, units/day)
- Slow mover identification (items not sold in last 30 days)
- Dead stock report (items with zero sales in 60+ days, with current stock value)
- Stock turnover ratio per category
- Days of inventory remaining per product
- Wastage rate tracking (spoilage + damage ÷ total stock)

---

## Staff Analytics

Track:

* Sales per cashier
* Shift performance

### To Build:

- Sales per cashier dashboard (total value, item count, transactions)
- Average transaction value per cashier
- Shift comparison: sales by shift (morning vs. afternoon vs. evening)
- Department staff purchase order volume tracking

---

# 21. Security System

---

## CCTV

Purpose:

* Theft prevention
* Incident investigations

Note: CCTV is a physical hardware procurement and installation task, not a software feature. Recommended: 2-4 IP cameras covering entrance, checkout, produce zone, and rear storage.

---

## Audit Logs

Every action:

* User
* Timestamp
* Before
* After

Recorded permanently.

### Audit Log Features (To Build)

- Activity log viewer with advanced filtering (user, action type, date range, item)
- Export audit logs to CSV/PDF
- Anomaly detection alerts (unusual void patterns, large stock adjustments)
- Daily audit summary email to owner

---

# 22. Reporting System

Reports:

### Sales

Daily

Weekly

Monthly

### To Build:

- Weekly aggregated sales report with comparison to previous week
- Monthly sales trend report with year-over-year comparison
- Sales report export to PDF and CSV
- Sales by category breakdown report

---

### Inventory

Current stock

Low stock

Expiry

### To Build:

- Dedicated low stock report page (items at or below min_stock_level)
- Expiry report: items expiring within 7 days, 30 days, already expired
- Stock valuation report (current stock × cost price per item)
- Stock movement report (ins, outs, adjustments per period)

---

### Financial

Profit

Expenses

Margins

### To Build:

- Margin analysis per product, per category, per supplier
- Profit & Loss statement (revenue − COGS − expenses)
- Cash flow summary (cash in − cash out per period)
- Expense breakdown by category and frequency

---

# 23. Automation Layer

Future automation:

### Low Stock Alerts

Notify when stock falls below minimum.

**Implementation:**

- Scheduled job (cron / Vercel Cron) checking all items against `min_stock_level`
- Push notification to admin dashboard
- Optional: SMS alert to owner for critical items
- Auto-generate suggested purchase order with recommended quantities

---

### Expiry Alerts

Notify when products approach expiry.

**Implementation:**

- Daily check of `inventory_batches.expiry_date`
- Alert at configurable thresholds: 7 days, 3 days, 1 day before expiry
- Dashboard notification badge
- Expired products report with estimated loss value

---

### Supplier Reorder Suggestions

Based on sales velocity.

**Implementation:**

- Calculate daily sales velocity per item (units sold ÷ days since first sale)
- Project days until stockout: current stock ÷ daily velocity
- When days until stockout < reorder threshold, suggest purchase quantity
- Group suggestions by supplier for efficient ordering

---

### Demand Forecasting

Predict future purchases.

**Implementation:**

- 7-day moving average of daily sales per product
- Simple exponential smoothing for trend
- Weekend/weekday adjustment factor
- Seasonality detection (monthly patterns)

---

# 24. Palmart POS (Future SaaS)

Palmart store becomes:

## Living Laboratory

Every feature tested internally first.

Examples:

* Inventory
* Batch tracking
* Cashier flow
* Reporting
* Procurement

After validation:

Released to customers.

---

### SaaS Features (To Build)

- **Multi-tenant onboarding flow:** Self-service business registration with business type selection
- **Subscription billing:** Monthly/annual plans with tiered features (Basic, Pro, Enterprise)
- **Feature flags per plan:** Inventory limits, user count limits, report access per tier
- **White-labeling:** Custom domain support, business logo, receipt branding per tenant
- **Trial period:** 14-day free trial with full features
- **Tenant analytics dashboard:** Platform-wide metrics for superadmin
- **API access tiers:** External API key management with rate limiting per plan

---

# 25. Growth Roadmap

## Phase 1

Build operational excellence.

Focus:

* Inventory accuracy
* Staff discipline
* Customer retention

---

## Phase 2

Launch online ordering.

Focus:

* Deliveries
* WhatsApp ordering

---

## Phase 3

Launch Palmart POS.

Focus:

* Other mini marts

---

## Phase 4

Regional Expansion

New branches:

* Roysambu
* Zimmerman
* Kahawa West
* Githurai

---

## Phase 5

Retail Ecosystem

Services:

* POS
* E-commerce
* Supplier marketplace
* Delivery network
* Loyalty network

---

# Final Definition

Palmart is not merely a mini mart.

It is a **retail innovation lab disguised as a neighborhood store**.

The physical shop is the testing ground. The POS system is the product. The customer base is the dataset. The operations are the experiment.

The long-term outcome is a scalable retail technology company that can power thousands of small retailers across Kenya while simultaneously operating its own highly optimized chain of neighborhood stores.

---

# PART II — Operations & Systems Specification

> Maps Part I (business vision) to Palmart POS implementation. Feature tags: **LIVE** · **PARTIAL** · **PLANNED** · **FUTURE**

Each feature is tagged:

| Tag | Meaning |
|-----|---------|
| **LIVE** | Operating in Palmart POS today |
| **PARTIAL** | Built but incomplete or has known gaps |
| **PLANNED** | Specified; not yet in production |
| **FUTURE** | Roadmap item |

---

## Appendix A — Feature Status Matrix

| Module | Capability | Status | Notes |
|--------|------------|--------|-------|
| **POS** | Category/item grid, barcode scan | LIVE | Offline item cache via IndexedDB |
| **POS** | Multi-cart, save/resume pending sales | LIVE | Cloud-synced open carts |
| **POS** | Bundle pricing ("3 for KES X") | LIVE | Per-item configuration |
| **POS** | Manual price override | LIVE | Manager authorization for below-cost |
| **POS** | Sell out of stock | LIVE | Business setting + PIN override |
| **POS** | Offline cash sales | PARTIAL | Queued sync; M-Pesa needs network |
| **Payments** | Cash | LIVE | |
| **Payments** | M-Pesa (Pesapal STK) | LIVE | |
| **Payments** | Split (cash + M-Pesa) | LIVE | |
| **Payments** | Credit/tab | LIVE | Per-cashier `can_give_credit` flag |
| **Payments** | Store wallet | LIVE | Applied before other payment methods |
| **Payments** | Cart-level discounts | PLANNED | Permission exists; no checkout UI |
| **Shifts** | Open/close with KES denominations | LIVE | Includes KES 40 note |
| **Shifts** | Balance approval workflow | LIVE | Admin approves opening/closing counts |
| **Shifts** | Cash variance on close | LIVE | Expected vs counted |
| **Customers** | Credit/tab accounts (phone ID) | LIVE | |
| **Customers** | Prepaid wallet | LIVE | |
| **Customers** | Loyalty points earn | LIVE | `loyalty_points_per_kes` in settings |
| **Customers** | Loyalty redeem at checkout | PLANNED | Schema only |
| **Customers** | Public portal `/c/[phone]` | LIVE | Balance, M-Pesa top-up, payment claims |
| **Customers** | Customer analytics | LIVE | Peak hours (Kenya UTC+3), basket bands |
| **Returns** | Partial/full returns | LIVE | Cash, M-Pesa, wallet, credit note |
| **Returns** | Loyalty reversal on return | LIVE | |
| **Inventory** | FIFO batch costing | LIVE | `inventory_batches` → `sale_items.profit` |
| **Inventory** | Expiry on batches | LIVE | |
| **Inventory** | Min stock level field | LIVE | Automated alerts not built |
| **Inventory** | Stock take (admin) | LIVE | Immediate mutation |
| **Inventory** | Stock adjustments | LIVE | Direct for admin/dept; approval for cashier |
| **Inventory** | Out-of-stock requests | LIVE | Demand signal when item unavailable |
| **Inventory** | Aisles / floor mapping | LIVE | Admin configuration |
| **Inventory** | Barcode audit, price stickers | LIVE | Operational tooling |
| **Inventory** | Packaging units (carton/sack) | LIVE | Bulk buy, retail sell |
| **Procurement** | Owner buying trips | LIVE | Fuzzy lines → breakdown → stock |
| **Procurement** | Supplier bills (structured) | LIVE | Immediate stock receipt + AP |
| **Procurement** | Department PO workflow | PARTIAL | Draft → approve → deliver; in active build |
| **Procurement** | Supplier ↔ department assignment | PARTIAL | Admin board exists |
| **Procurement** | Supplier price comparison | LIVE | |
| **Department** | Mobile workspace `/department` | LIVE | |
| **Department** | Product-type scoping | LIVE | `users.department` JSON |
| **Department** | Forward order to cashier | PARTIAL | Works; reporting gaps on pending sales |
| **Department** | Stock adjustments & losses | LIVE | Spoilage, theft, damage, expiry |
| **Department** | Petty expenses | LIVE | |
| **Department** | Department P&L analysis | LIVE | Revenue, COGS, losses, supply spend |
| **Department** | Supply PO create/submit/deliver | PARTIAL | APIs + UI in progress |
| **Department** | Cycle count (morning/evening) | PLANNED | Full spec in `DEPARTMENT_CYCLE_COUNT.md` |
| **Department** | Real-time SSE notifications | LIVE | Order forwarded, loaded, completed |
| **Finance** | Expenses (fixed/variable/recurring) | LIVE | |
| **Finance** | FIFO gross profit | LIVE | |
| **Finance** | Net profit (gross − expenses) | LIVE | |
| **Finance** | Supplier AP tracking | LIVE | Bills pending/overdue/paid |
| **Finance** | Credit AR tracking | LIVE | |
| **Reporting** | Sales by hour/day/week | LIVE | |
| **Reporting** | Profit by product type | LIVE | Configurable types (grocery, bakery, etc.) |
| **Reporting** | Daily executive report | LIVE | |
| **Reporting** | AI narrative insights | LIVE | Kenyan SME context |
| **Reporting** | Shift performance per cashier | LIVE | |
| **Reporting** | Activity audit log | LIVE | User, action, before/after JSON |
| **Security** | Role-based access | LIVE | 5 roles + granular permissions |
| **Security** | PIN login for POS | LIVE | |
| **Platform** | Multi-tenant SaaS | LIVE | Businesses, domains, superadmin |
| **Platform** | External API keys | LIVE | Owner-created integrations |
| **E-commerce** | Online storefront | FUTURE | `palmart.co.ke` — not built |
| **Delivery** | Order routing, driver, fees | FUTURE | |
| **Delivery** | WhatsApp ordering | FUTURE | Phase 2 |
| **Compliance** | VAT / KRA eTIMS | FUTURE | Not in system |
| **Promotions** | Pricing rules / coupons | FUTURE | Banners are marketing images only |
| **Multi-branch** | Stock transfers, branch P&L | FUTURE | Single `business_id` today |

---

## Appendix B — Payment Methods & Daily Reconciliation

### B.1 Supported Payment Methods

| Method | Code | When used | Stock deducted | Shift impact |
|--------|------|-----------|----------------|--------------|
| Cash | `cash` | Walk-in default | On `completed` | Increases drawer expected |
| M-Pesa | `mpesa` | STK push via Pesapal | On `completed` | No cash drawer impact |
| Credit/tab | `credit` | Known customer on account | On `completed` | No cash; increases AR |
| Wallet | `wallet` | Prepaid balance | On `completed` | Reduces wallet balance |
| Split | `split` | Cash + M-Pesa (or other combo) | On `completed` | Cash portion only affects drawer |

**Status:** LIVE

### B.2 Checkout Payment Order

When a customer has a linked credit account with wallet balance:

1. Apply **wallet** first (up to sale total).
2. Remaining balance paid via cash, M-Pesa, credit tab, or split.

### B.3 Split Payment Rules

- At least one payment line required.
- Sum of split lines must equal amount due (after wallet).
- Each line: `payment_method` + `amount`.
- Cash portion recorded in `sale_payments` for shift reconciliation.

### B.4 Shift Cash Reconciliation (SOP)

**Opening (cashier)**

1. Count float by denomination (KES 1, 5, 10, 20, 40, 50, 100, 200, 500, 1000).
2. Record in system → opens shift.
3. If business requires it: admin **balance approval** before shift is active.

**During shift**

- Every completed cash sale increases expected drawer cash.
- Cash refunds/returns decrease expected cash.
- M-Pesa, credit, and wallet sales do not affect drawer.

**Closing (cashier)**

1. Count physical cash by denomination.
2. System shows: opening float + cash sales − cash refunds = **expected cash**.
3. Enter counted cash → system calculates **variance**.
4. Admin may require **balance approval** on close.

**Acceptance criteria (recommended)**

| Metric | Target |
|--------|--------|
| Unexplained shift variance | ≤ KES 200 per shift |
| Variance without note | Requires admin review |
| Unapproved opening shift | Cashier cannot sell |

**Status:** LIVE (balance approval LIVE)

### B.5 End-of-Day Payment Reconciliation (admin)

| Check | Source |
|-------|--------|
| Cash total | Sum of completed cash sales + cash split portions |
| M-Pesa total | Sum of M-Pesa sales + M-Pesa split portions |
| Credit extended | New credit sales minus payments received |
| Wallet used | Sum of wallet-applied amounts at checkout |
| Shift variances | `/admin/shifts` |

### B.6 M-Pesa Specifics (Kenya)

- Primary digital payment for Palmart customers.
- STK push initiated at POS checkout or public credit portal.
- Offline POS: M-Pesa unavailable until network returns; cash-only fallback.
- Reconciliation: compare Pesapal records with `sales` where `payment_method IN ('mpesa', 'split')`.

---

## Appendix C — Customer Account Model

### C.1 Customer Identity

| Field | Rule |
|-------|------|
| Primary ID | Kenyan mobile number (normalized) |
| Display name | Optional `customer_name` on sale or credit account |
| Lookup | POS: search by phone; public: `/c/[phone]` |

**Status:** LIVE

### C.2 Account Types

| Type | Purpose | Balance semantics |
|------|---------|-------------------|
| **Credit/tab** | Buy now, pay later | Positive = customer owes store |
| **Wallet** | Prepaid store credit | Positive = store owes customer (spendable) |
| **Loyalty** | Repeat-purchase reward | Points balance; earn rate configurable |

A single `credit_accounts` row can hold tab debt, wallet balance, and loyalty points.

### C.3 Credit/Tab Rules

| Rule | Detail |
|------|--------|
| Who can extend credit | Cashiers with `can_give_credit = 1` only |
| New accounts | Business setting `allow_new_credit_accounts` |
| Payment collection | Admin credits page; public self-report + admin approval |
| Public top-up | M-Pesa STK on `/c/[phone]` |

**Status:** LIVE

### C.4 Wallet Rules

| Rule | Detail |
|------|--------|
| Top-up | Admin manual entry or customer M-Pesa on public portal |
| Spend | Auto-applied at checkout before other payment |
| Refund destination | Returns can credit wallet |

**Status:** LIVE

### C.5 Loyalty Rules

| Rule | Detail | Status |
|------|--------|--------|
| Earn rate | `loyalty_points_per_kes` (e.g. 0.01 = 1 pt per KES 100) | LIVE |
| Earn trigger | Completed sale linked to credit account | LIVE |
| Redeem at checkout | Points → discount | PLANNED |
| Adjustments | Admin manual add/deduct | LIVE |

### C.6 Public Customer Portal (`/c/[phone]`)

Customers can:

- View tab balance, wallet balance, loyalty points
- Pay tab or top up wallet via M-Pesa STK
- Self-report cash/M-Pesa payment (pending admin approval)

**Status:** LIVE

---

## Appendix D — Department ↔ Cashier Order Lifecycle

### D.1 Why This Exists

Palmart's physical layout separates **produce/dry-goods prep** (Zones B, C) from **checkout** (Zone E). Department staff build customer orders; cashiers handle payment and final accountability.

### D.2 Roles in the Flow

| Actor | Surface | Responsibility |
|-------|---------|----------------|
| Department staff | `/department` mobile app | Browse dept items, build cart, forward to cashier |
| Cashier | `/pos` | Resume pending order, take payment, print receipt |
| Admin | `/admin` | Monitor pending carts, department activity |

### D.3 Sale State Machine

```
┌─────────┐    forward     ┌─────────┐    resume      ┌──────────────┐
│  (none) │ ─────────────► │ pending │ ─────────────► │ in_cashier   │
└─────────┘                └─────────┘                │ cart         │
                              │                       └──────┬───────┘
                              │ discard                     │ checkout
                              ▼                             ▼
                         ┌──────────┐                 ┌───────────┐
                         │ discarded│                 │ completed │
                         └──────────┘                 └───────────┘
```

| Status | Meaning | Stock deducted | Payment recorded | Counts in sales reports |
|--------|---------|----------------|------------------|-------------------------|
| `pending` | Forwarded by department; awaiting cashier | No | No | **Should not** (see gap below) |
| `discarded` | Cancelled before checkout | No | No | No |
| `completed` | Paid at till | Yes (FIFO) | Yes | Yes |
| `voided` | Voided after completion | Reversed | Reversed | Excluded |

**Status:** PARTIAL — state machine exists; reporting sanitization in progress

### D.4 Intended Step-by-Step SOP

**Department staff**

1. Open department app → Sell tab.
2. Add items scoped to assigned types (`produce`, `grocery`).
3. Tap **Forward to cashier**.
4. Cart clears locally; order appears in cashier queue.
5. Monitor status via notifications: pending → in cart → completed.

**Cashier**

1. Open POS → Pending orders panel.
2. **Resume** or **Add here** → items load into active cart.
3. Optional: edit quantities, add impulse items (Zone A).
4. Select customer (credit/wallet) if applicable.
5. Complete checkout (cash / M-Pesa / credit / split).
6. Stock deducted; FIFO profit locked; receipt printed.

### D.5 Known Gap (must fix before trusting reports)

Forwarded orders currently create a `sales` row immediately with placeholder `payment_method = 'cash'`. Until fixed:

- Filter reports to `status = 'completed'` only for revenue.
- Do not use unfiltered sales totals for daily P&L.

**Target fix:** `sale_date = NULL` and `payment_method = 'unpaid'` while `pending`; set both on completion only.

### D.6 Department Staff Permissions

| Can | Cannot |
|-----|--------|
| Build cart, forward to cashier | Process payment |
| Record damage, theft, spoilage, expiry | Open/close cashier shift |
| Create supply records / POs (scoped) | View store-wide profit |
| Record petty expenses | Void completed sales |
| View own forwarded order status | Manage users or settings |

**Status:** LIVE

---

## Appendix E — Procurement & Supply Paths

Palmart uses **three distinct procurement paths**. Staff must know which path applies.

### E.1 Path Comparison

| Path | Typical buyer | Input style | Approval | Stock timing | Best for |
|------|---------------|-------------|----------|--------------|----------|
| **A. Buying trip** | Owner/admin | Fuzzy lines ("2 crates tomatoes") | None | After breakdown | Market runs, ad-hoc produce |
| **B. Supplier bill** | Admin | Structured lines + costs | Optional | Immediate on save | Known SKUs, repeat suppliers |
| **C. Department PO** | Department staff | Structured lines, estimated cost | Admin approve before order | On delivery record | Delegated dept ordering |

### E.2 Path A — Owner Buying Trip

**Status:** LIVE

```
Record purchase trip (supplier, date, fuzzy lines)
        ↓
Per line: breakdown → catalogue item + usable qty + wastage + buy price
        ↓
Creates inventory_batch (FIFO cost layer)
        ↓
Updates items.current_stock
```

**Palmart use cases**

- Morning produce run (tomatoes, dhania, kale)
- Ad-hoc market sourcing when PO path is too slow

**Key fields on breakdown**

| Field | Purpose |
|-------|---------|
| Usable quantity | Sellable stock |
| Wastage quantity | Shrinkage at intake (not sold) |
| Buy price per unit | FIFO cost |
| Expiry date | Optional batch expiry |

### E.3 Path B — Supplier Bill

**Status:** LIVE

```
Create supplier bill (supplier, line items, costs, optional expiry)
        ↓
Stock received immediately
        ↓
Creates inventory_batches + updates current_stock
        ↓
Bill status: pending → paid (AP tracking)
```

**Palmart use cases**

- Packaged goods from fixed distributors (beverages, detergents)
- Dairy deliveries with invoice

### E.4 Path C — Department Purchase Order

**Status:** PARTIAL

```
Admin assigns supplier(s) to department_key (e.g. grocery)
        ↓
Staff creates PO (draft) → structured lines (item, qty, est. cost)
        ↓
Submit → approval_status: pending_approval
        ↓
Admin approves or rejects (with reason)
        ↓
Staff records delivery → breakdown → inventory_batches + stock-in
```

**Palmart use cases**

- Produce staff orders from assigned wholesaler
- Bakery staff orders flour supplier (future product type)

**Guardrails**

| Rule | Rationale |
|------|-----------|
| Staff see only assigned suppliers | Prevents unauthorized vendors |
| PO required before large orders | Cost control |
| Delivery must reference approved PO | Reconciliation |
| Admin sees all departments | Oversight |

### E.5 When to Use Which Path (decision tree)

```
Is the buyer owner/admin on a market run?
  YES → Path A (buying trip)
  NO → Is it a repeat supplier with an invoice?
    YES → Path B (supplier bill) OR Path C if dept-initiated
    NO → Path C (dept PO) if staff-initiated; else Path A
```

### E.6 Supplier Management (all paths)

| Track | Status |
|-------|--------|
| Supplier profile (name, phone, location) | LIVE |
| Outstanding bill balances | LIVE |
| Supplier ↔ product cost links | LIVE |
| Supplier ↔ department assignment | PARTIAL |
| Supplier price comparison report | LIVE |

---

## Appendix F — Inventory & Costing Model

### F.1 Units of Measure

| Unit | Typical products |
|------|------------------|
| `kg` | Tomatoes, onions, rice |
| `g` | Spices, small weights |
| `piece` | Soda, soap, avocado |
| `bunch` | Dhania, spinach |
| `tray` | Eggs |
| `litre` / `ml` | Milk, cooking oil |

**Status:** LIVE

### F.2 FIFO Batch Model

Every stock intake creates an `inventory_batch`:

| Field | Purpose |
|-------|---------|
| `item_id` | Catalogue product |
| `quantity` | Units in batch |
| `buy_price` | Cost per unit |
| `supplier_id` | Source |
| `expiry_date` | Optional |
| `purchase_breakdown_id` | Link to intake record |

On sale: oldest batch consumed first → `sale_items.buy_price` and `sale_items.profit` locked at transaction time.

**Status:** LIVE

### F.3 Stock Adjustment Reasons

| Reason | Typical zone | Actor |
|--------|--------------|-------|
| Damage | All | Admin, dept staff |
| Theft / loss | All | Admin, dept staff |
| Expiry / spoilage | B, D | Admin, dept staff |
| Internal consumption | All | Admin, dept staff |
| Supplier return | — | Admin |

Cashier adjustments → **approval queue** → admin approves before stock changes.

**Status:** LIVE

### F.4 Stock Take vs Cycle Count

| Type | Scope | Actor | Mutates stock | Status |
|------|-------|-------|---------------|--------|
| Stock take | Full or ad-hoc | Admin | Immediately | LIVE |
| Cycle count | 10 items × 2/day | Dept stock manager | Only after admin approves variance | PLANNED |

### F.5 Physical Zone ↔ System Mapping (Palmart)

Configure product types in **Admin → Settings → Product Types**. Recommended Palmart setup (replaces default `grocery` + `retail` only):

| `item_type` key | Label | Store zone | Example items | Selling surface |
|-----------------|-------|------------|---------------|-----------------|
| `retail` | Retail | A, D (packaged) | Soda, water, snacks, detergents, energy drinks | Cashier POS direct |
| `produce` | Produce | B | Tomatoes, dhania, kale, avocados, fruits | Department app → forward |
| `grocery` | Grocery | C | Rice, beans, ndengu, maize, spices | Department app → forward |
| `dairy` | Dairy | D (chilled) | Milk, yogurt | Cashier POS or dept forward |

| Store zone | Aisle name (suggested) | `item_type` keys | Who sells |
|------------|------------------------|------------------|-----------|
| A — Fast movers | Entrance | `retail` | Cashier |
| B — Fresh produce | Produce Bench | `produce` | Dept staff → cashier |
| C — Dry foods | Dry Goods | `grocery` | Dept staff → cashier |
| D — Refrigeration | Chillers | `retail`, `dairy` | Cashier (impulse) + dept for milk restock |
| E — Checkout | Till | — | Cashier only |

**Admin setup checklist**

1. Add product types: `produce`, `grocery`, `retail`, `dairy` (keep keys lowercase, no spaces).
2. Set each catalogue item's `item_type` to match its physical zone.
3. Create aisles mirroring Zones A–E for stock take and floor walks.
4. Assign department staff `users.department` → `{"assignedTypes":["produce","grocery"]}`.

### F.6 Inventory KPIs (recommended targets)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Stock accuracy | ≥ 98% | Cycle count variance / items counted |
| Produce shrinkage | ≤ 5% of produce COGS | Wastage adjustments + spoilage |
| Expired write-offs | Trend down monthly | Expiry adjustment value |
| Days of stock (packaged) | 7–14 days | Current stock ÷ daily sales velocity |

---

## Appendix G — Returns & Refunds Policy

### G.1 System Capabilities

| Capability | Status |
|------------|--------|
| Partial return (selected items/qty) | LIVE |
| Full return | LIVE |
| Refund to cash | LIVE |
| Refund to M-Pesa | LIVE |
| Refund to wallet | LIVE |
| Credit note (tab reduction) | LIVE |
| Loyalty point reversal | LIVE |

### G.2 Recommended Store Policy (define at Palmart)

| Rule | Suggested default |
|------|-------------------|
| Time limit | Same day for produce; 7 days packaged (unopened) |
| Receipt required | Preferred; lookup by sale if regular customer |
| Produce returns | Only if quality issue at purchase time |
| Who can process | Cashier (own shift); admin (any) |
| Manager approval | Returns &gt; KES 500 or without receipt |

---

## Appendix H — Roles & Permissions (Detailed)

### H.1 Role Matrix

| Capability | Owner | Admin | Cashier | Dept staff |
|------------|:-----:|:-----:|:-------:|:----------:|
| POS sell | ✓ | ✓ | ✓ | ✓ (dept only) |
| View profit / P&L | ✓ | ✓ | ✗ | ✗ (dept analysis only) |
| Manage items/catalogue | ✓ | ✓ | Limited | ✗ |
| Manage users | ✓ | ✗ | ✗ | ✗ |
| Business settings | ✓ | ✗ | ✗ | ✗ |
| Record purchase / breakdown | ✓ | ✓ | ✗ | ✗ |
| Supplier bills | ✓ | ✓ | ✗ | Partial |
| Stock adjust (direct) | ✓ | ✓ | Approval queue | ✓ (dept) |
| Process returns | ✓ | ✓ | ✓ | ✗ |
| Open/close shift | ✓ | ✓ | ✓ | ✗ |
| Give credit on POS | Configurable | Configurable | If flagged | ✗ |
| Forward to cashier | ✗ | ✗ | ✗ | ✓ |
| Department supply PO | ✓ | ✓ | ✗ | ✓ |
| Approve PO / balance / stock | ✓ | ✓ | ✗ | ✗ |
| View activity audit log | ✓ | ✓ | ✗ | ✗ |

### H.2 Staff Mapping (Palmart)

| Physical role | System role | `users.department` | Primary zones | Surfaces | Key permissions |
|---------------|-------------|-------------------|---------------|----------|-----------------|
| **Fabian Amino** (owner) | `owner` | `null` | All | `/admin`, `/pos` | Full access; procurement Path A; settings |
| **Cashier** (×2 at Zone E) | `cashier` | `null` | A, E | `/pos` | Sell, returns, shifts; no profit view |
| **Delivery & grocery staff** | `department_staff` | `{"assignedTypes":["produce","grocery"]}` | B, C | `/department` | Forward orders, stock adjust, losses, supply POs, petty expenses |
| **Market sourcing staff** | `owner` or `admin` | `null` | External markets | `/admin` purchases | Buying trips (Path A), supplier bills (Path B), approve dept POs |

**User creation notes (Admin → Users)**

- Department staff: set role `department_staff`, then assign product types `produce` and `grocery` in the user form.
- Cashiers: enable `can_give_credit` only for trusted staff who may extend tab.
- PIN: set 4-digit PIN for fast POS login at Zone E tills.
- Do not give department staff `admin` or `cashier` role — they work only in `/department`.

**Procurement by role**

| Role | Path A (buying trip) | Path B (supplier bill) | Path C (dept PO) |
|------|---------------------|------------------------|------------------|
| Fabian / admin | ✓ | ✓ | Approve |
| Market sourcing | ✓ (primary) | ✓ | — |
| Dept staff | ✗ | Partial (legacy supplies) | Create & deliver |
| Cashier | ✗ | ✗ | ✗ |

### H.3 Permissions Planned but Not in UI

| Permission | Intended use | Status |
|------------|--------------|--------|
| `can_give_discount` | Cart/line discounts | PLANNED |
| `can_override_price` | Below-list selling | LIVE at add-to-cart |
| `edit_completed_sale` | Post-sale corrections | PLANNED |

---

## Appendix I — Reporting & Analytics Map

### I.1 Reports by Audience

| Report | Path | Audience | Status |
|--------|------|----------|--------|
| Dashboard KPIs | `/admin` | Owner, admin | LIVE |
| Sales analytics | `/admin/analytics` | Owner, admin | LIVE |
| Sales by product type | `/admin/sales/[type]` | Owner, admin | LIVE |
| FIFO profit | `/admin/profit` | Owner, admin | LIVE |
| Daily executive report | `/admin/reports/daily` | Owner | LIVE |
| AI insights | Daily report | Owner | LIVE |
| Customer analytics | `/admin/customers` | Owner, admin | LIVE |
| Shift history | `/admin/shifts` | Owner, admin | LIVE |
| Department P&L | `/department/analysis` | Dept staff | LIVE |
| Activity log | `/admin/logs` | Owner, admin | LIVE |
| Supplier price comparison | `/admin/supplier-price-comparison` | Owner, admin | LIVE |
| Pending carts | `/admin/pending-carts` | Owner, admin | LIVE |
| Department activity | `/admin/department-activity` | Owner, admin | LIVE |

### I.2 Profit Formulas (system-accurate)

```
Item profit     = sell_price − buy_price (FIFO batch at sale time)
Line profit     = item profit × quantity
Gross profit    = SUM(sale_items.profit) for completed sales in period
COGS            = SUM(sale_items.buy_price × quantity)
Net profit      = Gross profit − expenses − approved losses (optional view)
```

Margin % = Gross profit ÷ Revenue × 100

### I.3 Safe Reporting Rule

**Always filter financial reports to `sales.status = 'completed'`** until department-forward pending-sale gaps are fully resolved.

---

## Appendix J — Offline, Continuity & Security

### J.1 Offline POS

| Capability | Offline? | Status |
|------------|----------|--------|
| Browse cached items | Yes | LIVE |
| Barcode scan (cached) | Yes | LIVE |
| Cash checkout | Yes (queued) | LIVE |
| M-Pesa checkout | No | — |
| Credit/wallet lookup | No | — |
| Stock levels (live) | No | Shows cached |

On reconnect: queued sales sync to server.

### J.2 Data & Backup (recommended SOP)

| Item | Recommendation |
|------|----------------|
| Database | Turso/SQLite — confirm backup schedule with host |
| Audit log retention | Permanent (activity_log) |
| Session security | Email/password + optional PIN for POS |
| Failed login | Standard NextAuth handling |

### J.3 Audit Trail

Every sensitive action logs:

- `performed_by` (user)
- `action` (e.g. stock_adjust, sale_void)
- `entity_type` + `entity_id`
- `details` (JSON before/after)
- `created_at` (Unix timestamp, Africa/Nairobi display)

**Status:** LIVE

---

## Appendix K — Kenya-Specific Requirements

### K.1 Currency & Time

| Setting | Value |
|---------|-------|
| Currency | KES |
| Timezone | Africa/Nairobi (UTC+3) |
| Analytics hour buckets | Kenya local time |

### K.2 M-Pesa Integration

| Touchpoint | Provider | Status |
|------------|----------|--------|
| POS checkout STK | Pesapal | LIVE |
| Public credit portal STK | Pesapal | LIVE |
| Reconciliation | Manual vs Pesapal dashboard | Operational SOP needed |

### K.3 Phone Number as Customer ID

- Normalize Kenyan formats (`07…`, `+254…`, `254…`).
- Primary key for credit, wallet, loyalty, public portal.

### K.4 Tax & Compliance (FUTURE)

| Requirement | Status | Notes |
|-------------|--------|-------|
| VAT registration threshold | Not in system | Track manually until turnover requires |
| KRA eTIMS fiscal receipts | FUTURE | Required before scaling branches |
| Electronic tax invoices | FUTURE | |

### K.5 Domain & Brand

| Asset | Value |
|-------|-------|
| Store domain (future) | `palmart.co.ke` |
| POS platform | Multi-tenant; custom domain per business |

---

## Appendix L — Automation & Alerts (Roadmap)

| Automation | Trigger | Channel | Status |
|------------|---------|---------|--------|
| Low stock alert | `current_stock < min_stock_level` | Admin notification | PLANNED |
| Expiry alert | Batch `expiry_date` within N days | Admin notification | PLANNED |
| Reorder suggestion | Sales velocity × lead time | Admin report | PLANNED |
| Demand forecast | Historical sales + seasonality | AI/report | FUTURE |
| PO pending approval | Dept submits PO | Admin SSE/email | PARTIAL |
| Shift variance alert | Close variance &gt; threshold | Admin | PLANNED |

---

## Appendix M — Phase 2+ Modules (Not Yet Built)

### M.1 E-Commerce (`palmart.co.ke`)

| Capability | Dependency |
|------------|------------|
| Product catalogue sync | Items API |
| Online cart & checkout | New storefront |
| Payment (M-Pesa) | Pesapal |
| Order → POS/delivery queue | New order model |

**Status:** FUTURE

### M.2 Delivery & WhatsApp Ordering

| Capability | Notes |
|------------|-------|
| WhatsApp order intake | Manual or bot → creates pending sale |
| Delivery fee | Configurable zone (Mirema, Safari Park) |
| Driver assignment | Staff role or dedicated |
| Status tracking | Ordered → packed → out → delivered |

**Status:** FUTURE

### M.3 Loyalty Redemption

- Points → KES discount at checkout
- Minimum redeem threshold
- Cannot combine with credit tab (policy TBD)

**Status:** PLANNED

### M.4 Promotions Engine

- Bundle rules beyond static item bundles
- Time-bound discounts
- Coupon codes

**Status:** FUTURE

### M.5 Multi-Branch (Phase 4)

| Capability | Notes |
|------------|-------|
| Branch per location | Roysambu, Zimmerman, etc. |
| Consolidated reporting | Superadmin / owner view |
| Inter-branch stock transfer | Not designed |

**Status:** FUTURE

---

## Appendix N — Daily Operating Checklists

### N.1 Opening Checklist

| # | Task | System action | Owner |
|---|------|---------------|-------|
| 1 | Unlock store, lights, chillers | — | Staff |
| 2 | Verify chiller temps | — | Staff |
| 3 | Cashier: count float, open shift | Shifts → Open | Cashier |
| 4 | Admin: approve opening balance (if required) | Balance approvals | Admin |
| 5 | Dept: morning cycle count (when live) | Cycle count session | Dept manager |
| 6 | Restock Zone A from back store | Stock adjust if discrepancy | Staff |
| 7 | Review pending POs / deliveries expected | Admin / dept supply | Admin |

### N.2 Closing Checklist

| # | Task | System action | Owner |
|---|------|---------------|-------|
| 1 | Dept: evening cycle count (when live) | Cycle count close | Dept manager |
| 2 | Record spoilage / wastage | Stock adjust | Dept staff |
| 3 | Cashier: close shift, count cash | Shifts → Close | Cashier |
| 4 | Admin: review variance, approve close | Balance approvals | Admin |
| 5 | Review daily report + AI insights | `/admin/reports/daily` | Owner |
| 6 | Reconcile M-Pesa vs sales | External + admin | Owner |
| 7 | Secure cash for banking | — | Owner |

---

## Appendix O — Integration Map

| System | Purpose | Direction | Status |
|--------|---------|-----------|--------|
| Pesapal | M-Pesa STK | POS → Pesapal → callback | LIVE |
| Turso/SQLite | Primary database | App ↔ DB | LIVE |
| Backblaze B2 | Product images | Upload → proxy serve | LIVE |
| IndexedDB | Offline item cache | Browser local | LIVE |
| SSE (event bus) | Dept real-time events | Server → dept clients | LIVE |
| External API keys | Third-party integrations | Inbound to `/api` | LIVE |
| WhatsApp Business | Order intake | FUTURE | — |
| KRA eTIMS | Fiscal receipts | FUTURE | — |
| Pesapal dashboard | M-Pesa reconciliation | Manual | Operational |

---

## Appendix P — Glossary

| Term | Definition |
|------|------------|
| **Batch** | FIFO cost layer from a single intake event |
| **Breakdown** | Converting a fuzzy purchase line into catalogue items + wastage |
| **Buying trip** | Owner/admin market run (Path A) |
| **Credit/tab** | Customer owes store (AR) |
| **Department key** | Product type slug, e.g. `grocery`, `bakery` |
| **Forward** | Dept staff sends cart to cashier as pending sale |
| **PO** | Purchase order (Path C) with approval workflow |
| **Shift** | Cashier drawer session (not inventory cycle count) |
| **Wallet** | Customer prepaid balance spendable at till |
| **Wastage** | Quantity lost at intake (not sold) |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-17 | Fabian Amino | Initial business vision SRS |
| 1.1 | 2026-06-17 | Fabian Amino / Palmart POS | Merged vision + operations supplement; Palmart product types & staff mapping |

**Next review:** After department PO workflow ships and pending-sale reporting gap is fixed.

**Canonical file:** `docs/PALMART_SRS_v1.1.md` — `PALMART_SRS.md` and `PALMART_SRS_SUPPLEMENT.md` are reference-only.
