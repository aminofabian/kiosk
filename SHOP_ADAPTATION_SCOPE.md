# Shop Adaptation Scope - From Grocery POS to Universal Retail

> **Transforming your Grocery POS into a flexible shop management system**

---

## 📋 Current System Analysis

Your system is a **well-architected multi-tenant POS** with these core features:

| Feature | Status | Shop-Ready? |
|---------|--------|-------------|
| Multi-tenant (businesses) | ✅ Complete | ✅ Yes |
| Role-based access | ✅ Complete | ✅ Yes |
| Product catalog (items/categories) | ✅ Complete | ⚠️ Needs tweaks |
| Product variants | ✅ Complete | ✅ Yes |
| Inventory/FIFO tracking | ✅ Complete | ✅ Yes |
| Purchase recording | ✅ Complete | ✅ Yes |
| Sales processing | ✅ Complete | ✅ Yes |
| Payment methods (Cash/M-Pesa/Credit) | ✅ Complete | ✅ Yes |
| Credit accounts | ✅ Complete | ✅ Yes |
| Shift management | ✅ Complete | ✅ Yes |
| Profit tracking | ✅ Complete | ✅ Yes |
| Reports | ✅ Complete | ✅ Yes |

**Good news:** ~85% of your system is already shop-agnostic! The changes needed are mostly cosmetic and configuration-based.

---

## 🎯 What Makes a "Shop" Different from "Grocery"?

| Aspect | Grocery Store | General Shop |
|--------|---------------|--------------|
| **Unit types** | kg, g, bunch, piece | piece, box, pack, set, pair, dozen |
| **Categories** | Food-focused | Depends on shop type |
| **Stock urgency** | Perishables (expiry dates) | May not expire |
| **Pricing** | Often weight-based | Usually fixed per item |
| **Barcodes/SKU** | Sometimes | Usually important |
| **Returns** | Rarely | Often needed |
| **Discounts** | Occasional | Frequent (sales, promos) |
| **Customer loyalty** | Basic credit | Points, memberships |

---

## 🛠️ Adaptation Scope - Organized by Priority

### Phase A: Quick Wins (Configuration Changes)
**Effort: 1-2 days | Impact: High**

These require minimal code changes—mostly adding flexibility:

#### A1. Configurable Business Type
Allow businesses to set their shop type during registration.

```typescript
// Add to lib/constants.ts
export const BUSINESS_TYPES = [
  'grocery',
  'electronics', 
  'clothing',
  'hardware',
  'pharmacy',
  'general_retail',
  'restaurant',
  'salon',
  'other'
] as const;
```

**Files to modify:**
- `lib/constants.ts` - Add business types
- `lib/db/types.ts` - Add `business_type` to Business interface
- `lib/db/sql/schema.sql` - Add column to businesses table
- Registration flow - Add business type selection

#### A2. Flexible Unit Types
Expand unit types beyond grocery-specific ones.

```typescript
// Update lib/constants.ts
export const UNIT_TYPES = [
  // Grocery
  'kg', 'g', 'litre', 'ml', 'bunch', 'tray',
  // General retail
  'piece', 'box', 'pack', 'set', 'pair', 'dozen', 'meter', 'roll',
  // Services
  'hour', 'session', 'service'
] as const;
```

**Files to modify:**
- `lib/constants.ts` - Expand UNIT_TYPES

#### A3. Rebrand UI Text
Make the interface shop-agnostic.

| Current | Change To |
|---------|-----------|
| "Grocery POS" | "Kiosk POS" or configurable business name |
| "Green grocery" category | Generic category icons |
| Food-specific category images | Dynamic/uploaded images |

**Files to modify:**
- `app/pos/page.tsx` - Remove hardcoded "Grocery POS" references
- `components/pos/CategoryList.tsx` - Use generic defaults
- Remove `CATEGORY_IMAGE_MAP` hardcoding, use uploaded images

---

### Phase B: Essential Features for General Retail
**Effort: 5-7 days | Impact: High**

#### B1. SKU/Barcode Support
Most non-grocery shops rely heavily on barcodes.

**Schema changes:**
```sql
ALTER TABLE items ADD COLUMN sku TEXT;
ALTER TABLE items ADD COLUMN barcode TEXT;
CREATE INDEX idx_items_barcode ON items(barcode);
CREATE INDEX idx_items_sku ON items(sku);
```

**New features:**
- Barcode scanner input on POS (the "Scan Barcode" button is already in UI!)
- SKU field in item form
- Quick lookup by scanning

**Files to create/modify:**
- `lib/db/sql/migrate-barcode.ts` - Migration
- `app/api/items/barcode/route.ts` - Barcode lookup API
- `components/pos/BarcodeScanner.tsx` - Scanner component
- `components/admin/ItemForm.tsx` - Add SKU/barcode fields

#### B2. Discounts & Promotions
Essential for retail shops.

**New schema:**
```sql
CREATE TABLE discounts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('percentage', 'fixed_amount', 'buy_x_get_y')),
  value REAL NOT NULL,
  applies_to TEXT CHECK (applies_to IN ('item', 'category', 'cart', 'all')),
  target_id TEXT, -- item_id or category_id if applicable
  min_quantity INTEGER,
  min_amount REAL,
  start_date INTEGER,
  end_date INTEGER,
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);
```

**Features to add:**
- Apply discount at item level
- Apply discount at cart level
- Percentage or fixed amount discounts
- Time-limited promotions
- "Buy 2 Get 1 Free" type offers

**Files to create:**
- `lib/db/sql/migrate-discounts.ts`
- `app/api/discounts/route.ts`
- `components/admin/DiscountForm.tsx`
- `components/admin/DiscountList.tsx`
- `components/pos/DiscountSelector.tsx`
- Update `lib/stores/cart-store.ts` - discount handling

#### B3. Returns & Refunds
Critical for non-grocery retail.

**New schema:**
```sql
CREATE TABLE returns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  original_sale_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  return_date INTEGER DEFAULT (unixepoch()),
  total_refund REAL NOT NULL,
  refund_method TEXT CHECK (refund_method IN ('cash', 'mpesa', 'store_credit')),
  reason TEXT,
  notes TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  approved_by TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (original_sale_id) REFERENCES sales(id),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL,
  sale_item_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity_returned REAL NOT NULL,
  refund_amount REAL NOT NULL,
  restock INTEGER DEFAULT 1, -- Whether to add back to inventory
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (return_id) REFERENCES returns(id)
);
```

**Features:**
- Process returns against original sale
- Partial returns (some items only)
- Refund to cash, M-Pesa, or store credit
- Optionally restock returned items
- Return approval workflow (for valuable items)

**Files to create:**
- `lib/db/sql/migrate-returns.ts`
- `app/api/returns/route.ts`
- `app/admin/returns/page.tsx`
- `components/admin/ReturnForm.tsx`
- `components/pos/ProcessReturn.tsx`

---

### Phase C: Enhanced Shop Features
**Effort: 7-10 days | Impact: Medium-High**

#### C1. Customer Management (CRM Lite)
Move beyond just credit accounts to real customer profiles.

**Enhanced schema:**
```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  customer_type TEXT CHECK (customer_type IN ('regular', 'wholesale', 'vip')),
  loyalty_points INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  total_visits INTEGER DEFAULT 0,
  notes TEXT,
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);
```

**Features:**
- Customer profiles with purchase history
- Link sales to customers (optional)
- Customer types (regular, wholesale, VIP) with different pricing
- Loyalty points system
- Customer search on POS

**Files to create:**
- `lib/db/sql/migrate-customers.ts`
- `app/api/customers/route.ts`
- `app/admin/customers/page.tsx` (already exists, enhance it)
- `components/admin/CustomerForm.tsx`
- `components/pos/CustomerSearch.tsx`
- Update sales flow to optionally link customer

#### C2. Wholesale/Tiered Pricing
Different prices for different customer types.

**Schema addition:**
```sql
CREATE TABLE price_tiers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  customer_type TEXT NOT NULL, -- 'wholesale', 'vip', etc.
  price REAL NOT NULL,
  min_quantity INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (item_id) REFERENCES items(id)
);
```

**Features:**
- Set different prices per customer type
- Bulk pricing (buy 10+ get lower price)
- Automatic price selection based on customer

#### C3. Expiry Date Tracking (Optional for Non-Grocery)
Some shops (pharmacy, cosmetics) need this.

**Schema addition:**
```sql
ALTER TABLE inventory_batches ADD COLUMN expiry_date INTEGER;
```

**Features:**
- Set expiry date when adding stock
- Expiry warnings in dashboard
- FEFO option (First Expiry First Out) instead of FIFO

#### C4. Product Images Upload
Replace hardcoded images with S3 uploads (you already have S3 integration for banners!).

**Changes needed:**
- Add image upload to item form
- Store `image_url` in items table (already exists!)
- Use uploaded images in POS grid

**Files to modify:**
- `components/admin/ItemForm.tsx` - Add image upload
- `app/api/items/upload/route.ts` - Handle image upload to S3

---

### Phase D: Advanced Features
**Effort: 10-15 days | Impact: Medium**

#### D1. Multiple Price Lists
For businesses with retail + wholesale operations.

#### D2. Purchase Orders
Create POs, track supplier deliveries, auto-receive into stock.

#### D3. Stock Transfers
For shops with multiple locations/warehouses.

#### D4. Tax Configuration
GST/VAT handling with tax-inclusive/exclusive pricing.

```sql
CREATE TABLE tax_rates (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL, -- "VAT 16%", "GST 18%"
  rate REAL NOT NULL, -- 0.16, 0.18
  is_inclusive INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1
);

ALTER TABLE items ADD COLUMN tax_rate_id TEXT;
```

#### D5. Commission Tracking
For shops with salespeople on commission.

#### D6. Services Support
For shops that also offer services (repair shops, salons).

```sql
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  price REAL NOT NULL,
  active INTEGER DEFAULT 1
);
```

---

## 📱 UI/UX Adaptations

### Mobile POS (Current: Excellent!)
Your mobile kiosk design is already shop-ready. Minor tweaks:

1. **Quick actions bar** - Add "Returns" and "Discount" buttons
2. **Customer selection** - Add customer search at checkout
3. **Barcode input** - Enable the existing "Scan Barcode" button

### Admin Dashboard
Add shop-relevant stats:
- Top customers
- Return rate
- Discount usage
- Low stock alerts by category

---

## 🚀 Recommended Implementation Order

### Immediate (Week 1-2)
1. ✅ Expand unit types in constants
2. ✅ Remove hardcoded grocery branding
3. ✅ Add SKU/barcode fields
4. ✅ Enable barcode scanner functionality

### Short-term (Week 3-4)
5. ✅ Implement basic discounts (percentage/fixed)
6. ✅ Add customer profiles
7. ✅ Enable product image uploads

### Medium-term (Week 5-8)
8. ✅ Returns & refunds system
9. ✅ Wholesale/tiered pricing
10. ✅ Customer loyalty points

### Long-term (Week 9+)
11. Tax configuration
12. Advanced discounts (BOGO, bundles)
13. Purchase orders
14. Services support

---

## 💡 Shop Type Presets

Consider adding "quick setup" presets for common shop types:

```typescript
const SHOP_PRESETS = {
  grocery: {
    defaultUnits: ['kg', 'g', 'piece', 'bunch'],
    defaultCategories: ['Fruits', 'Vegetables', 'Dairy', 'Beverages'],
    features: { expiry: true, wholesale: false }
  },
  electronics: {
    defaultUnits: ['piece', 'set', 'box'],
    defaultCategories: ['Phones', 'Accessories', 'Computers', 'Audio'],
    features: { expiry: false, warranty: true, returns: true }
  },
  clothing: {
    defaultUnits: ['piece', 'pair', 'set'],
    defaultCategories: ['Men', 'Women', 'Kids', 'Accessories'],
    features: { variants: true, sizes: true, returns: true }
  },
  pharmacy: {
    defaultUnits: ['piece', 'box', 'bottle', 'pack'],
    defaultCategories: ['Prescription', 'OTC', 'Personal Care', 'Medical Equipment'],
    features: { expiry: true, batchTracking: true, controlled: true }
  },
  hardware: {
    defaultUnits: ['piece', 'meter', 'kg', 'box', 'roll'],
    defaultCategories: ['Tools', 'Plumbing', 'Electrical', 'Building Materials'],
    features: { wholesale: true, bulkPricing: true }
  }
};
```

---

## 📊 Effort Summary

| Phase | Effort | Priority | Impact |
|-------|--------|----------|--------|
| **A: Quick Wins** | 1-2 days | 🔴 Critical | High |
| **B: Essential Features** | 5-7 days | 🔴 Critical | High |
| **C: Enhanced Features** | 7-10 days | 🟡 Important | Medium-High |
| **D: Advanced Features** | 10-15 days | 🟢 Nice-to-have | Medium |

**Total estimated effort: 23-34 days** for a fully flexible shop system.

---

## ✅ What's Already Shop-Ready (No Changes Needed)

- Multi-tenant architecture
- User/role management
- Purchase recording & breakdown
- FIFO inventory tracking
- Cash/M-Pesa/Credit payments
- Credit accounts
- Shift management
- Profit tracking
- Sales reports
- Product variants

Your foundation is solid! The grocery-specific elements are mostly in the UI text and category presets, which are easy to make configurable.

---

## 🎯 Quick Start Recommendation

**If you want to start TODAY**, here's the minimal change:

1. Update `UNIT_TYPES` in `lib/constants.ts`
2. Change "Grocery POS" → "Kiosk POS" in `app/pos/page.tsx` (already done!)
3. Remove hardcoded `CATEGORY_IMAGE_MAP` and use uploaded/default images
4. Add SKU/barcode fields to items

This gives you a working general retail POS in ~2 hours of work!
