# Department Supply Management — Scope

> **Status**: Draft · **Date**: 2026-06-17  
> **Related**: [`DEPARTMENT_STAFF_ROLE_SCOPE.md`](./DEPARTMENT_STAFF_ROLE_SCOPE.md), [`SUPPLIER-COST-PRICES.md`](./SUPPLIER-COST-PRICES.md)

A scoped supply module where **admin** controls which suppliers each department may use, and **department staff** raise purchase orders and record deliveries — all under admin approval and review.

---

## Table of Contents

1. [Core concept](#1-core-concept)
2. [Current state](#2-current-state)
3. [Intended workflow](#3-intended-workflow)
4. [Key rules & guardrails](#4-key-rules--guardrails)
5. [What needs building](#5-what-needs-building)
6. [Database changes](#6-database-changes)
7. [Permissions](#7-permissions)
8. [API surface (planned)](#8-api-surface-planned)
9. [UI surfaces](#9-ui-surfaces)
10. [Notifications](#10-notifications)
11. [Reuse from existing supply module](#11-reuse-from-existing-supply-module)
12. [Design decisions](#12-design-decisions)
13. [Risks & mitigations](#13-risks--mitigations)
14. [Implementation phasing](#14-implementation-phasing)
15. [Test plan](#15-test-plan)
16. [Files reference](#16-files-reference)

---

## 1. Core concept

| Actor | Responsibility |
|-------|----------------|
| **Admin** | Assign suppliers to departments; approve/reject POs; review delivery records; full cross-department visibility |
| **Department staff** | Raise POs against assigned suppliers only; record deliveries (linked to approved PO or ad-hoc); link catalogue products to lines; see only their department's history |

Staff **cannot** pick unassigned suppliers or create new supplier profiles. POs enter **pending approval** until admin acts. Deliveries may optionally reference an approved PO for reconciliation.

---

## 2. Current state

### What exists today

| Piece | Location | Notes |
|-------|----------|-------|
| Supplier profiles | `suppliers`, `/api/suppliers` | Full business pool |
| Supplier ↔ product links | `supplier_products` | Cost, pack size, primary supplier |
| Purchases (buying trips) | `purchases`, `purchase_items`, `purchase_breakdowns` | Admin path; fuzzy lines (`quantity_note`) |
| Breakdown → stock-in | `POST /api/purchases/[id]/breakdown` | Creates `inventory_batches`, updates `items.current_stock` |
| Purchase status | `purchases.status` | `pending` → `partial` → `complete` (per line breakdown) |
| Supplier bills | `supplier_bills`, `/api/supplier-bills` | Structured lines; **immediate stock receipt** |
| Department supplies UI | `DepartmentSuppliesForm` | Records → Supplies tab |
| Department scoping | `users.department` | JSON array of **product-type keys** (`assignedTypes`) |
| SSE to department staff | `eventBus`, `useDepartmentEvents` | Pattern for `order:forwarded`, `order:loaded`, etc. |

### Gaps vs intended model

| Gap | Detail |
|-----|--------|
| No supplier ↔ department assignment | Staff see **all** suppliers from `/api/suppliers` |
| Staff can create suppliers | `DepartmentSuppliesForm` has “Add supplier” |
| No PO approval workflow | Staff post directly to `/api/supplier-bills` — stock in immediately |
| Two parallel supply paths | Admin uses `purchases` + breakdown; department uses `supplier-bills` |
| `purchase_items` not PO-shaped | Lines are notes (`quantity_note`, `amount`), not `item_id` + `qty_ordered` |
| No `approval_status` on purchases | Cannot separate “approved to order” from “delivered” |
| No department filter on supply records | Staff could see other departments' activity via admin APIs |
| Staff lack breakdown permission | `breakdown_purchase` is owner/admin only |

---

## 3. Intended workflow

```text
Admin assigns supplier(s) to department_key
        ↓
Staff creates PO (draft) → adds structured lines → submits
        ↓
PO status: pending_approval
        ↓
Admin approves or rejects
        ↓
If approved: staff records delivery (full or partial per line)
        ↓
Breakdown / receipt creates inventory_batches + stock-in
        ↓
Admin reviews delivery records (audit / exceptions)
```

### State machines

**Approval** (`purchases.approval_status`):

```text
draft → pending_approval → approved
                        → rejected → draft (edit & resubmit)
pending_approval → draft (staff withdraw)
```

**Fulfillment** (`purchases.status` — existing column):

```text
pending → partial → complete
```

A PO can be `approved` + `pending` (approved but nothing received yet).

**Delivery**: Each receipt breaks down one or more `purchase_items` rows. Partial fulfillment = some lines `broken_down`, others still `pending`.

---

## 4. Key rules & guardrails

| Rule | Enforcement |
|------|-------------|
| Staff only see assigned suppliers | `department_suppliers` + API filter by staff `assignedTypes` |
| Staff cannot create suppliers | Remove create-supplier from department UI; API 403 |
| PO locked after submit for approval | Editable only in `draft`; rejected returns to `draft` |
| Staff see only own department supply history | Filter `purchases.department` / `recorded_by` + department keys |
| No cross-department visibility for staff | Scoped GET endpoints |
| Ad-hoc deliveries allowed | Delivery without PO link requires `notes` / reason |
| Stock-in timing | **v1**: stock moves on breakdown/receipt (see [§12](#12-design-decisions)) |

---

## 5. What needs building

### 5.1 Data layer

- [ ] `department_suppliers` junction table
- [ ] `purchases.department`, `purchases.approval_status`
- [ ] Structured PO lines on `purchase_items` (or parallel columns): `item_id`, `qty_ordered`, `qty_received`, `unit_cost_estimated`
- [ ] Backfill migration for existing purchases (`approval_status = 'approved'`)
- [ ] Optional: `delivery_receipts` table (v2 — multiple explicit receipt events per PO)

### 5.2 API layer

- [ ] CRUD `department_suppliers` (admin)
- [ ] Department-scoped supplier list for staff
- [ ] PO create / update (draft) / submit / withdraw
- [ ] Admin approve / reject PO
- [ ] Delivery / breakdown endpoint (staff-facing, scoped)
- [ ] Scoped list endpoints (staff: own department; admin: all)

### 5.3 Permissions

- [ ] New or extended permissions (see [§7](#7-permissions))
- [ ] Gate existing `DepartmentSuppliesForm` supplier-bill path or redirect to new flow

### 5.4 UI

- [ ] `/department/supply` — PO list, new PO, delivery recording
- [ ] Admin supply inbox — pending POs, delivery review
- [ ] Admin UI — assign suppliers to department keys

### 5.5 Notifications

- [ ] SSE: `purchase:approved`, `purchase:rejected` → `staff:{userId}`

---

## 6. Database changes

### 6.1 `department_suppliers` (new)

Use **product-type keys** (same as `users.department` / `assignedTypes`), not display names.

```sql
CREATE TABLE department_suppliers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  department_key TEXT NOT NULL,   -- e.g. 'grocery', 'bakery' (item type key)
  supplier_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(business_id, department_key, supplier_id)
);

CREATE INDEX idx_department_suppliers_business_dept
  ON department_suppliers(business_id, department_key);
CREATE INDEX idx_department_suppliers_supplier
  ON department_suppliers(supplier_id);
```

**Multi-type staff**: union suppliers for all keys in the user's `assignedTypes` array.

### 6.2 `purchases` (extend)

```sql
ALTER TABLE purchases ADD COLUMN department TEXT;  -- primary department_key for the PO
ALTER TABLE purchases ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected'));
```

- `department`: which department raised the PO (single key; if staff has multiple types, PO is tagged with active `shopType` or primary assigned type).
- `approval_status`: workflow gate (separate from delivery `status`).
- Backfill existing rows: `approval_status = 'approved'`, `department = NULL`.

Optional later:

```sql
ALTER TABLE purchases ADD COLUMN approved_by TEXT;
ALTER TABLE purchases ADD COLUMN approved_at INTEGER;
ALTER TABLE purchases ADD COLUMN rejection_reason TEXT;
```

### 6.3 `purchase_items` (extend for structured PO lines)

Existing columns kept for backward compatibility (admin raw-note purchases).

```sql
ALTER TABLE purchase_items ADD COLUMN qty_ordered REAL;
ALTER TABLE purchase_items ADD COLUMN qty_received REAL NOT NULL DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN unit_cost_estimated REAL;
```

| Mode | Fields used |
|------|-------------|
| Legacy (admin raw note) | `item_name_snapshot`, `quantity_note`, `amount` |
| Department PO | `item_id`, `qty_ordered`, `unit_cost_estimated`; `qty_received` updated on delivery |

### 6.4 Delivery (v1 — reuse breakdown)

No new table required for v1. Delivery = existing breakdown flow:

```text
purchase_items → purchase_breakdowns → inventory_batches → items.current_stock
```

`purchases.status` transitions `pending` → `partial` → `complete` as lines are broken down (already implemented in `app/api/purchases/[id]/breakdown/route.ts`).

**v2 optional** — explicit audit trail:

```sql
CREATE TABLE delivery_receipts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id)
);
```

---

## 7. Permissions

### Current

| Permission | owner/admin | department_staff |
|------------|:-----------:|:----------------:|
| `record_purchase` | ✓ | ✗ |
| `breakdown_purchase` | ✓ | ✗ |
| `record_supplier_bill` | ✓ | ✓ |

### Proposed additions

| Permission | owner/admin | department_staff | Purpose |
|------------|:-----------:|:----------------:|---------|
| `manage_department_suppliers` | ✓ | ✗ | Assign suppliers to departments |
| `approve_department_po` | ✓ | ✗ | Approve/reject POs |
| `create_department_po` | ✓ | ✓ | Create/edit draft POs |
| `submit_department_po` | ✓ | ✓ | Submit for approval |
| `record_department_delivery` | ✓ | ✓ | Log delivery / run breakdown |

Alternatively, reuse `record_purchase` + `breakdown_purchase` for staff with API-level department scoping — simpler permission matrix, less explicit.

**Recommendation**: add `approve_department_po` and `record_department_delivery`; scope `record_purchase` to staff for department POs only via API guards.

---

## 8. API surface (planned)

| Method | Endpoint | Actor | Purpose |
|--------|----------|-------|---------|
| GET | `/api/department/suppliers` | Staff | Suppliers assigned to user's department keys |
| GET/POST/DELETE | `/api/admin/department-suppliers` | Admin | Manage junction |
| GET | `/api/department/purchase-orders` | Staff | List own department POs |
| POST | `/api/department/purchase-orders` | Staff | Create draft PO |
| PATCH | `/api/department/purchase-orders/[id]` | Staff | Edit draft / withdraw |
| POST | `/api/department/purchase-orders/[id]/submit` | Staff | → `pending_approval` |
| GET | `/api/admin/purchase-orders/pending` | Admin | Approval inbox |
| POST | `/api/admin/purchase-orders/[id]/approve` | Admin | Approve |
| POST | `/api/admin/purchase-orders/[id]/reject` | Admin | Reject + reason |
| POST | `/api/department/purchase-orders/[id]/deliver` | Staff | Record delivery (wraps breakdown) |

Existing endpoints to keep for admin raw-note purchases:

- `POST /api/purchases` — admin buying trips (auto `approval_status = 'approved'`)
- `POST /api/purchases/[id]/breakdown` — stock-in (may delegate to department deliver endpoint)

**Deprecate for department staff**: direct `POST /api/supplier-bills` from `DepartmentSuppliesForm` (or gate behind feature flag until migration complete).

---

## 9. UI surfaces

### Department staff — `/department/supply`

| Screen | Purpose |
|--------|---------|
| PO list | Filter by status (`draft`, `pending_approval`, `approved`, `partial`, `complete`) |
| New / edit PO | Supplier dropdown scoped to `department_suppliers`; structured product lines |
| Delivery | Pick approved PO → record quantities received → link products |
| Ad-hoc delivery | No PO; mandatory notes; admin review flag |

Replace or supersede **Records → Supplies** (`DepartmentSuppliesForm`) once PO flow is stable.

### Admin

| Screen | Purpose |
|--------|---------|
| Department ↔ supplier assignments | CRUD on `department_suppliers` |
| PO approval inbox | Pending POs with approve/reject |
| Delivery review | Recent receipts; flag anomalies |
| Cross-department dashboard | Extend `admin/department-activity` or new supply tab |

---

## 10. Notifications

Reuse SSE infrastructure (`lib/sse/event-bus`, `useDepartmentEvents`).

| Event | When | Channel |
|-------|------|---------|
| `purchase:submitted` | Staff submits PO | `admin:{businessId}` or admin inbox poll |
| `purchase:approved` | Admin approves | `staff:{recorded_by_user_id}` |
| `purchase:rejected` | Admin rejects | `staff:{recorded_by_user_id}` + reason in payload |

Staff client: toast + refresh PO list (same pattern as `order:forwarded`).

---

## 11. Reuse from existing supply module

| Asset | Reuse |
|-------|-------|
| `suppliers`, `supplier_products` | Supplier picker + line defaults (cost, SKU) |
| `purchases` / `purchase_items` | PO header + lines (extended) |
| `purchase_breakdowns` | Delivery truth → unit cost, wastage |
| `inventory_batches` | Stock-in batches |
| `recordBuyingPrice()` | Cost history on receipt |
| `validateSupplierBillCreate` | Reference for line validation patterns |
| `logActivity()` | Audit trail |
| `eventBus` + department SSE | Notifications |

**Do not reuse as-is**: `DepartmentSuppliesForm` → `supplier-bills` path for department ordering (wrong lifecycle — instant stock, no approval).

---

## 12. Design decisions

### D-01: Canonical path for department supply

**Decision (recommended)**: `purchases` + breakdown for department POs. Retire department use of `supplier-bills` for ordering.

| Path | Pros | Cons |
|------|------|------|
| **purchases + breakdown** | Approval before stock; partial delivery built-in | Needs structured lines + staff breakdown UI |
| supplier-bills | Already in department UI | Instant stock; no PO; AP-focused |

### D-02: When does stock move?

**v1 (recommended)**: On delivery/breakdown (staff action), not on PO approval. Admin approval gates **commitment to order**, not inventory.

**v2 option**: Pending delivery review before stock-in (stronger control, slower ops).

### D-03: Partial deliveries

**Yes** — at **purchase_item line** granularity (existing `partial` status). Not fractional qty on a single line in v1.

### D-04: PO edit after submit?

| State | Staff can edit? |
|-------|-----------------|
| `draft` | Yes |
| `pending_approval` | No (locked) — but staff can **withdraw** to `draft` |
| `rejected` | Yes → edit and resubmit |
| `approved` | No — amend via new PO or admin |

### D-05: Department identity

**v1**: `department_key` = product type key from `users.department` JSON (same as `assignedTypes`).

**Later**: normalize to `departments` table when multi-branch or rename-heavy ops need it.

### D-06: `users.department` format

Stored as JSON string, e.g. `["grocery","bakery"]`. Junction and PO `department` column must use **keys**, not labels shown in UI.

### D-07: Multi-type staff — PO department selector

Staff with multiple assigned keys (e.g. `["grocery","bakery"]`) must explicitly pick which department a PO is for via a dropdown on the PO form. The dropdown is scoped to the staff's `assignedTypes`. Default to the currently active `shopType`, but the staff can override. This ensures the PO is tagged with the correct `department_key`, not auto-assumed.

### D-08: `purchase_items` dual-mode detection

Use **inference** to determine whether a row is a PO line or a legacy raw-note line. Check `qty_ordered IS NOT NULL` rather than adding a `po_mode` column. No backfill required, self-correcting, and avoids maintaining two truth sources.

### D-09: Admin purchases — explicit `approval_status`

When `POST /api/purchases` creates a new admin buying trip, set `approval_status = 'approved'` explicitly in the INSERT (not just via `DEFAULT`). This makes the intent visible in code and avoids accidental drift if the default ever changes.

---

## 13. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Free-text / key drift for department | Broken supplier scoping | Validate keys against configured item types; admin picker not free text |
| Two supply paths in parallel | Duplicate logic, confused staff | Single canonical path; feature-flag old form |
| `purchase_items` dual mode (note vs structured) | API complexity | `po_mode` flag on purchase or infer from presence of `qty_ordered` |
| Staff without `breakdown_purchase` | Cannot deliver | Add `record_department_delivery` or grant scoped breakdown |
| Existing supplier-bills from department | Historical data orphan | Keep bills; new flow uses purchases only |
| Multi-type staff | Wrong supplier list | Union suppliers across all assigned keys |

---

## 14. Implementation phasing

### Phase 1 — Foundation (ship first)

- [ ] Migration: `department_suppliers`, `purchases` columns, `purchase_items` qty columns
- [ ] Admin API + UI: assign suppliers to department keys
- [ ] `GET /api/department/suppliers` (scoped list)
- [ ] Remove staff “create supplier” from `DepartmentSuppliesForm`

### Phase 2 — Purchase orders

- [ ] Staff PO CRUD (draft only) + submit → `pending_approval`
- [ ] Admin approve / reject API + inbox UI
- [ ] `/department/supply` — PO list + create form
- [ ] SSE `purchase:approved` / `purchase:rejected`

### Phase 3 — Deliveries

- [ ] Staff delivery UI (approved POs)
- [ ] Wrap breakdown endpoint with department guards + `qty_received` updates
- [ ] Admin delivery review list
- [ ] Deprecate department → `supplier-bills` for new orders

### Phase 4 — Hardening (optional)

- [ ] `delivery_receipts` audit table
- [ ] `departments` normalized entity
- [ ] Partial qty on single line
- [ ] Delivery approval before stock-in

---

## 15. Test plan

### Supplier assignment

- [ ] Admin assigns supplier S to department key `grocery`
- [ ] Grocery staff sees S; bakery staff does not
- [ ] Staff with `["grocery","bakery"]` sees union of both assignments
- [ ] Staff cannot POST PO with unassigned supplier (403)

### PO lifecycle

- [ ] Create draft → edit lines → submit → `pending_approval`
- [ ] Cannot edit while pending
- [ ] Admin rejects → staff edits → resubmits
- [ ] Admin approves → `approved` + `status` still `pending`

### Delivery

- [ ] Staff delivers against approved PO → `inventory_batches` created, stock increases
- [ ] Partial: one line broken down → `partial`; all lines → `complete`
- [ ] Ad-hoc delivery without PO requires notes

### Permissions & scope

- [ ] Staff cannot access another department's PO list
- [ ] Admin sees all departments
- [ ] Staff cannot create suppliers

### Notifications

- [ ] Approve/reject emits SSE; staff toast and list refresh

### Regression

- [ ] Admin raw-note purchases still work (`approval_status = 'approved'`)
- [ ] Existing `purchase_breakdowns` / batches unchanged for legacy flow

---

## 16. Files reference

### Existing (touch / extend)

| File | Role |
|------|------|
| `components/department/DepartmentSuppliesForm.tsx` | Replace / deprecate |
| `components/department/DepartmentRecordsScreen.tsx` | Add supply tab or link to `/department/supply` |
| `app/api/purchases/route.ts` | Extend POST; department + approval |
| `app/api/purchases/[id]/breakdown/route.ts` | Delivery / stock-in |
| `lib/auth/permissions.ts` | New permissions |
| `lib/hooks/use-department-events.ts` | New SSE event types |
| `lib/sse/event-bus.ts` | Publish purchase events |
| `components/admin/UserList.tsx` | Department key display (reference) |

### New (planned)

| File | Role |
|------|------|
| `lib/db/migrate-department-suppliers.ts` | Junction + purchase columns |
| `app/api/department/suppliers/route.ts` | Scoped supplier list |
| `app/api/admin/department-suppliers/route.ts` | Admin CRUD |
| `app/api/department/purchase-orders/` | Staff PO APIs |
| `app/api/admin/purchase-orders/` | Approval APIs |
| `app/department/supply/page.tsx` | Staff supply UI |
| `app/admin/department-supply/page.tsx` | Admin assignments + inbox |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-17 | Initial scope document |
| 2026-06-17 | Added D-07 (multi-type PO selector), D-08 (dual-mode inference), D-09 (explicit approval_status). Added withdraw to state machine and D-04. |
