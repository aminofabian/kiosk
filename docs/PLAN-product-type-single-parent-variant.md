# Plan: Explicit Product Types (Single, Parent, Variant)

## Current State Summary

Your codebase **already supports** the three product structures, but they are **inferred** from the database structure rather than explicitly stored:

| Your Term | Codebase Term | How It's Inferred |
|-----------|---------------|-------------------|
| **Single** | `standalone` | `parent_item_id IS NULL` AND no children (no variants point to this item) |
| **Parent** | `parent` | `parent_item_id IS NULL` AND has children (variants) |
| **Variant** | `variant` | `parent_item_id` points to a parent item, has `variant_name` |

**Key files:**
- `ItemForm.tsx` – already has `FormMode = 'standalone' | 'parent' | 'variant'` and Step 2 "Product structure" with Single / Product with Variants / Add Variant
- `app/api/items/route.ts` – uses `parentsOnly`, `sellableOnly`; logic infers type from `parent_item_id` and child existence
- `lib/db/types.ts` – `Item` has `parent_item_id`, `variant_name`; helper types `ParentItem`, `VariantItem`
- Items list groups by parent/standalone; `isParent` is computed at runtime

---

## Modification Options

### Option A: Terminology + UI Only (No Schema Change)

**Goal:** Standardize on "single", "parent", "variant" everywhere and improve UX.

**Changes:**
1. Rename `standalone` → `single` in `ItemForm` (`FormMode`, labels, step text)
2. Add filter in Items list: "All | Single | Parent | Variant"
3. Add badges/labels in item list and detail views (e.g. "Single", "Parent (3 variants)", "Variant of Beans")
4. Ensure "Add New Item" flow clearly presents the three choices

**Pros:** No migration, no schema risk, quick to implement  
**Cons:** Type still inferred; some queries remain structural

---

### Option B: Add Explicit `product_type` Column

**Goal:** Store product type explicitly for clearer semantics and simpler queries.

**Schema change:**
```sql
ALTER TABLE items ADD COLUMN product_type TEXT 
  CHECK (product_type IN ('single', 'parent', 'variant'));
```

**Validation rules:**
| product_type | parent_item_id | variant_name | Has children |
|--------------|----------------|--------------|--------------|
| single       | NULL           | NULL         | No           |
| parent       | NULL           | NULL         | Yes (or 0 at creation) |
| variant      | NOT NULL       | NOT NULL     | No           |

**Migration steps:**
1. Add `product_type` column (nullable initially)
2. Backfill from structure:
   - `parent_item_id IS NOT NULL` → `'variant'`
   - `parent_item_id IS NULL` AND has children → `'parent'`
   - `parent_item_id IS NULL` AND no children → `'single'`
3. Set NOT NULL + default for new rows
4. Add index if you filter by `product_type` often

**Code changes:**
- `lib/db/types.ts` – add `product_type: 'single' | 'parent' | 'variant'` to `Item`
- `app/api/items/route.ts` – POST/PUT set `product_type`; GET can filter by `productType`
- `ItemForm` – pass `product_type` in create/update payload
- All places that infer type can optionally use `product_type` instead

**Pros:** Explicit intent, simpler queries, easier validation, clearer reporting  
**Cons:** Migration, risk of drift if code doesn’t keep it in sync with structure

---

### Option C: Hybrid (Recommended)

1. **Add `product_type`** as in Option B for explicit storage.
2. **Keep structure as source of truth** – enforce that `product_type` matches `parent_item_id` / children.
3. **Standardize terminology** – use "single", "parent", "variant" everywhere.
4. **Add validation** – API rejects mismatches (e.g. `product_type: 'variant'` but `parent_item_id` null).

---

## Implementation Checklist (Option C)

### Phase 1: Schema & Migration

- [ ] Create `lib/db/migrate-product-type.ts`:
  - Add `product_type` column (nullable)
  - Backfill from `parent_item_id` and child existence
  - Add NOT NULL + default for new rows
  - Create index `idx_items_product_type` if needed
- [ ] Run migration, verify backfill
- [ ] Update `lib/db/sql/schema.sql` for new installs

### Phase 2: Types & API

- [ ] `lib/db/types.ts` – add `product_type` to `Item`
- [ ] `app/api/items/route.ts`:
  - POST: set `product_type` from `isParent` / `parentItemId`
  - PUT: update `product_type` when structure changes
  - GET: support `productType` filter
- [ ] Add validation: `product_type` must match structure

### Phase 3: UI – ItemForm

- [ ] Rename `standalone` → `single` in `FormMode` and all labels
- [ ] Ensure create payload includes `product_type`
- [ ] Step 2 labels: "Single", "Parent", "Variant" (or "Add Variant" for variant)

### Phase 4: UI – Items List & Filters

- [ ] Add filter: All | Single | Parent | Variant
- [ ] Show product type badge on each row
- [ ] Update `ItemWithCategory` / list logic to use `product_type` when available

### Phase 5: Other Touchpoints

- [ ] `app/api/items/suggest/route.ts` – consider `product_type` in filters
- [ ] `app/api/profit/route.ts` – already groups by parent; no change unless you want type-specific reports
- [ ] `app/admin/reports/daily/page.tsx` – grouping logic unchanged
- [ ] POS `ItemGrid`, `VariantSelector` – no change (they use structure)

---

## Edge Cases & Validation

1. **Converting single → parent:** User adds first variant; set `product_type = 'parent'`.
2. **Converting parent → single:** User deletes all variants; set `product_type = 'single'`.
3. **Orphan variants:** `parent_item_id` points to deleted parent – handle via FK or soft-delete.
4. **Duplicate names:** Current rules (unique name among standalone/parent; unique variant name per parent) stay the same.

---

## Terminology Mapping (Final)

| Display / API | DB `product_type` | `parent_item_id` | `variant_name` |
|---------------|-------------------|------------------|----------------|
| Single        | `single`          | NULL             | NULL           |
| Parent        | `parent`          | NULL             | NULL           |
| Variant       | `variant`         | parent ID        | e.g. "1kg"     |

---

## Suggested Order

1. **Option A first** – terminology + filters, no schema change. Ship quickly.
2. **Option B/C later** – add `product_type` when you need reporting, filtering, or stricter validation.

If you tell me which option you prefer (A, B, or C), I can outline concrete code changes file-by-file.
