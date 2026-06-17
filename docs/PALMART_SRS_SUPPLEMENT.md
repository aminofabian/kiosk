# Palmart Mini Mart — SRS Supplement (Operations & Systems)

**Version:** 1.0 (merged into v1.1)  
> **Use [`PALMART_SRS_v1.1.md`](./PALMART_SRS_v1.1.md)** — this file is kept for reference only.

**Owner:** Fabian Amino  
**Status:** Merged into SRS v1.1 (Part II, Appendices A–P)  
**Related:** `PALMART_SRS_v1.1.md`, `DEPARTMENT_SUPPLY_MANAGEMENT.md`, `DEPARTMENT_CYCLE_COUNT.md`, `DEPARTMENT_FORWARD_CASHIER_FLOW_GAPS.md`

This document fills gaps in the main Palmart SRS. Each feature is tagged:

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
2. Add items (scoped to assigned product types, e.g. `grocery`, `produce`).
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

### F.5 Physical Zone ↔ System Mapping

| Store zone | Product types | Department | POS surface |
|------------|---------------|------------|-------------|
| A — Fast movers | Snacks, beverages | — | Cashier POS direct |
| B — Fresh produce | Produce, fruits | `grocery` / produce type | Department app → forward |
| C — Dry foods | Cereals, pulses | `grocery` | Department app → forward |
| D — Refrigeration | Dairy, chilled drinks | `grocery` | Mixed (fast movers at POS) |
| E — Checkout | — | — | Cashier POS |

**Recommendation:** Configure `aisles` in admin to mirror Zones A–E for floor walks and stock take.

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

### H.2 Staff Mapping (Palmart current)

| Person | System role | Department assignment |
|--------|-------------|----------------------|
| Fabian (owner) | `owner` | — |
| Cashier | `cashier` | — |
| Delivery & grocery staff | `department_staff` | `grocery` (or as configured) |
| Market sourcing staff | `admin` or `owner` | — |

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
| 1.0 | 2026-06-17 | Fabian Amino / Palmart POS | Initial supplement drafted from SRS gap analysis |

**Next review:** After department PO workflow and pending-sale reporting fixes ship.
