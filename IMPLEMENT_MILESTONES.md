# Grocery vs Shop Classification — Milestone Breakdown

Status legend: ✅ Done | 🔄 Partial | ❌ Not started

---

## Milestone 1: Data Model & Core Types — ✅ DONE

| Task | File | Status |
|------|------|--------|
| Add `item_type` column to items | `lib/db/sql/schema.sql` | ✅ Done (line 96) |
| Add `item_type_snapshot` to sale_items | `lib/db/sql/schema.sql` | ✅ Done (line 281) |
| Add indexes for item_type | `lib/db/sql/schema.sql` | ✅ Done (lines 113, 291) |
| Add Item interface `item_type` | `lib/db/types.ts` | ✅ Done (line 76) |
| Add SaleItem interface `item_type_snapshot` | `lib/db/types.ts` | ✅ Done (line 185) |
| Add ITEM_TYPES constant & ItemType | `lib/constants.ts` | ✅ Done (lines 2–3) |
| Migration script | `lib/db/migrate-item-type.ts` | ✅ Done |

---

## Milestone 2: Backend APIs — 🔄 MOSTLY DONE

### 2a. Items API — 🔄 Partial

| Task | File | Status |
|------|------|--------|
| POST: Accept `itemType` in body | `app/api/items/route.ts` | ✅ Done (line 273, 417) |
| POST: Store `item_type` on create | `app/api/items/route.ts` | ✅ Done |
| GET: Include `item_type` (via SELECT *) | `app/api/items/route.ts` | ✅ Done |
| GET: Optional `itemType` query filter | `app/api/items/route.ts` | ❌ **Not done** |
| PATCH [id]: Update `item_type` on edit | `app/api/items/[id]/route.ts` | ❓ Need to verify |

### 2b. Quick Type Endpoint — ✅ DONE

| Task | File | Status |
|------|------|--------|
| PATCH /api/items/[id]/type | `app/api/items/[id]/type/route.ts` | ✅ Done |

### 2c. Sales API — ✅ DONE

| Task | File | Status |
|------|------|--------|
| POST: Fetch item's `item_type` when creating sale | `app/api/sales/route.ts` | ✅ Done (lines 209–213) |
| POST: Store `item_type_snapshot` on sale_items | `app/api/sales/route.ts` | ✅ Done (lines 229–246, 292–308) |

### 2d. Analytics API — ✅ DONE

| Task | File | Status |
|------|------|--------|
| Add `itemType` query parameter | `app/api/sales/analytics/route.ts` | ✅ Done (line 47) |
| Add `item_type` to ItemSalesData | `app/api/sales/analytics/route.ts` | ✅ Done (line 17) |
| Filter by `item_type` when provided | `app/api/sales/analytics/route.ts` | ✅ Done (lines 118–119) |
| Return `salesByItemType` aggregation | `app/api/sales/analytics/route.ts` | ✅ Done (lines 201–223) |

---

## Milestone 3: Frontend — Item Management — ✅ DONE

| Task | File | Status |
|------|------|--------|
| Add item type selector (Grocery / Retail) to ItemForm | `components/admin/ItemForm.tsx` | ✅ Done |
| Pass `itemType` when creating/editing items | `components/admin/ItemForm.tsx` | ✅ Done |
| Create ItemTypeToggle component (quick switch in list) | `components/admin/ItemTypeToggle.tsx` | ❌ Optional |
| Show type badge in item list | `app/admin/items/page.tsx` | ✅ Uses getItemShopType for filtering |

---

## Milestone 4: Frontend — Sales Analytics — ✅ DONE

| Task | File | Status |
|------|------|--------|
| Replace `getCategoryShopType` with `itemType` API filter | `app/admin/sales/page.tsx` | ✅ Done |
| Pass `itemType` to analytics API | `app/admin/sales/page.tsx` | ✅ Done |
| Add `item_type` to ItemSalesData interface | `app/admin/sales/page.tsx` | ✅ Done |
| Show salesByItemType in UI | `app/admin/sales/page.tsx` | API returns filtered items |

---

## Milestone 5: Dashboard Integration — ✅ DONE

| Task | File | Status |
|------|------|--------|
| Sales Split Card (grocery vs retail revenue) | `app/admin/page.tsx` | ✅ Done |
| Profit Comparison widget | `app/admin/page.tsx` | ✅ Included in Sales by Type card |
| Fast Movers: Top 5 items per type | `app/admin/page.tsx` | ❌ Optional |
| TypeComparisonWidget component | N/A | ❌ Optional |

---

## Milestone 6: Utilities & Cleanup — ✅ DONE

| Task | File | Status |
|------|------|--------|
| Add `getItemShopType(item)` to shop-type.ts | `lib/utils/shop-type.ts` | ✅ Done |
| Use getItemShopType in items page | `app/admin/items/page.tsx` | ✅ Done |

---

## Recommended Implementation Order

1. **Milestone 6 (shop-type.ts)** — Add `getItemShopType`; keeps migration/backfill logic usable.
2. **Milestone 3 (ItemForm)** — Add type selector so new items have correct type.
3. **Milestone 4 (Sales page)** — Switch to `itemType` API filter; remove client-side `getCategoryShopType`.
4. **Milestone 2a (Items GET filter)** — Add `itemType` query param to items API (optional but useful).
5. **Milestone 5 (Dashboard)** — Add grocery vs retail widgets.
6. **Milestone 3 (ItemTypeToggle)** — Optional: quick type toggle in item list.

---

## Summary

| Milestone | Done | Partial | Remaining |
|-----------|------|---------|-----------|
| 1. Data Model | 7/7 | 0 | 0 |
| 2. Backend APIs | 9 | 0 | 0 |
| 3. Item Management UI | 3 | 0 | 1 (optional) |
| 4. Sales Analytics UI | 4 | 0 | 0 |
| 5. Dashboard | 2 | 0 | 2 (optional) |
| 6. Utilities | 2 | 0 | 0 |

**Overall: Core implementation complete. Optional: ItemTypeToggle, Fast Movers widget.**
