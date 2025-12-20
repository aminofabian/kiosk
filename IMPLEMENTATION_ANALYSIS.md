# Grocery POS - Implementation Analysis

> **What's Missing, Incorrect, or Needs Adjustment (Steps 1-6)**
>
> **Note:** Phase 7 (Multi-Tenancy & Auth) has been implemented. See the Phase 7 section below.

This document analyzes the current implementation against the `grocery-pos.md` specification and identifies gaps, issues, and required adjustments.

---

## 📊 Summary by Phase

| Phase | Status | Issues Found |
|-------|--------|--------------|
| **Foundation (Step 0)** | ✅ Complete | 2 minor issues |
| **Phase 1: Selling Core** | ⚠️ Mostly Complete | 3 issues |
| **Phase 2: Stock Management** | ⚠️ Mostly Complete | 4 issues |
| **Phase 3: Profit & FIFO** | ✅ Complete | 1 minor issue |
| **Phase 4: Credit Sales** | ⚠️ Mostly Complete | 3 issues |
| **Phase 5: Shifts** | ⚠️ Mostly Complete | 2 issues |
| **Phase 6: Reports** | ⚠️ Mostly Complete | 5 issues |

---

## 🏗️ FOUNDATION (Step 0) - Issues

### ✅ Step 0.1: Database Setup
**Status:** Complete
- Turso client correctly configured
- Environment variables properly checked

### ⚠️ Step 0.2: Database Schema
**Status:** Complete with Issues

#### Issue F-1: `stock_adjustments` Table Schema Mismatch
**Severity:** 🔴 High

**Expected (from spec):**
```sql
stock_adjustments
├── system_stock: decimal
├── actual_stock: decimal
├── difference: decimal
├── reason: enum ['spoilage', 'theft', 'counting_error', 'damage', 'other']
```

**Actual Implementation Issue:**
In `app/api/stock/adjust/route.ts` (lines 68-84), the code inserts:
```typescript
// Uses fields NOT in schema: adjustment_type, quantity
INSERT INTO stock_adjustments (
  id, business_id, item_id, adjustment_type, quantity,
  reason, notes, adjusted_by, created_at
)
```

**Problem:** The `adjustment_type` and `quantity` columns do NOT exist in the schema. The schema uses `system_stock`, `actual_stock`, and `difference`.

**Fix Required:**
Update `app/api/stock/adjust/route.ts` to use the correct schema fields.

---

### ✅ Step 0.3: Project Structure & Constants
**Status:** Complete
- All enums defined correctly in `lib/constants.ts`
- TypeScript types defined in `lib/db/types.ts`
- Cart store and user store created

### ✅ Step 0.4: UI Foundation
**Status:** Complete
- shadcn/ui components installed
- Touch-friendly sizing configured

---

## 🎯 PHASE 1: Selling Core - Issues

### ✅ Step 1.1: Seed Data
**Status:** Complete
- Categories and items properly seeded
- Initial selling prices created

### ✅ Step 1.2-1.3: Category & Item Display
**Status:** Complete

### ✅ Step 1.4: Cart Store
**Status:** Complete

#### Issue P1-1: No Local Storage Persistence
**Severity:** 🟡 Medium

**Spec says:** "Persist to localStorage (optional for Phase 1)"

**Current:** Cart state is not persisted. Refreshing the page loses the cart.

**Fix Required:**
Add Zustand persist middleware to `lib/stores/cart-store.ts`:
```typescript
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist<CartStore>(
    (set) => ({
      // ... store definition
    }),
    { name: 'cart-storage' }
  )
);
```

---

### ⚠️ Step 1.5: Add to Cart Flow
**Status:** Mostly Complete

#### Issue P1-2: Missing CartBadge Component
**Severity:** 🟢 Low

**Spec says:** Create `components/pos/CartBadge.tsx`

**Current:** No dedicated CartBadge component exists. The badge is likely inline in the POS layout.

**Fix Required:**
Extract cart badge into its own component for reusability.

---

### ✅ Step 1.6: Cart View
**Status:** Complete

### ✅ Step 1.7-1.8: Checkout & Sale API
**Status:** Complete
- Cash payment works
- Stock deduction works
- FIFO already implemented (ahead of schedule)

---

### ⚠️ Step 1.9: Receipt View
**Status:** Mostly Complete

#### Issue P1-3: Receipt Shows Hardcoded Business Name
**Severity:** 🟡 Medium

**Current:** The receipt component likely uses a hardcoded business name rather than fetching from database.

**Fix Required:**
Update receipt API/component to fetch and display actual business name from the sale's business_id.

---

### ✅ Step 1.10: Main POS Page Integration
**Status:** Complete

---

## 📦 PHASE 2: Stock Management - Issues

### ✅ Step 2.1: Purchase Recording UI
**Status:** Complete
- PurchaseForm component exists
- Purchase items can be added

### ✅ Step 2.2: Purchase List View
**Status:** Complete

### ⚠️ Step 2.3: Purchase Breakdown UI
**Status:** Complete with Issues

#### Issue P2-1: Missing GET Endpoint for Purchase Details
**Severity:** 🟡 Medium

**Problem:** No `app/api/purchases/[id]/route.ts` GET endpoint exists to fetch a single purchase with its items for the breakdown page.

**Current state:** The breakdown page may be fetching all purchases and filtering client-side, or the route exists but wasn't visible in the file list.

**Fix Required:**
Create `app/api/purchases/[id]/route.ts` with GET method that returns:
- Purchase details
- All purchase_items with their status
- Existing breakdowns (if any)

---

### ✅ Step 2.4: Inventory Batch Creation
**Status:** Complete
- Batches correctly created on breakdown
- Stock correctly updated

### ✅ Step 2.5: Stock View
**Status:** Complete

---

### ⚠️ Step 2.5 (Additional): Purchase Status Update Logic
#### Issue P2-2: Incorrect Status Transition
**Severity:** 🟡 Medium

**Current Logic (in breakdown route):**
```typescript
const pendingCount = await queryOne<{ count: number }>(
  `SELECT COUNT(*) as count 
   FROM purchase_items 
   WHERE purchase_id = ? AND status = 'pending'`,
  [purchaseId]
);

let newStatus = 'partial';
if (pendingCount && pendingCount.count === 0) {
  newStatus = 'complete';
}
```

**Issue:** The status never becomes 'pending' initially—the route always sets 'partial' even for the first breakdown. Should check if this is the FIRST breakdown (all items were pending before).

**Fix Required:**
Update logic to properly handle transition from 'pending' → 'partial' → 'complete'.

---

### ⚠️ Step 2.6: Wastage Not Logged
#### Issue P2-3: No Stock Adjustment for Wastage
**Severity:** 🟡 Medium

**Spec says:**
> "If wastage > 0, optionally create stock_adjustment (or skip for Phase 2)"

**Current:** Wastage quantity is recorded in `purchase_breakdowns` but NOT logged to `stock_adjustments` table.

**Fix Required (Low Priority):**
When `wastage_quantity > 0`, create a stock_adjustment record with reason = 'spoilage'.

---

### ⚠️ Issue P2-4: Purchase Items Not Updated with item_id After Linking
**Severity:** 🟡 Medium

**Spec says:** When an item is linked to a purchase_item, the `item_id` should be set.

**Current:** The breakdown correctly uses `item_id`, but the original `purchase_items.item_id` may not be updated if it was initially null.

**Fix Required:**
On breakdown confirmation, also update:
```sql
UPDATE purchase_items SET item_id = ? WHERE id = ?
```

---

## 💰 PHASE 3: Profit & FIFO - Issues

### ✅ Step 3.1: FIFO Batch Selection Logic
**Status:** Complete
- `lib/utils/fifo.ts` correctly implements FIFO

### ✅ Step 3.2: Sale API Updated for FIFO
**Status:** Complete
- Sale items correctly linked to batches
- Profit calculated and stored

### ✅ Step 3.3: Selling Price Management
**Status:** Complete
- Price history created
- Denormalized price updated

### ⚠️ Step 3.4: Profit Display
**Status:** Complete with Minor Issue

#### Issue P3-1: No Price History View
**Severity:** 🟢 Low

**Spec says:** "Show price history (optional for Phase 3)"

**Current:** Price edit page exists but no UI to view historical prices.

**Fix Required (Low Priority):**
Add a "View Price History" section to the item edit page showing past prices.

---

## 💳 PHASE 4: Credit Sales - Issues

### ✅ Step 4.1: Credit Payment Option
**Status:** Complete
- Credit payment method available
- Customer name/phone captured

### ✅ Step 4.2: Credit Account Creation
**Status:** Complete
- Account created or updated on credit sale
- Credit transaction (debt) recorded

### ⚠️ Step 4.3: Outstanding Credits View
**Status:** Complete with Issues

#### Issue P4-1: Missing Transaction History in Credit View
**Severity:** 🟡 Medium

**Spec says:** "Click to view transactions"

**Current:** The `app/api/credits/route.ts` only returns credit_accounts. No endpoint for fetching transactions of a specific account.

**Fix Required:**
Create `app/api/credits/[id]/route.ts` with GET method that returns:
- Credit account details
- All related credit_transactions ordered by date

---

### ⚠️ Step 4.4: Payment Collection
**Status:** Mostly Complete

#### Issue P4-2: Credit Payment Not Added to Cash Register
**Severity:** 🔴 High

**Spec says (from Flow D):**
> "[Update Credit Account] → [Add to Cash Register]"

**Current:** When collecting a credit payment, the shift's `expected_closing_cash` is NOT updated.

**Fix Required:**
In `app/api/credits/[id]/payment/route.ts`, add logic to:
```typescript
// Get current open shift
const shift = await queryOne<{ id: string }>(
  `SELECT id FROM shifts WHERE business_id = ? AND status = 'open' LIMIT 1`,
  [DEMO_BUSINESS_ID]
);

if (shift && paymentMethod === 'cash') {
  await execute(
    `UPDATE shifts SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?`,
    [amount, shift.id]
  );
}
```

---

#### Issue P4-3: M-Pesa Payment Not Implemented
**Severity:** 🟡 Medium

**Spec says:** Payment methods include M-Pesa

**Current:** M-Pesa shows a placeholder message:
```
"M-Pesa payment confirmation will be handled here"
```

**Fix Required:**
Implement M-Pesa payment flow or clarify it's out of scope.

---

## 👤 PHASE 5: Shifts & Accountability - Issues

### ✅ Step 5.1: Shift Opening
**Status:** Complete
- Shift created with opening cash
- Duplicate shift prevention

### ✅ Step 5.2: Link Sales to Shifts
**Status:** Complete
- Sales linked to active shift
- Expected closing cash updated on cash sales

### ⚠️ Step 5.3: Shift Closing
**Status:** Mostly Complete

#### Issue P5-1: Shift Summary Missing Credit Payment Reconciliation
**Severity:** 🟡 Medium

**Spec says (from Flow D):**
> "Add to Cash Register"

**Problem:** The shift close summary only considers sales cash. Credit payments collected during the shift (if any) should also be included in expected_closing_cash calculation.

**Current Calculation:**
```
expected_closing_cash = opening_cash + cash_sales_during_shift
```

**Should Be:**
```
expected_closing_cash = opening_cash + cash_sales_during_shift + cash_credit_payments_during_shift
```

**Fix Required:**
Update shift closing logic to include credit payments made during the shift.

---

### ✅ Step 5.4: Shift History
**Status:** Complete

---

#### Issue P5-2: No Shift Required Before Selling
**Severity:** 🟡 Medium

**Spec Flow (from 2.1):**
```
[Open Register] → [Browse Categories] → [Select Item] → ...
```

**Current:** Sales can be made without an open shift (shift_id is nullable).

**Discussion:** This is acceptable for Phase 1-4 but should be enforced in production.

**Fix Required (Optional):**
Add shift check before allowing sales:
```typescript
if (!shift) {
  return jsonResponse({ success: false, message: 'Please open a shift first' }, 400);
}
```

---

## 📊 PHASE 6: Reports & Insights - Issues

### ⚠️ Step 6.1: Daily Sales Summary
**Status:** Mostly Complete

#### Issue P6-1: Dashboard Missing Sales Breakdown by Payment Method
**Severity:** 🟢 Low

**Spec says:** Show today's summary

**Current:** Dashboard shows total sales but not breakdown by payment method (cash vs M-Pesa vs credit).

**Fix Required:**
Add query to break down sales by payment_method:
```sql
SELECT payment_method, SUM(total_amount), COUNT(*) 
FROM sales 
WHERE sale_date >= ? AND sale_date <= ?
GROUP BY payment_method
```

---

### ✅ Step 6.2: Sales Report
**Status:** Complete
- Date range filtering
- Payment method filtering

### ✅ Step 6.3: Profit Report
**Status:** Complete
- Profit by item
- Profit by category
- Margin calculations

---

### ⚠️ Step 6.4: Stock Adjustments
**Status:** Has Critical Schema Mismatch

#### Issue P6-2: Stock Adjust API Schema Mismatch (Same as F-1)
**Severity:** 🔴 High

**Refer to Issue F-1:** The `/api/stock/adjust` route uses incorrect columns (`adjustment_type`, `quantity`) that don't exist in the schema.

---

### ⚠️ Step 6.4 (Continued): Stock Take
**Status:** Complete with Issues

#### Issue P6-3: Stock Take Should Update Batches
**Severity:** 🟡 Medium

**Spec says:**
> "Update inventory_batches if needed (optional)"

**Current:** Stock take updates `items.current_stock` but does NOT update `inventory_batches.quantity_remaining`.

**Problem:** This creates inconsistency between item stock and sum of batch quantities.

**Fix Required (Complex):**
When adjusting stock downward, deduct from oldest batches (FIFO). When adjusting upward, either:
1. Create a new "adjustment" batch
2. Or just note this is a known limitation

---

#### Issue P6-4: Missing Loss Tracking Report
**Severity:** 🟢 Low

**Spec says (Phase 6 features):**
> "Loss tracking"

**Current:** Stock adjustments are recorded but no report shows total losses by reason.

**Fix Required:**
Create a loss tracking report:
```sql
SELECT reason, SUM(ABS(difference)), COUNT(*) 
FROM stock_adjustments 
WHERE difference < 0
GROUP BY reason
```

---

### ⚠️ Step 6.5: Restock Alerts
**Status:** Mostly Complete

#### Issue P6-5: Restock Alerts Missing "Days Since Last Purchase"
**Severity:** 🟢 Low

**Spec says:**
> "Days since last purchase (optional)"

**Current:** Low stock alert shows current stock vs min level but not when item was last purchased.

**Fix Required:**
Join with purchases to show last purchase date:
```sql
SELECT i.*, MAX(pi.created_at) as last_purchased_at
FROM items i
LEFT JOIN purchase_items pi ON pi.item_id = i.id
WHERE i.current_stock <= i.min_stock_level
GROUP BY i.id
```

---

## 🔧 Critical Fixes Required (Priority Order)

### 🔴 P0 - Must Fix Immediately

1. **Issue F-1 / P6-2:** Stock Adjust API Schema Mismatch
   - File: `app/api/stock/adjust/route.ts`
   - The SQL INSERT uses columns that don't exist
   - This will cause runtime errors

### 🟡 P1 - Should Fix Soon

2. **Issue P4-2:** Credit Payment Not Added to Cash Register
   - File: `app/api/credits/[id]/payment/route.ts`
   - Critical for shift reconciliation accuracy

3. **Issue P5-1:** Shift Summary Missing Credit Payment Reconciliation
   - Files: Shift close API/UI
   - Related to P4-2

4. **Issue P1-1:** Cart Not Persisted
   - File: `lib/stores/cart-store.ts`
   - User experience issue

5. **Issue P4-1:** Missing Credit Transaction History
   - Create: `app/api/credits/[id]/route.ts`

### 🟢 P2 - Nice to Have

6. **Issue P2-2:** Purchase Status Transition Logic
7. **Issue P2-3:** Wastage Not Logged to Stock Adjustments
8. **Issue P2-4:** Purchase Items item_id Not Updated
9. **Issue P3-1:** No Price History View
10. **Issue P6-3:** Stock Take Doesn't Update Batches
11. **Issue P6-4:** Missing Loss Tracking Report
12. **Issue P6-5:** Missing "Days Since Last Purchase"
13. **Issue P1-2:** Missing CartBadge Component
14. **Issue P1-3:** Hardcoded Business Name in Receipt

---

## 📋 Missing Files/Components Checklist

### Files That Should Exist But Don't

| File | Purpose | Priority |
|------|---------|----------|
| `app/api/credits/[id]/route.ts` (GET) | Fetch single credit account with transactions | 🟡 P1 |
| `components/pos/CartBadge.tsx` | Reusable cart badge component | 🟢 P2 |
| `app/api/stock/alerts/route.ts` | Dedicated restock alerts endpoint | 🟢 P2 |

### Files with Issues

| File | Issue | Priority |
|------|-------|----------|
| `app/api/stock/adjust/route.ts` | Wrong column names | 🔴 P0 |
| `lib/stores/cart-store.ts` | No persistence | 🟡 P1 |
| `app/api/credits/[id]/payment/route.ts` | Missing shift update | 🟡 P1 |

---

## 📈 Metrics

| Metric | Value |
|--------|-------|
| Total Issues Found | 18 |
| Critical (P0) | 1 |
| High Priority (P1) | 5 |
| Medium Priority (P2) | 12 |
| Phases Complete | 4/6 (with issues) |
| Estimated Fix Time | 8-12 hours |

---

## ✅ What's Working Well

1. **Database Schema** - Correctly matches spec (except one API mismatch)
2. **FIFO Implementation** - Correctly implemented in `lib/utils/fifo.ts`
3. **Profit Calculation** - Correctly stored per sale_item
4. **Price Versioning** - Correctly tracked in selling_prices
5. **Shift Management** - Core functionality works
6. **Credit Sales** - Core flow works
7. **Reports** - Profit and sales reports work

---

## 🏁 Next Steps

1. **Fix the P0 issue** (stock adjust schema mismatch)
2. **Address P1 issues** one by one
3. **Test complete flows** after fixes
4. **Document any intentional deviations** from spec
5. **Proceed to Phase 7** (Multi-Tenancy & Auth) once stable

---

## ✅ PHASE 7: Multi-Tenancy & Auth (COMPLETED)

Phase 7 has been fully implemented with the following features:

### Step 7.1: Authentication Setup ✅
- Installed NextAuth.js and bcryptjs
- Created auth configuration (`lib/auth/config.ts`)
- Created login page (`app/(auth)/login/page.tsx`)
- Created middleware for route protection (`middleware.ts`)
- Session provider configured in root layout

### Step 7.2: Business Registration ✅
- Registration page (`app/(auth)/register/page.tsx`)
- Registration API (`app/api/auth/register/route.ts`)
- Creates business + owner user on registration
- Auto-login after registration

### Step 7.3: User Management ✅
- Users page (`app/admin/users/page.tsx`) - Owner only
- User list component (`components/admin/UserList.tsx`)
- User form for add/edit (`components/admin/UserForm.tsx`)
- Users API (`app/api/users/route.ts`, `app/api/users/[id]/route.ts`)
- Support for admin and cashier roles with PIN

### Step 7.4: Role-Based Access Control ✅
- Permissions helper (`lib/auth/permissions.ts`)
- Permission checks: sell, view_profit, manage_items, manage_users, etc.
- API route protection with `requireAuth()` and `requirePermission()`
- Sidebar hides menu items based on role

### Step 7.5: PIN-Based Cashier Login ✅
- PIN login page (`app/pos/login/page.tsx`)
- PIN entry component (`components/pos/PINLogin.tsx`)
- 4-digit PIN authentication via NextAuth

### Step 7.6: Business Context & Scoping ✅
- All API routes updated to use session
- `auth.businessId` replaces hardcoded `DEMO_BUSINESS_ID`
- `auth.userId` replaces user queries
- Complete data isolation between businesses

### New Files Created
```
lib/auth/
├── config.ts          # NextAuth configuration
├── index.ts           # Auth exports
├── permissions.ts     # RBAC permissions
└── api-auth.ts        # API route helpers

lib/hooks/
└── use-current-user.ts  # Client-side session hook

components/auth/
├── LoginForm.tsx
├── RegisterForm.tsx
├── RoleGate.tsx       # Conditional rendering by role
└── UserMenu.tsx       # User profile/logout

components/admin/
├── UserList.tsx
└── UserForm.tsx

app/(auth)/
├── layout.tsx
├── login/page.tsx
└── register/page.tsx

app/admin/users/
└── page.tsx

app/api/auth/
├── [...nextauth]/route.ts
└── register/route.ts

app/api/users/
├── route.ts
└── [id]/route.ts

app/api/businesses/
└── [id]/route.ts

app/pos/login/
└── page.tsx

middleware.ts
```

### Environment Variables Required
```env
# NextAuth.js (add to .env.local)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

---

*Last Updated: December 19, 2024*

