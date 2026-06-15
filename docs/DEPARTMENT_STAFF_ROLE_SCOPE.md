# Department Staff Role — Implementation Scope

> **Status**: Draft · **Target**: New user role bridging stock management and cashier workflow

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Current State of the Codebase](#2-current-state-of-the-codebase)
- [3. Core Responsibilities](#3-core-responsibilities)
- [4. Restrictions](#4-restrictions)
- [5. Database Changes](#5-database-changes)
- [6. Code Changes by Layer](#6-code-changes-by-layer)
  - [6.1 Constants & Types](#61-constants--types)
  - [6.2 Permissions System](#62-permissions-system)
  - [6.3 Session / JWT Types](#63-session--jwt-types)
  - [6.4 Middleware](#64-middleware)
  - [6.5 User Management](#65-user-management)
  - [6.6 API Route Authorization](#66-api-route-authorization)
  - [6.7 Department Workspace](#67-department-workspace)
  - [6.8 Cashier Integration](#68-cashier-integration)
  - [6.9 Stock Operations UI](#69-stock-operations-ui)
  - [6.10 Audit Trail](#610-audit-trail)
  - [6.11 Reporting](#611-reporting)
- [7. Implementation Phasing](#7-implementation-phasing)
- [8. Files Summary](#8-files-summary)
- [9. Key Design Decisions](#9-key-design-decisions)

---

## 1. Overview

Introduce a new `department_staff` user role intended for staff members working within specific store departments (e.g., Produce, Bakery, Electronics, Cosmetics, Stationery). This role acts as a bridge between stock management and the cashier workflow.

### Core Responsibilities

- Create item requests/orders for customers within their department.
- Forward selected items to a cashier for checkout and payment processing.
- Generate draft invoices or sales requests that can later be completed by a cashier.
- View the status of requests they have created (Pending, In Cart, Paid, Cancelled).
- Perform inventory-reducing actions (permission-controlled): stock adjustments, damage recording, theft/loss recording, expired product write-offs, internal consumption, returns to suppliers.

### Restrictions

Department Staff CANNOT:

- Process customer payments.
- Open or close cashier shifts.
- Perform cash drawer operations.
- Access financial reports unless explicitly permitted.
- Void completed sales without approval.
- Manage other users or system settings.

---

## 2. Current State of the Codebase

| Area | Status / Details |
|---|---|
| **Roles** | `owner`, `admin`, `cashier`, `superadmin` — defined in `lib/constants.ts` |
| **Permissions** | Role→permission map in `lib/auth/permissions.ts` with granular `canXxx()` helpers |
| **DB Constraint** | `users.role CHECK (role IN ('owner', 'admin', 'cashier'))` in `lib/db/sql/schema.sql` |
| **TypeScript Types** | `UserRole` constrains the role string; sessions and JWT are typed accordingly |
| **Auth Config** | `lib/auth/config.ts` — NextAuth providers, session typing, JWT callbacks |
| **API Auth** | `lib/auth/api-auth.ts` — `requireAuth()`, `requirePermission()`, `requireRole()` |
| **Middleware** | `middleware.ts` — role-based route redirections and access control |
| **User Management** | `UserForm` allows admin/cashier; `UserList` shows all roles; `api/users` validates allowed roles |
| **Pending Sales** | Sales with `status = 'pending'` exist; `POST /api/sales/pending` creates/updates; cashiers can save carts |
| **Stock Adjustments** | `POST /api/stock/adjust` with reasons (spoilage, theft, damage etc.); cashiers get approval flow; admins get direct adjust |
| **Activity Log** | `activity_log` table with action, entity_type, performed_by, details (JSON), timestamps |
| **Admin Pages** | Pending carts, activity logs, stock adjust, stock take, reports, users, shifts, etc. |
| **POS** | Full POS page with cart, checkout, shift management, receipt printing |

---

## 3. Core Responsibilities

### 3.1 Order Preparation & Forwarding

Department Staff should be able to:

- Browse/search items within their department (or all items if dept-scoping not enabled).
- Build a customer order in a cart-like interface.
- Save the order as a **pending sale** (reuses existing mechanism).
- **Forward** the order to a cashier, which:
  - Creates a `department_request` record (or flags the pending sale as originated by department staff).
  - Marks the request status as `pending`.
  - Notifies cashiers of the pending order.

### 3.2 Cashier Interaction

Cashiers should be able to:

- See forwarded orders in the pending-carts list, with the originating staff member's name.
- **Load** the forwarded items into their POS cart.
- **Modify** the cart before checkout (add products, adjust quantities, apply discounts — subject to their own permissions).
- **Complete payment** as normal.
- View which Department Staff member initiated the sale.

### 3.3 Stock Operations (Permission-Controlled)

Depending on assigned permissions, Department Staff may:

- **Adjust stock** (increase/decrease with reason).
- **Record damage/spoilage**.
- **Record theft/loss**.
- **Write off expired products**.
- **Record internal consumption**.
- **Return items to suppliers**.

All actions require:

- Proper audit logging.
- Captured reason for the adjustment.
- Recorded responsible staff member.
- Real-time inventory update.
- Permission control (admins decide which operations are allowed per staff member).

### 3.4 Request Status Tracking

| Status | Meaning |
|---|---|
| 🟡 **Pending** | Order created, awaiting cashier action |
| 🔵 **In Cart** | Cashier has loaded the items into their cart |
| 🟢 **Paid** | Sale completed by cashier |
| 🔴 **Cancelled** | Order discarded/voided |
| ⚪ **Expired** | Not acted upon within a configurable timeframe |

---

## 4. Restrictions

Department Staff CANNOT:

| Restriction | Enforced By |
|---|---|
| Process customer payments | API permission check on `POST /api/sales` |
| Open/close cashier shifts | Middleware blocks `/pos/shift`; API guards on shift endpoints |
| Cash drawer operations | No shift management access |
| Access financial reports | Middleware blocks `/admin/reports`, `/admin/profit` |
| Void completed sales | Permission `void_own_sale` not assigned |
| Manage users | Permission `manage_users` not assigned |
| Access business settings | Permission `business_settings` not assigned |

---

## 5. Database Changes

### 5.1 Update Role Constraint

**File**: `lib/db/sql/schema.sql`

Add `'department_staff'` to the `users.role` CHECK constraint:

```sql
role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'cashier', 'department_staff'))
```

### 5.2 Migration Script

**New file**: `lib/db/migrate-department-staff-role.ts`

A migration that:

1. Disables foreign keys (`PRAGMA foreign_keys = OFF`).
2. Recreates the `users` table with the updated CHECK constraint.
3. Copies existing data.
4. Drops the old table.
5. Renames the new table.
6. Recreates indexes.
7. Re-enables foreign keys.

### 5.3 Optional: Add `department_id` to Users

Can be deferred to a later phase:

```sql
ALTER TABLE users ADD COLUMN department_id TEXT REFERENCES departments(id);
```

### 5.4 Optional: `department_requests` Table

If dedicated tracking is preferred over reusing the pending-sales mechanism:

```sql
CREATE TABLE IF NOT EXISTS department_requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  created_by TEXT NOT NULL,        -- department staff user
  resolved_by TEXT,                -- cashier who completed checkout
  sale_id TEXT,                    -- the completed sale (nullable until paid)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_cart', 'completed', 'cancelled')),
  customer_name TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS department_request_items (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity_sold REAL NOT NULL,
  sell_price_per_unit REAL NOT NULL,
  batch_number TEXT,               -- snapshot for traceability
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (request_id) REFERENCES department_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT
);
```

**Recommendation**: Start with the simpler approach — reuse `sales.status = 'pending'` and add a single column `originated_by_user_id` to the `sales` table. This avoids a new table and leverages the entire existing pending-sales flow. Add dedicated tables only if the tracking requirements outgrow the simple approach.

---

## 6. Code Changes by Layer

### 6.1 Constants & Types

**File**: `lib/constants.ts`

```ts
export const USER_ROLES = ['owner', 'admin', 'cashier', 'department_staff', 'superadmin'] as const;
export type UserRole = (typeof USER_ROLES)[number];
```

### 6.2 Permissions System

**File**: `lib/auth/permissions.ts`

Add new granular permissions:

```ts
export type Permission =
  | 'sell'
  | 'view_own_sales'
  | 'void_own_sale'
  | 'record_purchase'
  | 'breakdown_purchase'
  | 'adjust_stock'
  | 'view_all_sales'
  | 'view_profit'
  | 'manage_items'
  | 'manage_users'
  | 'business_settings'
  | 'can_override_price'
  | 'can_give_discount'
  | 'process_refund'
  | 'edit_completed_sale'
  | 'record_supplier_bill'
  | 'approve_supplier_bill'
  // ── New ──
  | 'record_damage'
  | 'record_theft_loss'
  | 'record_expired_writeoff'
  | 'record_internal_consumption'
  | 'record_supplier_return'
  | 'forward_to_cashier'
  | 'create_draft_invoice';
```

Add the role to the permission map:

```ts
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  superadmin: [...OWNER_ADMIN_PERMISSIONS, 'manage_users', 'business_settings'],
  owner:      [...OWNER_ADMIN_PERMISSIONS, 'manage_users', 'business_settings'],
  admin:      OWNER_ADMIN_PERMISSIONS,
  cashier:    ['sell', 'view_own_sales', 'void_own_sale', 'adjust_stock', 'manage_items', 'process_refund'],
  department_staff: [
    'sell',
    'view_own_sales',
    'adjust_stock',
    'record_damage',
    'record_theft_loss',
    'record_expired_writeoff',
    'record_internal_consumption',
    'record_supplier_return',
    'forward_to_cashier',
    'create_draft_invoice',
  ],
};
```

Add helper functions for new permissions:

```ts
export function canRecordDamage(role: UserRole): boolean { return hasPermission(role, 'record_damage'); }
export function canRecordTheftLoss(role: UserRole): boolean { return hasPermission(role, 'record_theft_loss'); }
export function canRecordExpiredWriteoff(role: UserRole): boolean { return hasPermission(role, 'record_expired_writeoff'); }
export function canRecordInternalConsumption(role: UserRole): boolean { return hasPermission(role, 'record_internal_consumption'); }
export function canRecordSupplierReturn(role: UserRole): boolean { return hasPermission(role, 'record_supplier_return'); }
export function canForwardToCashier(role: UserRole): boolean { return hasPermission(role, 'forward_to_cashier'); }
export function canCreateDraftInvoice(role: UserRole): boolean { return hasPermission(role, 'create_draft_invoice'); }
```

### 6.3 Session / JWT Types

**File**: `lib/auth/config.ts`

Add `'department_staff'` to all three type declarations:

```ts
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'owner' | 'admin' | 'cashier' | 'department_staff' | 'superadmin';
      businessId: string | null;
      businessName: string | null;
      isSuperAdmin: boolean;
    };
  }
  // ... same change for User and JWT
}
```

Update `requireRole` in `lib/auth/index.ts`:

```ts
export async function requireRole(allowedRoles: ('owner' | 'admin' | 'cashier' | 'department_staff' | 'superadmin')[]) {
```

### 6.4 Middleware

**File**: `middleware.ts`

Add `department_staff` routing rules alongside existing cashier rules:

```ts
// Department staff routing
if (role === 'department_staff') {
  // Redirect from admin root to department workspace
  if (pathname === '/admin') {
    return NextResponse.redirect(new URL('/department', req.url));
  }
  
  // Block restricted admin routes
  const restrictedRoutes = [
    '/admin/users',
    '/admin/banners',
    '/admin/profit',
    '/admin/reports',
    '/admin/purchases',
    '/admin/shifts',
    '/admin/balance',
    '/admin/supplier-bills',
  ];
  
  if (restrictedRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/department', req.url));
  }
  
  // Allow stock adjust but not stock take
  if (pathname.startsWith('/admin/stock/')) {
    if (pathname !== '/admin/stock/adjust') {
      return NextResponse.redirect(new URL('/department', req.url));
    }
  }
  
  // Block POS (no payment processing)
  if (pathname.startsWith('/pos')) {
    return NextResponse.redirect(new URL('/department', req.url));
  }
}
```

### 6.5 User Management

**File**: `app/api/users/route.ts`

Add `'department_staff'` to the allowed roles array:

```ts
if (!['admin', 'cashier', 'department_staff'].includes(role)) {
  return jsonResponse(
    { success: false, message: 'Invalid role. Must be admin, cashier, or department_staff' },
    400,
  );
}
```

**File**: `components/admin/UserForm.tsx`

Add `department_staff` to the role select dropdown:

```tsx
<SelectItem value="admin">Admin</SelectItem>
<SelectItem value="cashier">Cashier</SelectItem>
<SelectItem value="department_staff">Department Staff</SelectItem>
```

```tsx
<p className="text-xs text-muted-foreground">
  Admins can manage stock, purchases, and reports. Cashiers can only sell.
  Department staff can prepare orders and manage inventory but cannot process payments.
</p>
```

**File**: `components/admin/UserList.tsx`

Add a badge variant for `department_staff`:

```tsx
case 'department_staff':
  return 'secondary'; // or a distinct style
```

### 6.6 API Route Authorization

| API Route | Gate | Department Staff Access |
|---|---|---|
| `POST /api/sales/pending` | `requireAuth()` | ✅ Allowed — save carts as pending |
| `GET /api/sales/pending` | `requireAuth()` | ✅ Allowed — scoped to own sales |
| `PUT /api/sales/pending/:id/discard` | `requireAuth()` | ✅ Allowed — discard own pending carts |
| `POST /api/sales` (checkout) | `requirePermission('sell')` | ❌ Denied — cashier/admin/owner only |
| `POST /api/stock/adjust` | `requirePermission('adjust_stock')` | ✅ Allowed (direct adjust like admin) |
| `POST /api/shifts/open` | various | ❌ Denied |
| `POST /api/shifts/close` | various | ❌ Denied |
| `GET /api/reports/*` | various | ❌ Denied |
| `GET /api/activity-log` | `requireAuth()` | ✅ Allowed — read-only |
| `GET /api/items` | `requireAuth()` | ✅ Allowed |
| `GET /api/categories` | `requireAuth()` | ✅ Allowed |

### 6.7 Department Workspace

**New route**: `app/department/`

```
app/department/
├── layout.tsx          # Navigation sidebar/header, role guard
├── page.tsx            # Dashboard + order builder (main workspace)
├── requests/
│   └── page.tsx        # "My Requests" list with statuses
└── stock/
    └── page.tsx        # Stock operations hub
```

#### `app/department/layout.tsx`

- Role guard: redirect non-department-staff users.
- Layout with:
  - **Header**: Business name, user name, logout.
  - **Navigation tabs**: Orders, Stock, My Requests.
  - **Mobile-responsive** bottom nav or sidebar.

#### `app/department/page.tsx` — Order Builder

- **Item Search/Browse**: Search input + category grid (reuse POS search components).
- **Cart/Order List**: Selected items with quantities and prices.
- **Customer Info**: Optional name/phone input.
- **Actions**:
  - "Save Draft" — saves as pending sale.
  - "Forward to Cashier" — saves as pending + flags origin + notifies.
- **Quick Stats**: Number of pending orders, recent activity.

#### `app/department/requests/page.tsx` — My Requests

- Filterable list of all requests originated by the current user.
- Columns: Request ID, Customer, Item Count, Total, Status, Created At.
- Status badges with color coding (Pending / In Cart / Paid / Cancelled).
- Click to expand: show line items, timestamps, which cashier handled it.

#### `app/department/stock/page.tsx` — Stock Operations

- **Item selector** (search + select).
- **Operation type** radio/select:
  - Stock Adjustment (increase/decrease)
  - Damage / Spoilage
  - Theft / Loss
  - Expired Write-off
  - Internal Consumption
  - Return to Supplier
- **Quantity** input.
- **Reason / Notes** (mandatory textarea).
- **Confirm** button → calls `POST /api/stock/adjust` with appropriate reason.
- Shows success/error feedback.

### 6.8 Cashier Integration

**File**: `app/admin/pending-carts/page.tsx`

- Add a filter toggle: "Show department staff requests" / "All pending".
- When displaying a pending sale that originated from department staff, show:
  - Badge: "🧑‍🌾 Prepared by [Name]"
  - Department info if available.
- When a cashier loads the pending cart into POS, update the origin record status to `in_cart`.

**File**: `app/pos/page.tsx`

- When a pending sale loaded into cart originated from department staff:
  - Show indicator: "Order prepared by [Name]"
  - On checkout completion, update origin status to `completed` and link `sale_id`.

**File**: `app/pos/checkout/page.tsx`

- No structural changes needed — the checkout already handles pending sales.
- Just ensure the origin tracking fields are populated on completion.

### 6.9 Stock Operations UI

The existing `POST /api/stock/adjust` already supports all required reasons via the `reason` field:

```ts
const STOCK_ADJUSTMENT_REASONS = [
  'restock', 'spoilage', 'theft', 'counting_error', 'damage', 'other',
] as const;
```

For department staff, the UI should present these options with user-friendly labels:

| API Reason | UI Label | Use Case |
|---|---|---|
| `damage` | Damage / Spoilage | Visible product damage |
| `spoilage` | Expired / Spoiled | Product past expiration |
| `theft` | Theft / Loss | Stolen or missing items |
| `other` | Internal Consumption | Staff use / donation |
| `other` | Return to Supplier | Sent back to vendor |
| `other` | Counting Error | Inventory count correction |

> **Note**: All reduction operations flow through the same `POST /api/stock/adjust` endpoint with different `reason` values. The UI labels and icons differentiate them for clarity.

### 6.10 Audit Trail

**File**: `lib/db/activity-log.ts`

The existing `activity_log` table already captures everything needed:

| Column | Purpose |
|---|---|
| `business_id` | Tenant isolation |
| `action` | `create`, `update`, `delete`, `approve`, etc. |
| `entity_type` | `stock`, `damage`, `theft`, `expired_writeoff`, `internal_consumption`, `supplier_return`, `department_request` |
| `entity_id` | Related record ID |
| `entity_name_snapshot` | Item name or descriptive name |
| `details` | JSON with quantity, reason, diff, etc. |
| `performed_by` | User ID |
| `created_at` | Timestamp |

**File**: `app/admin/logs/page.tsx`

Add new entity types to the filter dropdown:

```ts
const ENTITY_TYPES = [
  // ... existing ...
  { value: 'damage', label: 'Damage' },
  { value: 'theft', label: 'Theft/Loss' },
  { value: 'expired_writeoff', label: 'Expired Write-off' },
  { value: 'internal_consumption', label: 'Internal Consumption' },
  { value: 'supplier_return', label: 'Supplier Return' },
  { value: 'department_request', label: 'Department Request' },
];
```

### 6.11 Reporting

Add a new section to administrative reporting (or extend existing reports):

- **Sales by Department Staff**: Filter completed sales by `originated_by_user_id`.
- **Stock Adjustments by Staff**: Filter `stock_adjustments` by `adjusted_by`, grouped by reason.
- **Department Activity Summary**: Number of requests, items forwarded, total value, by staff member, over a date range.

---

## 7. Implementation Phasing

### Phase 1: Foundation (~2 days)

| Step | Files | Description |
|---|---|---|
| 1.1 | `lib/constants.ts` | Add `department_staff` to `USER_ROLES` |
| 1.2 | `lib/auth/permissions.ts` | Add new role entry + new granular permission types + helpers |
| 1.3 | `lib/auth/config.ts` | Update Session, User, JWT type declarations |
| 1.4 | `lib/db/sql/schema.sql` | Update role CHECK constraint |
| 1.5 | `lib/db/migrate-department-staff-role.ts` | **New** — schema migration script |
| 1.6 | `middleware.ts` | Add department_staff routing rules |
| 1.7 | `app/api/users/route.ts` | Add `department_staff` to allowed roles |
| 1.8 | `components/admin/UserForm.tsx` | Add to role dropdown + description text |
| 1.9 | `components/admin/UserList.tsx` | Add role badge variant |

### Phase 2: Department Workspace (~3 days)

| Step | Files | Description |
|---|---|---|
| 2.1 | `app/department/layout.tsx` | **New** — role guard + layout shell |
| 2.2 | `app/department/page.tsx` | **New** — order builder dashboard |
| 2.3 | `app/department/requests/page.tsx` | **New** — "My Requests" list |
| 2.4 | `app/api/sales/pending/route.ts` | Add `originated_by_user_id` tracking on save |
| 2.5 | `app/api/department/forward/route.ts` | **New** — forward endpoint (marks as forwarded) |
| 2.6 | `app/admin/pending-carts/page.tsx` | Show originator info + filter |
| 2.7 | `app/pos/page.tsx` | Show origin indicator when loading dept carts |
| 2.8 | `app/api/sales/route.ts` | On completion, update origin tracking |

### Phase 3: Stock Operations (~1.5 days)

| Step | Files | Description |
|---|---|---|
| 3.1 | `app/department/stock/page.tsx` | **New** — stock operations UI with all reason types |
| 3.2 | `app/api/stock/adjust/route.ts` | Adjust approval flow: department staff → direct adjust (like admin) |
| 3.3 | `app/admin/logs/page.tsx` | Add new entity types to filter dropdown |

### Phase 4: Reporting & Polish (~1 day)

| Step | Files | Description |
|---|---|---|
| 4.1 | `app/admin/analytics/page.tsx` or new | Department staff activity report |
| 4.2 | Various | Add permission toggles in business settings (optional) |
| 4.3 | — | End-to-end testing of all flows |
| 4.4 | — | Update seed data to include a department_staff user |

---

## 8. Files Summary

### Files to Modify

| File | Phase | Change |
|---|---|---|
| `lib/constants.ts` | 1 | Add `department_staff` to `USER_ROLES` |
| `lib/auth/permissions.ts` | 1 | Add role entry + new permission types + helpers |
| `lib/auth/config.ts` | 1 | Update all role type annotations |
| `lib/auth/index.ts` | 1 | Update `requireRole` type |
| `lib/db/sql/schema.sql` | 1 | Update CHECK constraint |
| `middleware.ts` | 1 | Add department staff routing rules |
| `app/api/users/route.ts` | 1 | Add to allowed roles |
| `components/admin/UserForm.tsx` | 1 | Add to role dropdown |
| `components/admin/UserList.tsx` | 1 | Add badge variant |
| `app/api/sales/pending/route.ts` | 2 | Track origin on save |
| `app/admin/pending-carts/page.tsx` | 2 | Show originator info + filter |
| `app/pos/page.tsx` | 2 | Show origin indicator |
| `app/api/sales/route.ts` | 2 | Update origin tracking on completion |
| `app/api/stock/adjust/route.ts` | 3 | Adjust approval flow |
| `app/admin/logs/page.tsx` | 3 | Add new entity types |

### Files to Create

| File | Phase | Purpose |
|---|---|---|
| `lib/db/migrate-department-staff-role.ts` | 1 | Schema migration for role constraint |
| `app/department/layout.tsx` | 2 | Layout for department workspace |
| `app/department/page.tsx` | 2 | Main department dashboard / order builder |
| `app/department/requests/page.tsx` | 2 | "My Requests" list with statuses |
| `app/department/stock/page.tsx` | 3 | Stock operations hub |
| `app/api/department/forward/route.ts` | 2 | Forward order to cashier endpoint |

---

## 9. Key Design Decisions

### 9.1 Reuse Pending Sales Over Dedicated Tables

**Decision**: Add a single `originated_by_user_id` column to the `sales` table rather than creating a full `department_requests` table.

**Rationale**:
- The existing pending-sale mechanism (`sales.status = 'pending'`) already handles saving carts, listing them, and loading into POS.
- Adding a separate table would require duplicating the load/merge/complete logic.
- The `originated_by_user_id` column is a lightweight discriminator.
- If tracking requirements grow, migrate to a dedicated table in a later phase.

### 9.2 Direct Stock Adjustments (Not Approval Flow)

**Decision**: Department staff perform direct stock adjustments (like admin), not the cashier approval-request flow.

**Rationale**:
- The role is explicitly trusted for inventory management.
- Requiring admin approval for every adjustment defeats the purpose of delegating stock operations.
- All adjustments are already fully audited via the `activity_log` table.
- Admins can revoke `adjust_stock` permission if needed.

### 9.3 Separate Route From POS

**Decision**: Department workspace lives at `/department`, not integrated into `/pos`.

**Rationale**:
- Visually and functionally separates order preparation from payment processing.
- Avoids confusion between "building an order" and "checking out."
- Allows a simplified UI focused on the department staff's specific tasks.
- Reinforces the restriction: department staff never see the checkout screen.

### 9.4 Cashier Remains Gatekeeper

**Decision**: Only users with the `sell` permission (cashier, admin, owner) can call `POST /api/sales` to complete checkout.

**Rationale**:
- Payment processing requires shift management, cash drawer operations, and financial accountability that department staff should not have.
- This is the core boundary enforced by the role.

### 9.5 Granular Stock Permissions

**Decision**: Separate permissions for each stock reduction type (damage, theft, expired, consumption, supplier return) rather than a single generic `adjust_stock` permission.

**Rationale**:
- Different businesses may want different levels of trust.
- An admin may allow "record damage" but restrict "record theft" to managers.
- Provides fine-grained audit trail categorization.
- Aligns with the existing permission granularity pattern.

### 9.6 No New Package Dependencies

**Decision**: All functionality uses existing dependencies (Turso/SQLite, Next.js 14, shadcn/ui, NextAuth, Lucide icons).

**Rationale**: Avoids unnecessary churn and security surface area.

---

## Appendix: User Interface Mockups

### Department Workspace — Order Builder

```
┌─────────────────────────────────────────────────┐
│  🏪 My Store      Department Staff: Jane  [⚙️] │
├─────────────────────┬───────────────────────────┤
│  [Orders] [Stock]   │  Current Order            │
│  [My Requests]      │                           │
│                     │  ┌──────────────────────┐ │
│  🔍 Search items... │  │ 🍅 Tomatoes x2  KES 240│ │
│                     │  │ 🧅 Onions    x1  KES  80│ │
│  ┌──────┬───────┐   │  │ 🥬 Kale      x3  KES 120│ │
│  │🥬 Veg │🍎 Fruit│   │  └──────────────────────┘ │
│  ├──────┼───────┤   │  Total: KES 440           │
│  │🌾 Grain│🥛 Dairy│   │                           │
│  └──────┴───────┘   │  Customer: [___________]  │
│                     │                           │
│  All items in       │  [💾 Save] [➡️ Forward]   │
│  Vegetables         │                           │
│  ┌────────────────┐ │                           │
│  │ 🍅 Tomatoes    │ │                           │
│  │   KES 120/pc   │ │                           │
│  │   Stock: 50    │ │                           │
│  │   [+ Add]      │ │                           │
│  ├────────────────┤ │                           │
│  │ 🧅 Onions      │ │                           │
│  │   KES 80/pc    │ │                           │
│  │   Stock: 30    │ │                           │
│  │   [+ Add]      │ │                           │
│  └────────────────┘ │                           │
└─────────────────────┴───────────────────────────┘
```

### My Requests — Status View

```
┌─────────────────────────────────────────────────┐
│  My Requests           [Pending] [All] [🔍]     │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ #ORD-003   🟡 Pending   3 items  KES 440   │ │
│ │ Fri 14 Jun 10:30 AM    → [Cancel]          │ │
│ ├─────────────────────────────────────────────┤ │
│ │ #ORD-002   🔵 In Cart   5 items  KES 1,200 │ │
│ │ Fri 14 Jun 09:15 AM    👤 Cashier: John    │ │
│ ├─────────────────────────────────────────────┤ │
│ │ #ORD-001   🟢 Paid      2 items  KES 320   │ │
│ │ Thu 13 Jun 04:45 PM    👤 Cashier: Mary    │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Stock Operations Hub

```
┌─────────────────────────────────────────────────┐
│  Stock Operations                               │
├─────────────────────────────────────────────────┤
│  Select Item: [🔍 Search or scan barcode...]    │
│                                                 │
│  Operation Type:                                │
│  ┌─────────────────────────────────────────┐    │
│  │ ○ Stock Adjustment (increase/decrease)  │    │
│  │ ● Damage / Spoilage                     │    │
│  │ ○ Theft / Loss                          │    │
│  │ ○ Expired Write-off                     │    │
│  │ ○ Internal Consumption                  │    │
│  │ ○ Return to Supplier                    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Current Stock: 50 units                       │
│  Quantity to record: [___] units                │
│                                                 │
│  Reason / Notes:                               │
│  [Found damaged during shelf restock..........] │
│  [............................................] │
│                                                 │
│  [✗ Cancel]                    [✓ Record Loss]  │
└─────────────────────────────────────────────────┘
```
