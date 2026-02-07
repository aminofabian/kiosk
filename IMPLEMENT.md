Grocery vs Shop Classification System
Separating grocery items from retail/shop items across the entire POS system while maintaining data integrity and providing powerful analytics.

User Review Required
IMPORTANT

Data Model Decision: This plan proposes an item_type enum (grocery | retail) stored directly on each item. An alternative approach using a separate mapping table was considered but rejected for simplicity. Please confirm this aligns with your vision.

WARNING

Historical Data Behavior: When an item's type changes, historical sales will show the type at time of sale (snapshot), not the current type. This is the recommended approach for accurate historical reporting.

Current State Analysis
What Exists Today
Component	Current State	Issue
Data Model	No item_type field on items	Classification is runtime-inferred
shop-type.ts	Hardcoded category name lists	Fragile - adding a new category breaks classification
Sales Analytics	Client-side filtering by category name	Slow, inconsistent, no historical accuracy
Sale Items	No type snapshot	Can't accurately report past sales by type
Key Files Affected
lib/db/sql/schema.sql          # Add item_type to items, sale_items
lib/db/types.ts                # Update Item and SaleItem interfaces
lib/constants.ts               # Add ITEM_TYPES constant
lib/utils/shop-type.ts         # Simplify to use item.item_type directly
app/api/items/route.ts         # Accept/return item_type
app/api/sales/route.ts         # Store item_type_snapshot on sale_items
app/api/sales/analytics/route.ts # Filter/group by item_type
components/admin/ItemForm.tsx  # Add item_type selector
app/admin/sales/page.tsx       # Enhanced analytics with proper filtering
Proposed Changes
Phase 1: Data Model & Backend
[MODIFY] 
schema.sql
Add item_type column to items table and item_type_snapshot to sale_items:

sql
-- Add to items table (line ~102)
item_type TEXT NOT NULL DEFAULT 'retail' CHECK (item_type IN ('grocery', 'retail')),
-- Add to sale_items table (line ~281)
item_type_snapshot TEXT CHECK (item_type_snapshot IN ('grocery', 'retail')),
[NEW] 
migrate-item-type.ts
Migration script to:

Add item_type column with default 'retail'
Add item_type_snapshot column to sale_items
Backfill existing items based on category name heuristics (using existing GROCERY_CATEGORIES list)
Backfill historical sale_items based on item's current type (best effort)
[MODIFY] 
types.ts
typescript
// Add to Item interface (line 69-89)
item_type: ItemType;
// Add to SaleItem interface (line 177-187)
item_type_snapshot: ItemType | null;
[MODIFY] 
constants.ts
typescript
// Add new constant
export const ITEM_TYPES = ['grocery', 'retail'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
[MODIFY] 
shop-type.ts
Simplify to use item.item_type directly instead of category name inference:

typescript
// Keep for backward compatibility, but add item-based function
export function getItemShopType(item: { item_type?: ItemType }): ShopType {
  return item.item_type || 'retail';
}
// Deprecate getCategoryShopType - keep for migration only
Phase 2: API Updates
[MODIFY] 
items/route.ts
POST handler (line 254-472):

Accept itemType in request body
Store item_type when creating item
Default to 'retail' if not provided
GET handler (line 16-251):

Include item_type in response (already returned via SELECT *)
Add optional itemType query parameter for filtering
[NEW] 
items/[id]/type/route.ts
Quick endpoint to update item type:

typescript
// PATCH /api/items/[id]/type
// Body: { itemType: 'grocery' | 'retail' }
[MODIFY] 
sales/route.ts
POST handler (line 206-309):

Fetch item's item_type when creating sale_item
Store as item_type_snapshot on each sale_item record
[MODIFY] 
sales/analytics/route.ts
Add itemType filter parameter and return aggregated stats by type:

typescript
// Query changes:
// - Add item_type to ItemSalesData interface
// - Add filter: WHERE si.item_type_snapshot = ? (if filter provided)
// - Add new endpoint data: salesByItemType
Phase 3: Frontend Changes
[MODIFY] 
ItemForm.tsx
Add item type selector near the top of the form:

tsx
<div className="flex gap-2">
  <Button 
    variant={itemType === 'grocery' ? 'default' : 'outline'}
    onClick={() => setItemType('grocery')}
  >
    🥬 Grocery
  </Button>
  <Button 
    variant={itemType === 'retail' ? 'default' : 'outline'}
    onClick={() => setItemType('retail')}
  >
    🏪 Retail
  </Button>
</div>
[NEW] 
ItemTypeToggle.tsx
Reusable component for quick type switching in item lists:

tsx
interface ItemTypeToggleProps {
  itemId: string;
  currentType: ItemType;
  onTypeChange: (newType: ItemType) => void;
}
[MODIFY] 
sales/page.tsx
Replace client-side category-based filtering with server-side item_type filtering:

Remove 
getCategoryShopType
 usage (lines 35, 181-193)
Add itemType query parameter to API calls
Keep toggle buttons but wire to API filter
[NEW] 
TypeComparisonWidget.tsx
Dashboard widget showing:

Grocery vs Retail sales split (pie/bar chart)
Revenue comparison
Profit margin comparison
Top items per category
Phase 4: Dashboard Integration
[MODIFY] Admin Dashboard
Add new widgets:

Sales Split Card: Pie chart showing grocery vs retail revenue
Profit Comparison: Side-by-side profit margins
Fast Movers: Top 5 items by type
Data Model Decision: Enum vs Category Table
Option A: Enum on Item (Recommended ✅)
typescript
item_type: 'grocery' | 'retail'
Pros:

Simple, fast queries
No joins needed
Easy to understand and extend
Cons:

Schema migration needed to add new types
Option B: Category has shop_type
sql
ALTER TABLE categories ADD COLUMN shop_type TEXT;
Pros:

Type is inherited from category
Changing category type changes all items
Cons:

Items can't override category type
Mixed-type categories impossible
Option C: Separate item_classifications table
sql
CREATE TABLE item_classifications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,     -- 'grocery', 'retail', 'service'
  icon TEXT,
  color TEXT
);
Pros:

Maximum flexibility
Easy to add new types
Cons:

Over-engineering for 2 types
Extra join on every query
Recommendation: Use Option A (enum on item) for simplicity. If you need services/bundles later, it's easy to extend the enum.

Edge Cases & Handling
Mixed Carts
Cart can contain both grocery and retail items
Analytics counts each item toward its respective type
No special handling needed
Refunds
Refunds should use item_type_snapshot from original sale_item
Ensures historical accuracy
Item Type Changes
Historical sale_items retain their item_type_snapshot
Future sales use the new type
Dashboard shows accurate point-in-time data
Discounts Applied to Cart
Discount is proportionally allocated to each item type based on revenue share
Example: 10% off cart with 60% grocery, 40% retail → discount split 60/40
Items Without Type (Migration)
Default all existing items to 'retail'
Backfill grocery items based on category name matching
Manual review UI for uncertain items
Grocery-Specific KPIs
Add these metrics specifically for grocery items:

KPI	Description	Calculation
Sell-Through Rate	How fast items move	Units sold / (Units sold + Current stock)
Days of Inventory	Stock runway	Current stock / Avg daily sales
Expiring Soon	Items near expiry	Count where expiry_date < now + 7 days
Wastage Rate	Spoilage percentage	Spoilage adjustments / Total stock
Margin Pressure	Low-margin items	Items where profit < 15%
Analytics Queries
Grocery vs Retail Summary
sql
SELECT 
  si.item_type_snapshot as item_type,
  COUNT(DISTINCT s.id) as transaction_count,
  SUM(si.quantity_sold) as items_sold,
  SUM(si.quantity_sold * si.sell_price_per_unit) as revenue,
  SUM(si.profit) as profit
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
WHERE s.business_id = ? AND s.status = 'completed'
GROUP BY si.item_type_snapshot
Drill-Down: Category → Item → Time
sql
-- Level 1: By type
SELECT item_type_snapshot, SUM(profit) as profit FROM sale_items GROUP BY item_type_snapshot
-- Level 2: By category within type
SELECT c.name, SUM(si.profit) 
FROM sale_items si
JOIN items i ON si.item_id = i.id
JOIN categories c ON i.category_id = c.id
WHERE si.item_type_snapshot = 'grocery'
GROUP BY c.name
-- Level 3: By item within category
SELECT i.name, SUM(si.profit)
FROM sale_items si
JOIN items i ON si.item_id = i.id
WHERE i.category_id = ?
GROUP BY i.id, i.name
-- Level 4: By time period
SELECT DATE(s.sale_date, 'unixepoch') as sale_day, SUM(si.profit)
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
WHERE si.item_id = ?
GROUP BY sale_day
Scalability Considerations
Indexes
sql
CREATE INDEX idx_items_item_type ON items(business_id, item_type);
CREATE INDEX idx_sale_items_type ON sale_items(item_type_snapshot);
Query Performance
All new queries use indexed columns
Analytics queries are read-heavy, benefit from indexes
No full table scans required
Future Extensibility
Adding 'service' type: Single migration to extend CHECK constraint
Adding 'bundle' type: Same approach
Multi-tenant: Already scoped by business_id
Backward Compatibility
Concern	Mitigation
Existing items without type	Default to 'retail', backfill groceries
Historical sale_items	Backfill item_type_snapshot based on item's current type
Frontend components	Graceful fallback if item_type is undefined
API consumers	item_type is optional in request, required in response
Risks & Mitigation
Risk	Likelihood	Impact	Mitigation
Migration fails mid-way	Low	High	Wrap in transaction, test on backup first
Incorrect category → type mapping	Medium	Medium	Manual review step, easy to fix later
Performance regression	Low	Medium	Add indexes, monitor query times
UI complexity	Low	Low	Keep type toggle simple, 2 buttons
Verification Plan
1. Database Migration
Command to run migration:

bash
cd /Users/mac/Documents/projects/pos
npm run dev
# Then navigate to /api/db/migrate-item-type to trigger migration
# OR run: npx ts-node lib/db/migrate-item-type.ts
Manual verification:

Check schema: SELECT sql FROM sqlite_master WHERE name='items' should show item_type column
Check sale_items: SELECT sql FROM sqlite_master WHERE name='sale_items' should show item_type_snapshot column
Verify data: SELECT item_type, COUNT(*) FROM items GROUP BY item_type should show items categorized
2. Item Type Selection (Manual Browser Test)
Steps:

Navigate to /admin/products
Click "Add Product" button
Verify type toggle buttons appear (🥬 Grocery | 🏪 Retail)
Select "Grocery", fill other fields, save
Verify item shows grocery badge in list
Edit item, change to "Retail", save
Verify badge updates
Expected Results:

Toggle buttons visible and functional
Type persists after save
Type displays correctly in item list
3. Quick Type Toggle in Item List
Steps:

Navigate to /admin/products
Find an existing item
Click the type badge/toggle next to item name
Verify type changes immediately (optimistic update)
Refresh page, verify type persisted
4. Sales Flow Integration
Steps:

Create a grocery item (e.g., "Tomatoes - Grocery")
Create a retail item (e.g., "Sugar 1kg - Retail")
Go to POS (/pos)
Add both items to cart
Complete sale
Check database:
sql
SELECT si.*, i.name 
FROM sale_items si 
JOIN items i ON si.item_id = i.id 
ORDER BY si.created_at DESC LIMIT 10
Verify item_type_snapshot is set correctly for each
5. Analytics Filtering
Steps:

Navigate to /admin/sales
Click "Grocery" filter button
Verify only grocery items appear in results
Verify summary cards show grocery-only totals
Click "Retail" filter button
Verify only retail items appear
Click "All" to reset
Compare totals with original (should match)
6. Historical Data Integrity
Steps:

Change an item from "Grocery" to "Retail"
Navigate to /admin/sales
Filter by "Grocery"
Verify historical sales of that item still appear under Grocery
Make a new sale with that item
Verify new sale appears under "Retail" filter
7. Edge Case: Mixed Cart
Steps:

Add 1 grocery item (KES 100) and 1 retail item (KES 200) to cart
Complete sale
Check analytics:
Grocery shows KES 100 revenue
Retail shows KES 200 revenue
Total shows KES 300
Implementation Order
Database & Types (Day 1)

Create migration script
Update types.ts
Update constants.ts
Backend APIs (Day 1-2)

Update items route (create/update)
Add quick type toggle endpoint
Update sales route (snapshot)
Update analytics route
Frontend (Day 2-3)

ItemForm type selector
Item list type toggle
Sales analytics page updates
Dashboard Widgets (Day 3)

Type comparison widget
Grocery-specific KPIs
Testing & Polish (Day 4)

Manual testing per verification plan
Edge case testing
Performance review

Comment
⌥⌘M
