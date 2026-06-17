# Department Cycle Count — Scope

> **Status**: Draft · **Date**: 2026-06-17  
> **Related**: [`DEPARTMENT_STAFF_ROLE_SCOPE.md`](./DEPARTMENT_STAFF_ROLE_SCOPE.md), [`DEPARTMENT_SUPPLY_MANAGEMENT.md`](./DEPARTMENT_SUPPLY_MANAGEMENT.md)

A lightweight daily audit layer where **department stock managers** perform morning and evening cycle counts on a system-selected batch of 10 items, and **admin** (v1: branch stock manager) reviews variances and resolves escalations — without mutating inventory until explicitly approved.

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
11. [Reuse from existing modules](#11-reuse-from-existing-modules)
12. [Design decisions](#12-design-decisions)
13. [Variance & movement math](#13-variance--movement-math)
14. [Risks & mitigations](#14-risks--mitigations)
15. [Implementation phasing](#15-implementation-phasing)
16. [Test plan](#16-test-plan)
17. [Files reference](#17-files-reference)

---

## 1. Core concept

| Actor | Responsibility |
|-------|----------------|
| **Department Stock Manager** | Open daily count session; count same 10 items morning + evening; scan barcodes; flag items as not located; close session |
| **Admin / Branch Stock Manager (v1: admin)** | Configure item pool (pin/exclude/swap); review variance reports; dismiss or approve stock adjustments; cross-department oversight |
| **Department staff** (unchanged) | Sales forwarding, supply POs, direct stock adjustments — separate from cycle count role |

### Daily cycle (one session per department per calendar day)

```text
Morning: Open session (no approval gate)
        ↓
Receive today's 10 items (system-selected batch)
        ↓
For each item: scan barcode → enter physical count → confirm
        ↓
Work through the trading day...
        ↓
Evening: Count same 10 items again
        ↓
Close session → system compares counts vs expected stock
        ↓
Match ✅ → session complete
Mismatch ⚠️ → escalation to admin
```

**Important**: This is **not** a cashier register shift. Cash shifts (`shifts` table) track drawer cash. Cycle count sessions track physical inventory audit. Do not conflate the two.

### Role split (deferred)

| Role | Scope | v1 |
|------|-------|-----|
| `department_stock_manager` | Count within assigned department(s) | **Ship** |
| `branch_stock_manager` | All departments; escalation inbox | Map to **admin** until multi-branch exists |

---

## 2. Current state

### What exists today

| Piece | Location | Notes |
|-------|----------|-------|
| Department workspace | `/department/*` | Mobile-first UI, bottom nav, `DepartmentAppProvider` |
| Department scoping | `users.department` JSON | Product-type keys (`assignedTypes`), e.g. `["grocery","bakery"]` |
| Item filtering by type | `/api/items?itemTypes=` | Used by `DepartmentStockScreen` |
| Barcode catalogue | `items.barcode`, `/api/items/barcode/:code` | Lookup + `useBarcodeScanner` hook |
| Sales history | `sales`, `sale_items` | Quantity sold per item, timestamps |
| Stock adjustments | `stock_adjustments`, `/api/stock/adjust` | Direct for admin/department_staff; approval queue for cashiers |
| Stock take (admin) | `StockTakeForm`, `/api/stock/take` | Ad-hoc desktop form; **immediate** stock mutation |
| Stock approvals | `stock_approval_requests` | Cashier requests → admin approve/reject |
| Activity log | `activity_log`, `logActivity()` | Audit trail pattern |
| Department SSE | `eventBus`, `useDepartmentEvents` | Real-time notifications to department staff |
| POS offline queue | `lib/offline/queue.ts`, IndexedDB | Sales sync on reconnect — pattern for v2 offline counts |
| No-barcode items | `/admin/items/no-barcode` | Some SKUs lack barcodes; need tap-to-confirm fallback |

### Gaps vs intended model

| Gap | Detail |
|-----|--------|
| No cycle count role | `department_staff` can freely adjust stock — counter ≠ adjuster |
| No session-based counting | Stock take is one-shot; no morning/evening dual count |
| No item pool selection | No "yesterday's sold items" sampling or admin pin/exclude |
| No variance escalation flow | Adjustments are immediate or cashier-approval; no count-session linkage |
| No movement-adjusted comparison | Evening count vs raw system stock would false-positive on every sale |
| No "not located" state | Only numeric count or skip |
| Cashier shifts ≠ inventory shifts | `shifts` table is cash-drawer only |

---

## 3. Intended workflow

### Session state machine

```text
open → morning_in_progress → morning_complete → evening_in_progress → closed
                                                              ↓
                                                    variance_review (if escalated)
                                                              ↓
                                                    resolved | dismissed
```

| Status | Meaning |
|--------|---------|
| `open` | Session created; batch assigned; morning count not started |
| `morning_in_progress` | At least one morning line started, not all complete |
| `morning_complete` | All 10 morning counts recorded (or flagged not_located) |
| `evening_in_progress` | Evening count started |
| `closed` | All evening counts done; variance computed |
| `escalated` | One or more lines exceeded tolerance; awaiting admin |
| `resolved` | Admin acted on all escalated lines |

**Rules**:

- One active session per `(business_id, department_key, session_date)`.
- Same 10 items for morning and evening.
- Count entry does **not** change `items.current_stock`.
- Stock moves only when admin **approves adjustment** from an escalation.

### Per-line state

```text
pending → morning_counted → evening_counted
         → not_located_morning (allowed; escalates on close)
         → not_located_evening
```

Each line stores:

- `morning_count`, `evening_count` (nullable until counted)
- `morning_counted_at`, `evening_counted_at`
- `barcode_verified_morning`, `barcode_verified_evening` (boolean)
- `not_located_morning`, `not_located_evening` (boolean)
- Snapshots at count time: `system_stock_morning`, `system_stock_evening`

### Item batch selection (at session open)

```text
1. Build pool:
   - Base: items sold yesterday in this department (by item_type)
   - Minus: admin-excluded items
   - Plus: admin-pinned items (always included)
2. If pool < 10 → backfill from department catalogue (random)
3. Random sample to fill remaining slots (default 10)
4. Admin may swap any slot before morning count starts
5. Lock batch once first morning count is submitted
```

---

## 4. Key rules & guardrails

| Rule | Enforcement |
|------|-------------|
| Counter cannot adjust stock directly | Role lacks `adjust_stock`; only count APIs |
| One session per department per day | Unique constraint + API guard |
| Batch locked after first morning count | Reject swap/pin changes mid-session |
| Barcode scan confirms identity | Scanned code must match line `item_id` (or variant parent) |
| No barcode → tap confirm on card | `barcode_verified` set via explicit confirm button |
| `not_located` ≠ zero | Separate flag; auto-escalate; excluded from qty variance |
| Evening comparison uses movement-adjusted expected qty | See [§13](#13-variance--movement-math) |
| Escalation requires admin action | Dismiss or approve adjustment — no silent fixes |
| Department scope | Staff only see sessions for their `assignedTypes` |
| Sellable variants only | Never count parent container rows (`sellableOnly`) |

---

## 5. What needs building

### 5.1 Data layer

- [ ] `cycle_count_sessions` table
- [ ] `cycle_count_lines` table
- [ ] `cycle_count_item_config` table (pin / exclude per department)
- [ ] `cycle_count_escalations` table (or embed in lines — see [§12](#12-design-decisions))
- [ ] Business settings keys for tolerance (JSON in `businesses.settings`)
- [ ] Migration + role constraint update for `department_stock_manager`

### 5.2 API layer

- [ ] Session open / get current / close
- [ ] Line count submit (morning / evening)
- [ ] Admin batch preview + swap before lock
- [ ] Admin config CRUD (pin / exclude)
- [ ] Admin escalation inbox + dismiss / approve
- [ ] Movement snapshot query helper (sales + adjustments + deliveries during session)

### 5.3 Permissions

- [ ] New role `department_stock_manager` (or permission bundle — see [§7](#7-permissions))
- [ ] `run_cycle_count`, `review_cycle_count_escalations`, `manage_cycle_count_config`

### 5.4 UI — Department (mobile/tablet)

- [ ] `/department/cycle-count` — session hub (status, progress)
- [ ] Open shift flow
- [ ] One-item-at-a-time count cards (scan → qty → confirm)
- [ ] Evening re-count flow
- [ ] Close session summary

### 5.5 UI — Admin

- [ ] Stock Count oversight panel (sessions today, escalations)
- [ ] Per-department config (pin / exclude items)
- [ ] Batch swap UI before session lock
- [ ] Escalation detail + dismiss / approve adjustment

### 5.6 Notifications

- [ ] SSE: `cycle_count:escalated` → admin
- [ ] SSE: `cycle_count:resolved` → department stock manager

---

## 6. Database changes

### 6.1 `cycle_count_sessions` (new)

```sql
CREATE TABLE cycle_count_sessions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  department_key TEXT NOT NULL,       -- product type key, e.g. 'grocery'
  session_date TEXT NOT NULL,         -- 'YYYY-MM-DD' local business calendar
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN (
      'open', 'morning_in_progress', 'morning_complete',
      'evening_in_progress', 'closed', 'escalated', 'resolved'
    )),
  batch_size INTEGER NOT NULL DEFAULT 10,
  opened_by TEXT NOT NULL,
  closed_by TEXT,
  opened_at INTEGER NOT NULL,
  morning_completed_at INTEGER,
  closed_at INTEGER,
  tolerance_abs REAL,                 -- snapshot at open from settings
  tolerance_pct REAL,                 -- snapshot at open from settings
  notes TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(business_id, department_key, session_date)
);

CREATE INDEX idx_cycle_count_sessions_business_date
  ON cycle_count_sessions(business_id, session_date);
CREATE INDEX idx_cycle_count_sessions_status
  ON cycle_count_sessions(business_id, status);
```

### 6.2 `cycle_count_lines` (new)

```sql
CREATE TABLE cycle_count_lines (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,        -- 1..10 display order
  selection_source TEXT NOT NULL DEFAULT 'random'
    CHECK (selection_source IN ('yesterday_sales', 'pinned', 'backfill', 'admin_swap')),

  -- Morning
  system_stock_morning REAL,
  morning_count REAL,
  morning_counted_at INTEGER,
  morning_counted_by TEXT,
  barcode_verified_morning INTEGER NOT NULL DEFAULT 0,
  not_located_morning INTEGER NOT NULL DEFAULT 0,

  -- Evening
  system_stock_evening REAL,
  evening_count REAL,
  evening_counted_at INTEGER,
  evening_counted_by TEXT,
  barcode_verified_evening INTEGER NOT NULL DEFAULT 0,
  not_located_evening INTEGER NOT NULL DEFAULT 0,

  -- Computed at close (denormalized for reporting)
  expected_evening REAL,
  variance_morning_system REAL,
  variance_evening_expected REAL,
  variance_intra_day REAL,
  escalated INTEGER NOT NULL DEFAULT 0,
  escalation_reason TEXT,

  FOREIGN KEY (session_id) REFERENCES cycle_count_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  UNIQUE(session_id, item_id)
);

CREATE INDEX idx_cycle_count_lines_session ON cycle_count_lines(session_id);
```

### 6.3 `cycle_count_item_config` (new)

```sql
CREATE TABLE cycle_count_item_config (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  department_key TEXT NOT NULL,
  item_id TEXT NOT NULL,
  config_type TEXT NOT NULL CHECK (config_type IN ('pinned', 'excluded')),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  UNIQUE(business_id, department_key, item_id, config_type)
);
```

### 6.4 `cycle_count_escalation_actions` (new)

Audit trail for admin resolution per escalated line.

```sql
CREATE TABLE cycle_count_escalation_actions (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('dismiss', 'approve_adjustment')),
  reviewed_by TEXT NOT NULL,
  reviewed_at INTEGER NOT NULL,
  notes TEXT,
  stock_adjustment_id TEXT,         -- set when action = approve_adjustment
  FOREIGN KEY (line_id) REFERENCES cycle_count_lines(id) ON DELETE CASCADE,
  FOREIGN KEY (stock_adjustment_id) REFERENCES stock_adjustments(id) ON DELETE SET NULL
);
```

### 6.5 Users role extension

```sql
-- Migration: extend users.role CHECK to include department_stock_manager
-- users.department JSON reused for assigned department keys (same as department_staff)
```

### 6.6 Business settings (extend JSON)

Add to `businesses.settings` (no schema migration):

```json
{
  "cycleCount": {
    "batchSize": 10,
    "toleranceAbs": 2,
    "tolerancePct": 5,
    "lowStockFloor": 3,
    "requireBarcodeScan": true,
    "allowNotLocated": true
  }
}
```

---

## 7. Permissions

### Proposed role

| Role | Permissions | Notes |
|------|-------------|-------|
| `department_stock_manager` | `run_cycle_count` | Count only; no `adjust_stock` |
| `admin` / `owner` | `review_cycle_count_escalations`, `manage_cycle_count_config`, `run_cycle_count` | v1 branch stock manager |

### Permission keys

| Permission | department_stock_manager | admin/owner |
|------------|:------------------------:|:-----------:|
| `run_cycle_count` | ✓ | ✓ |
| `manage_cycle_count_config` | ✗ | ✓ |
| `review_cycle_count_escalations` | ✗ | ✓ |
| `adjust_stock` | ✗ | ✓ |

**Recommendation**: Ship as a **separate role**, not a permission flag on `department_staff`. Department staff adjust stock freely today; cycle counters should not.

### Middleware

- `/department/cycle-count` → `department_stock_manager` + admin
- `/admin/stock-count` → admin/owner only

---

## 8. API surface (planned)

### Department stock manager

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/department/cycle-count/today` | Current session for active `shopType` / department |
| POST | `/api/department/cycle-count/open` | Open session; generate batch |
| GET | `/api/department/cycle-count/[id]` | Session + lines + progress |
| POST | `/api/department/cycle-count/[id]/lines/[lineId]/morning` | Submit morning count |
| POST | `/api/department/cycle-count/[id]/lines/[lineId]/evening` | Submit evening count |
| POST | `/api/department/cycle-count/[id]/close` | Close session; compute variances; escalate if needed |

**Morning/evening body**:

```json
{
  "count": 12,
  "barcodeVerified": true,
  "notLocated": false,
  "scannedBarcode": "6001234567890"
}
```

### Admin

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/cycle-count/sessions` | List sessions (filter: date, department, escalated) |
| GET | `/api/admin/cycle-count/sessions/[id]` | Full variance report |
| POST | `/api/admin/cycle-count/sessions/[id]/swap-line` | Replace item in batch (before lock only) |
| GET/POST/DELETE | `/api/admin/cycle-count/config` | Pin / exclude items per department |
| GET | `/api/admin/cycle-count/escalations` | Pending escalations inbox |
| POST | `/api/admin/cycle-count/lines/[lineId]/dismiss` | Mark reviewed, no stock change |
| POST | `/api/admin/cycle-count/lines/[lineId]/approve` | Create `stock_adjustment` linked to line |

### Internal helpers (lib)

| Module | Purpose |
|--------|---------|
| `lib/department/cycle-count-pool.ts` | Build item pool from yesterday sales + config |
| `lib/department/cycle-count-variance.ts` | Movement-adjusted expected qty + tolerance check |
| `lib/department/cycle-count-access.ts` | Department key guards (mirror `purchase-order-access.ts`) |

---

## 9. UI surfaces

### Department — `/department/cycle-count`

| Screen | Purpose |
|--------|---------|
| **Hub** | Shift status badge: Open / Morning / Evening / Closed; "4 of 10 counted" |
| **Open** | Pick department (if multi-type); confirm batch preview; start morning |
| **Count card** | One item: image/name, scan zone, big numeric keypad, Confirm / Not located |
| **Evening** | Same 10 cards; shows morning count for reference |
| **Close summary** | All clear ✅ or "Escalated — awaiting review" |

**UX principles**:

- Tablet & mobile first; large tap targets
- One item at a time (no dense tables on floor)
- Barcode scan as primary identity check
- Progress always visible

Add nav entry in `DepartmentBottomNav` or `DepartmentMobileMoreSheet` (stock manager role only).

### Admin — `/admin/stock-count`

| Screen | Purpose |
|--------|---------|
| **Dashboard** | Today's sessions by department; escalation count |
| **Session detail** | Variance table: item, system AM, count AM, expected PM, count PM, delta |
| **Config** | Pin / exclude items per department key |
| **Batch editor** | Swap items before session lock |
| **Escalation inbox** | Dismiss or approve adjustment per line |

Extend `admin/department-activity` with cycle count events (optional Phase 2).

---

## 10. Notifications

Reuse SSE (`lib/sse/event-bus`, `useDepartmentEvents`).

| Event | When | Channel |
|-------|------|---------|
| `cycle_count:escalated` | Session close with variances | `admin:{businessId}` |
| `cycle_count:resolved` | Admin dismisses/approves all lines | `staff:{opened_by_user_id}` |
| `cycle_count:morning_complete` | Optional nudge for evening count | `staff:{opened_by_user_id}` |

Admin client: badge on Stock Count nav + toast. Staff client: status update on hub screen.

---

## 11. Reuse from existing modules

| Asset | Reuse |
|-------|-------|
| `users.department` JSON | Scope sessions to assigned type keys |
| `/api/items?itemTypes=` | Department catalogue + pool backfill |
| `/api/items/barcode/:code` | Scan verification |
| `useBarcodeScanner` | Floor scanning on count cards |
| `sale_items` + `sales` | Yesterday's sold pool; intraday movement |
| `stock_adjustments` | Admin-approved resolution from escalation |
| `stock_approval_requests` pattern | Dismiss vs approve UX reference |
| `logActivity()` | `cycle_count.open`, `cycle_count.close`, `cycle_count.escalate` |
| `DepartmentAppProvider` | `shopType`, `assignedTypes`, SSE refresh keys |
| `isDiscreteUnitType()` | Integer vs decimal count input |
| `getItemDisplayName()` | Card labels for variants |

**Do not reuse as-is**:

| Asset | Why |
|-------|-----|
| `shifts` table | Cash drawer ≠ inventory audit |
| `StockTakeForm` / `/api/stock/take` | Immediate mutation; desktop ad-hoc flow |
| `department_staff` role | Has `adjust_stock`; wrong trust model for counters |

---

## 12. Design decisions

### D-01: Separate entity from cashier shifts

**Decision**: New `cycle_count_sessions` table. Never attach to `shifts`.

| Approach | Verdict |
|----------|---------|
| Reuse `shifts` | ✗ Conflates cash and inventory |
| New session table | ✓ Clean lifecycle, department-scoped |

### D-02: Separate role from department_staff

**Decision**: `department_stock_manager` role with `run_cycle_count` only.

Counters verify; they do not freely adjust. Keeps audit integrity.

### D-03: No stock mutation on count entry

**Decision**: Counts are recorded on `cycle_count_lines`. `items.current_stock` changes only when admin approves an escalation adjustment.

### D-04: Item pool source

**Decision (v1)**:

1. Primary pool: items sold yesterday in department (`sale_items` joined to `sales` where `status = 'completed'`, filtered by `item_type`)
2. Backfill: random sellable items from department catalogue if pool < batch size
3. Admin pins always included; excludes never selected

**v2**: Weight hot sellers higher in random selection.

### D-05: Batch lock timing

**Decision**: Admin can swap items until the **first morning count** is submitted. After that, batch is immutable for the session.

### D-06: Barcode verification

| Case | Behavior |
|------|----------|
| Item has barcode | Scan must match `items.barcode` (or variant barcode) |
| Item has no barcode | "Confirm item" tap on card sets `barcode_verified = true` |
| Wrong barcode scanned | Reject with clear error; do not advance |

Setting `cycleCount.requireBarcodeScan = false` disables scan requirement globally (not recommended).

### D-07: `not_located` handling

**Decision**:

- Staff can flag `not_located` instead of entering `0`
- Line auto-escalates on session close
- Variance math skips qty comparison for that phase (morning or evening)
- Admin resolves: re-count, confirm zero, or dismiss

### D-08: Tolerance configuration

**Decision**: Store in `businesses.settings.cycleCount`. Snapshot `tolerance_abs` / `tolerance_pct` on session at open so later setting changes do not rewrite history.

**Default**: `toleranceAbs = 2`, `tolerancePct = 5`, `lowStockFloor = 3`.

Escalate if **any** of:

- `|variance| >= tolerance_abs`
- `|variance| / max(expected, 1) * 100 >= tolerance_pct`
- `expected <= lowStockFloor` AND `|variance| >= 1`

### D-09: Branch stock manager in v1

**Decision**: Map to `admin` / `owner`. Introduce `branch_stock_manager` role when multi-branch (`branch_id`) lands.

### D-10: Escalation resolution actions

| Action | Effect |
|--------|--------|
| **Dismiss** | Log review; no stock change; line marked resolved |
| **Approve adjustment** | Create `stock_adjustment` with `reason = 'counting_error'`, `notes` referencing cycle count line; set `actual_stock` to chosen qty (typically evening count) |

### D-11: Incomplete morning count

**Decision**: Block evening close until all 10 morning lines are counted or flagged `not_located`. Optional: allow admin to force-close with audit note (v2).

### D-12: Multi-type stock manager

Staff with `users.department = ["grocery","bakery"]` pick active department per session (same pattern as supply PO `shopType` selector). One session per department per day.

### D-13: Offline counts (deferred)

**v2**: Queue count submissions in IndexedDB (separate store from `pending_sales`); sync on reconnect. Conflict policy: server wins if session already closed.

---

## 13. Variance & movement math

Computed at **session close** (and stored on lines for reporting).

### Snapshots

| Field | When captured |
|-------|---------------|
| `system_stock_morning` | At morning count submit (read `items.current_stock`) |
| `system_stock_evening` | At evening count submit |

### Intraday movement (between morning and evening)

For each `item_id` during `(morning_completed_at, closed_at)`:

```text
sold_qty       = SUM(sale_items.quantity_sold)  -- completed sales
adjusted_net   = SUM(stock_adjustments.difference)  -- all reasons
received_qty   = SUM(purchase_breakdowns qty)  -- department deliveries, if any
```

```text
expected_evening = system_stock_morning - sold_qty + adjusted_net + received_qty
```

Use morning snapshot as baseline, not live stock at evening submit time, so POS sales during the day are expected.

### Variances

```text
variance_morning_system  = morning_count - system_stock_morning
variance_evening_expected = evening_count - expected_evening
variance_intra_day       = evening_count - morning_count + sold_qty - adjusted_net - received_qty
```

(`variance_intra_day` ≈ 0 when physical stock moved only via recorded system movements.)

### Escalation triggers

Escalate line if **any**:

1. `not_located_morning` OR `not_located_evening`
2. `|variance_morning_system|` exceeds tolerance
3. `|variance_evening_expected|` exceeds tolerance
4. `|variance_intra_day|` exceeds tolerance (catches unrecorded shrinkage)

### Example

| Time | Event | System | Physical |
|------|-------|--------|----------|
| 08:00 | Morning count | 20 | 20 |
| Day | 5 sold | 15 | 15 |
| 18:00 | Evening count | 15 | 14 |

```text
expected_evening = 20 - 5 = 15
variance_evening_expected = 14 - 15 = -1  → escalate if tolerance is 0/abs 1
```

---

## 14. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| False positives without movement math | Admin alert fatigue | Implement expected_evening formula in v1 |
| Yesterday pool empty (new dept) | Cannot fill batch | Backfill from department catalogue |
| Parent vs variant confusion | Wrong item counted | `sellableOnly`; pool uses variant IDs |
| Weighted items (kg) | Decimal entry errors | `isDiscreteUnitType`; decimal keypad |
| Two staff open same session | Race condition | Unique constraint; first opener wins |
| department_staff vs stock manager overlap | Wrong permissions | Separate role; do not combine |
| No barcode items | Blocked on scan step | Tap-to-confirm fallback |
| Midday delivery not in movement | False evening variance | Include `purchase_breakdowns` in movement query |
| Offline floor | Lost counts | v2 IndexedDB queue |
| Admin setting change mid-day | Inconsistent tolerance | Snapshot tolerance on session at open |

---

## 15. Implementation phasing

### Phase 1 — Core loop (ship first)

- [ ] Migration: sessions, lines, config tables; `department_stock_manager` role
- [ ] Pool selection from yesterday sales + backfill
- [ ] APIs: open, morning count, evening count, close
- [ ] Movement-adjusted variance at close
- [ ] `/department/cycle-count` mobile UI (one card at a time)
- [ ] Basic admin session list + variance detail

### Phase 2 — Escalation & config

- [ ] Tolerance settings in admin business settings
- [ ] Escalation inbox: dismiss / approve adjustment
- [ ] Pin / exclude config UI
- [ ] Admin batch swap before lock
- [ ] SSE notifications
- [ ] `logActivity` integration

### Phase 3 — Hardening & polish

- [ ] `not_located` flow + reporting
- [ ] Department activity feed integration
- [ ] Analytics: top escalated items / departments
- [ ] Admin force-close incomplete session

### Phase 4 — Optional

- [ ] Offline count queue (IndexedDB)
- [ ] `branch_stock_manager` role when multi-branch exists
- [ ] Weighted random pool (hot sellers prioritized)
- [ ] Configurable batch size per department

---

## 16. Test plan

### Session lifecycle

- [ ] Open session → 10 lines created for department
- [ ] Cannot open duplicate session same department + date
- [ ] Morning: scan + count all 10 → `morning_complete`
- [ ] Cannot close without morning complete
- [ ] Evening: count all 10 → close → variances computed

### Item pool

- [ ] Pool drawn from yesterday's sales in department
- [ ] Pinned item always in batch
- [ ] Excluded item never in batch
- [ ] Pool < 10 backfills from catalogue
- [ ] Admin swap works before first morning count; blocked after

### Barcode & not located

- [ ] Correct barcode → line advances
- [ ] Wrong barcode → error, no save
- [ ] No-barcode item → tap confirm works
- [ ] `not_located` → escalates on close; no qty variance applied

### Variance math

- [ ] Item sold during day: evening variance uses expected_evening, not raw system stock
- [ ] Stock adjustment midday reflected in expected_evening
- [ ] Delivery midday reflected in expected_evening
- [ ] Intra-day variance flags unrecorded shrinkage

### Escalation

- [ ] Within tolerance → session `closed`, no escalation
- [ ] Beyond tolerance → session `escalated`
- [ ] Admin dismiss → line resolved, no stock change
- [ ] Admin approve → `stock_adjustment` created, stock updated

### Permissions & scope

- [ ] `department_stock_manager` cannot call `/api/stock/adjust`
- [ ] Staff only see own department sessions
- [ ] Admin sees all departments
- [ ] `department_staff` cannot access cycle count APIs (unless also assigned role)

### Regression

- [ ] Admin `StockTakeForm` still works unchanged
- [ ] Cashier shifts unaffected
- [ ] Department staff stock screen unaffected

---

## 17. Files reference

### Existing (touch / extend)

| File | Role |
|------|------|
| `lib/constants.ts` | Add `department_stock_manager` to `USER_ROLES` |
| `lib/auth/permissions.ts` | New permissions + role map |
| `lib/db/sql/schema.sql` | New tables (via migration) |
| `lib/db/migrate.ts` | Register migration |
| `middleware.ts` | Route guards for cycle count paths |
| `app/api/users/route.ts` | Allow new role in user CRUD |
| `components/department/DepartmentBottomNav.tsx` | Nav item (role-gated) |
| `components/department/DepartmentMobileMoreSheet.tsx` | Link for stock managers |
| `lib/hooks/use-department-events.ts` | New SSE event types |
| `lib/sse/event-bus.ts` | Publish cycle count events |
| `components/admin/UserForm.tsx` | Role + department assignment |

### New (planned)

| File | Role |
|------|------|
| `lib/db/migrate-cycle-count.ts` | Tables + role migration |
| `lib/department/cycle-count-pool.ts` | Item pool builder |
| `lib/department/cycle-count-variance.ts` | Movement + tolerance logic |
| `lib/department/cycle-count-access.ts` | Auth / department guards |
| `lib/department/cycle-count-constants.ts` | Status enums, defaults |
| `app/api/department/cycle-count/` | Staff session APIs |
| `app/api/admin/cycle-count/` | Admin config + escalation APIs |
| `app/department/cycle-count/page.tsx` | Mobile count hub |
| `components/department/cycle-count/CycleCountShell.tsx` | Layout + status |
| `components/department/cycle-count/CountItemCard.tsx` | One-item flow |
| `components/department/cycle-count/SessionProgress.tsx` | Progress indicator |
| `app/admin/stock-count/page.tsx` | Admin oversight dashboard |
| `components/admin/cycle-count/EscalationInbox.tsx` | Review UI |
| `components/admin/cycle-count/CycleCountConfig.tsx` | Pin / exclude |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-17 | Initial scope document |
