# Palmart Mini Mart — Comprehensive Business & Systems Requirements Specification (SRS)

**Version:** 2.0 (superseded)  
> **Use [`PALMART_SRS_v1.1.md`](./PALMART_SRS_v1.1.md)** — merged vision + operations spec.

**Owner:** Fabian Amino
**Business Name:** Palmart Mini Mart
**Location:** Mirema Drive, Safari Park Gardens Area, Nairobi, Kenya
**Document Type:** Business + Operations + Technology + Growth Blueprint

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

# 26. Implementation Status (vs. Current POS System)

| SRS Section | Feature | Status | Priority |
|---|---|---|---|
| §4 | Store Zones/Layout (Aisle/Zone Management) | ❌ Not Implemented | P2 |
| §5 | Product Categories | ✅ Complete | — |
| §6 | Customer Segments (Types & Segmentation) | ❌ Not Implemented | P1 |
| §7 | Operating Model (Shifts, Open/Close) | ✅ Complete | — |
| §8-9 | Inventory Management & Stock Lifecycle | ✅ Complete | — |
| §10 | Inventory Adjustments (Damage, Theft, Spoilage) | ✅ Complete | — |
| §11 | Supplier Management & Bills | ✅ Complete | — |
| §12 | Batch Tracking & FIFO | ✅ Complete | — |
| §13 | Profit System (Item, Product, Daily, Net) | ✅ Complete | — |
| §14 | Expense Management | ✅ Complete | — |
| §15 | Staff Structure (Roles: Delivery, Market Sourcing) | ⚠️ Partial — Missing 2 Roles | P1 |
| §16 | Role Permissions (Returns, Department Flow) | ⚠️ Partial — Minor Gaps | P2 |
| §17 | Customer Loyalty (Profiles, Tiers, Promos) | ⚠️ Partial — Points Exist, Profiles Missing | P1 |
| §18 | Delivery System (Orders, Drivers, Tracking) | ❌ Not Implemented | P0 |
| §19 | E-Commerce Platform (Public Storefront) | ❌ Not Implemented | P0 |
| §20 | Analytics System (Hourly, Basket, Velocity) | ⚠️ Partial — ~50% Complete | P1 |
| §21 | Security (Audit Logs) | ✅ Complete | — |
| §21 | CCTV | ❌ Hardware — Out of Software Scope | — |
| §22 | Reporting (Expiry, Low Stock, Margin, Export) | ⚠️ Partial — ~70% Complete | P1 |
| §23 | Automation (Alerts, Reorder, Forecasting) | ⚠️ Partial — ~25% Complete | P1 |
| §24 | POS SaaS (Billing, Onboarding, White-label) | ⚠️ Foundation Only | P2 |
| §25 | Growth Roadmap | ⚠️ Strategy Doc — Not Software | — |

---

### Priority Key

| Priority | Meaning |
|---|---|
| **P0** | Critical — Core to Palmart's hybrid physical+digital vision. Must build for launch. |
| **P1** | High — Significant gap vs. SRS vision. Should build in Phase 1-2. |
| **P2** | Medium — Nice to have. Build after core is stable. |

---

# 27. Development Phasing (Recommended Build Order)

### Immediate (P0) — Delivery + E-Commerce Foundation

1. Delivery system: schema, API, driver role, delivery management UI
2. Public product API: browse, search, category filter
3. Basic public storefront pages
4. Online order placement → creates pending sale + delivery order

### Short-term (P1) — Customer Intelligence + Analytics

5. Customer segmentation: type field, segment analytics
6. Customer profiles: purchase history, visit frequency, lifetime spend
7. Customer loyalty tiers and tier-based promotions
8. Advanced analytics: hourly sales, basket size, peak hours, fast/slow movers
9. Staff performance analytics: sales per cashier, shift comparison
10. Delivery Staff and Market Sourcing Staff roles
11. Low stock and expiry alerts (automated)
12. Enhanced reports: expiry, low stock, margin analysis, CSV/PDF export
13. Supplier reorder suggestions

### Medium-term (P2) — SaaS + Polish

14. Store zone/aisle management
15. Cashier return processing permissions refinement
16. POS SaaS: tenant billing, onboarding, white-labeling, feature flags
17. Demand forecasting
18. Expense budget vs. actual comparison
19. Recurring expense automation

---

# Final Definition

Palmart is not merely a mini mart.

It is a **retail innovation lab disguised as a neighborhood store**.

The physical shop is the testing ground.

The POS system is the product.

The customer base is the dataset.

The operations are the experiment.

The long-term outcome is a scalable retail technology company that can power thousands of small retailers across Kenya while simultaneously operating its own highly optimized chain of neighborhood stores.
