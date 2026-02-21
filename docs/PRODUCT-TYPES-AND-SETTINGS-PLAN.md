# Product Types, Settings & Supplier Categorization — Plan

This document scopes and plans the introduction of configurable product types, an admin settings page, dynamic sales/profit pages per type, and supplier categorization.

---

## Current State

- **Product types** are hardcoded as `['grocery', 'retail']` in `lib/constants.ts`
- This is enforced at every layer: SQL `CHECK` constraints, TypeScript types, API filtering, POS UI, analytics pages, sidebar navigation, and category-to-type mappings
- **Suppliers** have no `type` or `category` field — they're generic
- **No admin settings page** exists (only a superadmin platform settings page)
- Sales and Profit pages have **hardcoded sub-routes** for `/grocery` and `/retail`

---

## Proposed Plan

### Phase 1: Dynamic Product Types via Admin Settings

#### 1a. Create an Admin Settings page (`app/admin/settings/page.tsx`)

- Add a "Product Types" section where the business owner can manage their product types (add/remove/rename)
- Default types: `grocery`, `retail` (pre-seeded)
- New types like `cereals`, `electronics`, etc. can be added
- Each type gets a name, an emoji/icon, and a color for charts
- Store in the `businesses.settings` JSON column (already exists as `TEXT` in the schema)

#### 1b. Update `lib/constants.ts`

- Replace the hardcoded `ITEM_TYPES` array with a function that reads from business settings
- Keep `grocery` and `retail` as defaults/fallbacks
- Create a React context or hook (`useItemTypes`) that provides the dynamic list

#### 1c. Database schema changes

- Remove the `CHECK (item_type IN ('grocery', 'retail'))` constraint from `items.item_type`
- Remove the `CHECK (item_type_snapshot IN ('grocery', 'retail'))` constraint from `sale_items.item_type_snapshot`
- Keep columns as `TEXT` — validation moves to the application layer

#### 1d. Update all hardcoded references

- `lib/utils/shop-type.ts` — make category mappings configurable or remove fixed lists
- `components/pos/ShopTypeSelector.tsx` — render dynamically from settings
- `app/admin/items/page.tsx` — dynamic type filter tabs
- `app/admin/page.tsx` (dashboard) — dynamic type breakdown cards
- All API routes that filter by `itemType` — accept any valid type string

---

### Phase 2: Dynamic Sales & Profit Sub-pages

#### 2a. Convert hardcoded routes to dynamic routes

- Replace `app/admin/sales/grocery/page.tsx` and `app/admin/sales/retail/page.tsx` with a single dynamic route: `app/admin/sales/[type]/page.tsx`
- Same for profit: `app/admin/profit/[type]/page.tsx`
- The `[type]` param is validated against the business's configured product types
- Reuse the existing page logic — it already accepts `itemType` as an API filter

#### 2b. Update sidebar navigation (`components/admin/AdminSidebar.tsx`)

- Dynamically generate sub-items under "Sales" and "Profit" based on configured product types
- Instead of hardcoded Grocery/Retail entries, loop over the types from settings

#### 2c. Update overview pages

- `app/admin/sales/page.tsx` — dynamically render department cards for each type
- `app/admin/profit/page.tsx` — dynamically fetch and display profit for each type
- Charts and comparisons adapt to N types instead of just 2

---

### Phase 3: Supplier Categorization

#### 3a. Add `supplier_type` to suppliers table

- New column: `supplier_type TEXT` (nullable, for backward compat)
- References the same dynamic product types from settings (e.g., `retail`, `grocery`, `cereals`)
- Could also allow a custom free-text type or a `general` option

#### 3b. Update Supplier API routes

- `app/api/suppliers/route.ts` — accept and persist `supplier_type`
- Support filtering suppliers by type

#### 3c. Update Supplier UI

- Supplier creation/edit forms — add a type dropdown populated from business settings
- Supplier list — show type badge, add filter by type
- `components/admin/SupplierBillForm.tsx` — optionally filter supplier dropdown by type

#### 3d. Temporary quick-type buttons for existing suppliers

- Add **temporary** UI that lets you set a supplier’s type with one click (no form).
- **Where:** Wherever suppliers are listed or opened:
  - **Supplier Products Drawer** (`SupplierProductsDrawer.tsx`) — when a supplier is open, show a row of type “buttons” (e.g. 🥬 Grocery, 🏪 Retail, 🌾 Cereals). Click one to set that supplier to that type and persist via PATCH.
  - **Supplier Budget Planner** (in `SupplierBillsList.tsx`) — in the supplier table, add a “Type” column or inline row of icon-only buttons per supplier; click to set type and refetch list.
- **Behaviour:** One click on a type icon/button calls `PATCH /api/suppliers/[id]` with `{ supplierType: 'grocery' }` (or `retail`, `cereals`, etc.) and updates that supplier. UI shows current type (e.g. highlighted/selected button) and refreshes after update.
- **Types to show:** Use same set as product types (e.g. grocery, retail, cereals) with distinct icon/emoji per type; can be driven by settings later.
- **Note:** Mark as temporary so it can be replaced later by the full type dropdown in create/edit and filters (3b–3c).

---

## Files Affected (Estimated)

| Area | Files | Complexity |
|------|-------|------------|
| Settings page (new) | 1 new page + 1 API route | Medium |
| Constants/types | `lib/constants.ts`, `lib/db/types.ts` | Low |
| DB schema | `schema.sql`, migration script | Low |
| Shop type utils | `lib/utils/shop-type.ts` | Medium |
| POS page | `app/pos/page.tsx`, `ShopTypeSelector.tsx`, `ItemGrid.tsx` | Medium |
| Admin items | `app/admin/items/page.tsx` | Low |
| Admin dashboard | `app/admin/page.tsx` | Medium |
| Sales pages | `app/admin/sales/page.tsx`, new `[type]/page.tsx` | Medium |
| Profit pages | `app/admin/profit/page.tsx`, new `[type]/page.tsx` | Medium |
| Sidebar nav | `AdminSidebar.tsx` | Low |
| Suppliers | `schema.sql`, API route, supplier forms | Medium |
| Supplier quick-type (temporary) | `SupplierBillsList`, `SupplierProductsDrawer`, PATCH suppliers | Low |
| Analytics APIs | `sales/analytics`, `profit`, `daily-summary` routes | Medium |

---

## Suggested Implementation Order

1. **Phase 1a + 1c** — Admin settings page + DB constraint removal (foundation)
2. **Phase 1b + 1d** — Dynamic types hook + update all hardcoded references
3. **Phase 2a + 2b** — Dynamic sales/profit routes + sidebar
4. **Phase 2c** — Overview pages adapt to N types
5. **Phase 3** — Supplier categorization (3a–3c). **3d** (temporary quick-type buttons) can be done early to backfill types for existing suppliers.

---

## Key Design Decisions to Make

1. **Should product types be deletable?** If a type has existing items/sales, deleting it would orphan data. Consider "archive" (hide) instead of delete.
2. **Should suppliers support multiple types?** e.g., a supplier that provides both grocery and cereal items. Could be a comma-separated list or a single type.
3. **Should the POS shop type selector show all types or just the ones with items?** Showing empty types could confuse cashiers.
4. **Category-to-type mapping** — currently `lib/utils/shop-type.ts` has hardcoded lists of which categories belong to grocery vs retail. Consider making this a per-category setting instead.

---

## Reference: Current Codebase Locations

### Product types

- **Definition:** `lib/constants.ts` — `ITEM_TYPES = ['grocery', 'retail']`, `ItemType`
- **Schema:** `lib/db/sql/schema.sql` — `items.item_type`, `sale_items.item_type_snapshot` with CHECK constraints
- **Types:** `lib/db/types.ts` — `Item.item_type`, `SaleItem.item_type_snapshot`
- **Usage:** `app/api/items/route.ts`, `app/admin/items/page.tsx`, `components/pos/ItemGrid.tsx`, `app/admin/page.tsx`, `app/admin/sales/page.tsx`, `app/api/sales/analytics/route.ts`, `app/api/profit/route.ts`, `app/api/reports/daily-summary/route.ts`, `lib/utils/shop-type.ts`

### Settings

- **Superadmin:** `app/superadmin/settings/page.tsx`, `app/api/superadmin/settings/route.ts`
- **Business settings:** `businesses.settings` (JSON TEXT) in `lib/db/sql/schema.sql`

### Suppliers

- **Schema:** `lib/db/sql/schema.sql` — `suppliers` table (no type column today)
- **API:** `app/api/suppliers/route.ts`
- **UI:** `components/admin/SupplierBillForm.tsx`, `components/admin/SupplierProductsDrawer.tsx`

### Navigation & pages

- **Sidebar:** `components/admin/AdminSidebar.tsx` — SECTIONS with hardcoded Grocery/Retail under Sales and Profit
- **Sales:** `app/admin/sales/page.tsx`, `app/admin/sales/grocery/page.tsx`, `app/admin/sales/retail/page.tsx`
- **Profit:** `app/admin/profit/page.tsx`, `app/admin/profit/grocery/page.tsx`, `app/admin/profit/retail/page.tsx`
- **Shop type:** `lib/utils/shop-type.ts`, `components/pos/ShopTypeSelector.tsx`, `app/pos/page.tsx`
