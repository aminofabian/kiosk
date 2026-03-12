# Supplier-Linked Buying/Cost Prices

Implementation plan for linking buying/cost prices to suppliers, allowing products to have multiple buying prices (one per supplier).

---

## Phase 1 Decision (Implemented)

**Chosen approach:** Option B – Cost history (hybrid)

- Keep `supplier_products.default_cost_price` as the current/default cost per supplier–product
- Add `buying_prices` table for history and analytics
- When cost is set or used, write a record to `buying_prices`
- `supplier_id` nullable: null = generic/default cost, non-null = supplier-specific

---

## Current State Summary

| Component | Current Behavior |
|-----------|------------------|
| **`supplier_products`** | `(supplier_id, item_id)` unique, with single `default_cost_price` per link |
| **`inventory_batches`** | Each batch has `buy_price_per_unit` + `supplier_id` (actual cost at purchase) |
| **Supplier bill flow** | Prefills buy price from `default_cost_price` → `last_buy_price` → empty |
| **Cost history** | No history table (unlike `selling_prices`) |

The system already supports one cost price per supplier–product pair. This plan extends it to support cost history and better UX.

---

## Phase 1: Requirements Options

| Option | Description | Complexity |
|--------|-------------|------------|
| **A. One price per supplier** | Each supplier–product link has one current cost | ✅ Already done |
| **B. Cost history** | Track cost changes over time per supplier–product | Medium |
| **C. Volume/quantity tiers** | Different prices for different quantities (e.g. 1–10 vs 11+) | Higher |
| **D. Multiple price records** | Several price records per supplier–product (e.g. different dates, notes) | Medium |

---

## Phase 2: Database Changes

### Option 1: Cost Price History (like `selling_prices`)

Add a `buying_prices` table for history and reporting:

```sql
CREATE TABLE buying_prices (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  supplier_id TEXT,
  price REAL NOT NULL,
  effective_from INTEGER NOT NULL DEFAULT (unixepoch()),
  set_by TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

CREATE INDEX idx_buying_prices_item_supplier ON buying_prices(item_id, supplier_id);
CREATE INDEX idx_buying_prices_effective ON buying_prices(item_id, supplier_id, effective_from DESC);
```

- `supplier_id` nullable: null = generic/default cost, non-null = supplier-specific.
- `supplier_products.default_cost_price` stays as the "current" price; `buying_prices` is for history.

### Option 2: Multiple Prices per Supplier–Product (no history)

If you only need multiple prices per supplier–product (e.g. different tiers), add:

```sql
CREATE TABLE supplier_product_prices (
  id TEXT PRIMARY KEY,
  supplier_product_id TEXT NOT NULL,
  price REAL NOT NULL,
  min_quantity REAL,
  notes TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (supplier_product_id) REFERENCES supplier_products(id) ON DELETE CASCADE
);
```

---

## Phase 3: Recommended Approach (Hybrid)

1. **Keep `supplier_products.default_cost_price`** as the current/default cost per supplier–product.
2. **Add `buying_prices`** for history and analytics.
3. **Update flows** so that whenever a cost is set or used, a record is written to `buying_prices`.

### Migration: `lib/db/migrate-buying-prices.ts`

- Create `buying_prices` table
- Backfill: insert one row per `supplier_product` with `default_cost_price`
- (Optional) backfill from latest `inventory_batch` per item+supplier

---

## Phase 3: Write Paths (Implemented)

All flows that set or use cost now record to `buying_prices`:

| Area | Files | Status |
|------|-------|--------|
| **Helper** | `lib/db/buying-prices.ts` | `recordBuyingPrice()` – fails silently if table missing |
| **API** | `app/api/items/[id]/prices/route.ts` | ✅ PATCH buy price |
| **API** | `app/api/items/route.ts` | ✅ POST create item with buy price |
| **API** | `app/api/items/[id]/route.ts` | ✅ PATCH update item buy price |
| **API** | `app/api/suppliers/[id]/products/route.ts` | ✅ POST link with cost, PATCH update cost |
| **API** | `app/api/supplier-bills/route.ts` | ✅ POST create bill with stock items |
| **API** | `app/api/purchases/[id]/breakdown/route.ts` | ✅ POST confirm breakdown |

---

## Phase 4: Files to Touch

| Area | Files | Changes |
|------|-------|---------|
| **DB** | `lib/db/migrate-buying-prices.ts` | New migration |
| **DB** | `lib/db/sql/schema.sql` | Add `buying_prices` (if you keep schema in sync) |
| **API** | `app/api/items/[id]/prices/route.ts` | ✅ Write to `buying_prices` when updating buy price |
| **API** | `app/api/suppliers/[id]/products/route.ts` | ✅ On PATCH `default_cost_price`, insert into `buying_prices` |
| **API** | `app/api/supplier-bills/route.ts` | ✅ On create, insert into `buying_prices` for each stock item |
| **API** | `app/api/purchases/[id]/breakdown/route.ts` | ✅ On confirm, insert into `buying_prices` |
| **API** | `app/api/items/[id]/cost-history/route.ts` | New endpoint to list cost history per item (and supplier) |
| **UI** | `components/admin/SupplierProductsDrawer.tsx` | Show/edit cost per supplier |
| **UI** | `components/admin/SupplierBillForm.tsx` | Already uses `default_cost_price`; optionally show history |
| **UI** | Item detail / product edit | Show "cost by supplier" and "cost history" |

---

## Phase 5: API Design (Implemented)

### New Endpoints

**1. Cost history by item** ✅

```
GET /api/items/[id]/cost-history?supplierId=xxx
→ Returns: { id, itemId, supplierId, supplierName, price, effectiveFrom, setBy, setByName, notes, createdAt }[]
```

**2. Supplier-specific cost prices** ✅

```
GET /api/items/[id]/supplier-costs
→ Returns: { supplierId, supplierName, defaultCostPrice, lastBuyPrice }[]
```

**3. Update cost for a supplier–product** ✅

```
PATCH /api/suppliers/[id]/products
Body: { itemId, defaultCostPrice }
→ Updates supplier_products.default_cost_price + inserts into buying_prices
```

---

## Phase 6: UI Enhancements (Implemented)

1. **Supplier product management** (`SupplierProductsDrawer`) ✅
   - Show cost per supplier
   - Inline cost editing (click cost → edit → save)
   - "View item & cost history" link (opens item edit in new tab)

2. **Item detail** (product edit page) ✅
   - "Cost by supplier" section: list of suppliers and their cost
   - "View history" button opens cost history dialog

3. **Supplier bill form** ✅
   - Prefills from `default_cost_price` → `last_buy_price`; shows "From supplier" or "From last purchase" hint under buy price

4. **Purchase breakdown** ✅
   - When purchase has a supplier, breakdown form prefills buy price from `supplier_products.default_cost_price` when the item is linked to that supplier

---

## Phase 7: Implementation Order

1. **Migration** – Add `buying_prices` table
2. **Backfill** – Populate from `supplier_products.default_cost_price` and (optionally) latest `inventory_batches`
3. **Write path** – When cost is set in:
   - supplier products PATCH,
   - supplier bill creation,
   - purchase breakdown confirmation,
   - item update (buy price),
   insert into `buying_prices`
4. **Read path** – Add `GET /api/items/[id]/cost-history` and `GET /api/items/[id]/supplier-costs`
5. **UI** – Supplier product drawer, item detail, and optional history views

---

## Decisions to Make

1. **History** – Do you want cost history?
2. **Volume** – Do you need volume/quantity tiers?
3. **Default** – When no supplier is set, should `buying_prices` use `supplier_id = NULL`?

---

## Minimal Change (No New Tables)

If you only want to improve UX:

- Keep `supplier_products` as is
- Add `GET /api/items/[id]/supplier-costs` that returns suppliers and their `default_cost_price` (and optionally `last_buy_price` from batches)
- Add a "Cost by supplier" section in the item detail UI

---

## Related Files

- `lib/db/sql/schema.sql` – Main schema
- `lib/db/migrate-supplier-products.ts` – Supplier–product link with `default_cost_price`
- `app/api/suppliers/[id]/products/route.ts` – Manage supplier products and cost
- `components/admin/SupplierBillForm.tsx` – Uses `default_cost_price` when adding linked products
- `components/admin/SupplierProductsDrawer.tsx` – Manage products linked to a supplier
