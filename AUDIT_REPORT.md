# POS Cashier Sales Flow & Supplier Bills — Comprehensive Audit Report

**Date:** 2026-06-15  
**Scope:** Cashier sales flow, supplier bills, business validations, data integrity, audit trail, permissions, UX.  
**Perspective:** Real-world retail / mini-mart / supermarket / pharmacy / hardware store POS.  
**Auditors:** Senior POS architecture review against Square, Shopify POS, Lightspeed, Loyverse benchmarks.

---

## Executive Summary

The system is functionally rich and already supports multi-cart POS, split payments, M-Pesa STK, wallet, credit, supplier bills, stock approvals, and offline mode. However, it is currently **operationally fragile** for a high-volume retail environment. The biggest risks are:

1. **No database transactions** — every multi-step sale, void, stock receipt, or supplier-bill operation is a sequence of independent SQL statements. A crash mid-operation corrupts ledgers and inventory.
2. **Weak business-rule enforcement** — cashiers can sell below cost, sell inactive/out-of-stock/expiring items, override prices without approval, and receive supplier stock without approval.
3. **Supplier bills lack accounting integrity** — amount, line items, and stock received are not reconciled; cancelled/edited bills do not reverse inventory; batch and expiry validation is missing.
4. **Permissions are inconsistent** — `void_own_sale`, `manage_items`, and `adjust_stock` are defined but bypassed or contradictory. Several sensitive API routes expose data to cashiers or have no auth at all.
5. **POS UX is monolithic and duplicated** — `app/pos/page.tsx` is 3,500+ lines with parallel mobile/desktop trees, making fixes error-prone and slowing the cashier down.
6. **Audit trail is fragmented** — sale creation is not logged, supplier bill edits/cancels are not logged, and `logActivity` is fire-and-forget rather than transactional.

The system works for a single cashier / low-concurrency shop today, but would likely produce inventory oversells, ledger imbalances, and audit gaps under real-world concurrent load.

---

## Severity Legend

- **Critical** — Data corruption, financial loss, or security breach risk.
- **High** — Daily operational pain, compliance risk, or frequent cashier errors.
- **Medium** — Noticeable friction, should be fixed in next sprint.
- **Low** — Polish / nice-to-have.

---

## 1. Cashier Sales Flow Findings

### 1.1 Architecture & Maintainability

#### 1.1.1 Monolithic, duplicated POS page

- **File:** `app/pos/page.tsx` (~3,559 lines)
- **Problem:** The page renders two complete JSX trees — one mobile (`md:hidden`) and one desktop (`hidden md:block`). Header, search, category grid, cart drawer, checkout drawer, receipt drawer, variant selector, and toast wiring are duplicated.
- **Why it matters:** Every bug fix and feature must be applied twice. This is unsustainable and prone to divergence. It also bloats the JS bundle sent to the POS device.
- **Business impact:** Slower iteration, higher defect rate, inconsistent cashier experience between tablet and desktop.
- **Solution:** Extract reusable sub-components (`PosHeader`, `ProductBrowser`, `CartPanel`, `CheckoutPanel`, `ReceiptPanel`) and render a single responsive layout. Use a shared state machine or hooks for cart, search, and payment.
- **Priority:** High

#### 1.1.2 Dead / unused components

- **Files:** `components/admin/SupplierBillEditForm.tsx`, standalone edit form never imported.
- **Problem:** Unused code confuses new developers and increases maintenance surface.
- **Solution:** Delete or integrate.
- **Priority:** Low

---

### 1.2 Landing on the Sales Screen

#### 1.2.1 Prominent "Clear cache and reload" in header

- **Files:** `app/pos/page.tsx` lines 1971–1977 (mobile), 2734–2743 (desktop)
- **Problem:** A destructive action sits next to everyday header icons where a cashier can tap it accidentally.
- **Business impact:** Lost cart state, interrupted sales, frustrated queue.
- **Solution:** Move to a settings/admin menu or hide behind a confirmation. Better: auto-recover from cache issues instead of asking cashiers to clear.
- **Priority:** High

#### 1.2.2 Stock filters hidden behind obscure icon

- **Problem:** Stock filters (low stock, out of stock, top sellers) are behind a small chart icon and visible only to owners/admins.
- **Business impact:** Cashiers cannot quickly see what is running low or unavailable.
- **Solution:** Make stock status visible directly on product cards (badges, color bands) and expose simple filters in a bottom sheet.
- **Priority:** Medium

---

### 1.3 Product Search, Selection & Barcode Scanning

#### 1.3.1 Out-of-stock / negative-stock items remain clickable

- **File:** `components/pos/ItemGrid.tsx` lines 96–109
- **Problem:** `onClick={() => onSelect(item)}` fires even when `isOutOfStock` is true. The card only dims.
- **Business impact:** Cashiers accidentally sell stock that does not exist, leading to negative inventory and customer disappointment.
- **Solution:** Disable selection by default. Add an explicit "Oversell override" that requires manager PIN/permission and logs the reason.
- **Priority:** Critical

#### 1.3.2 AddToCartDialog allows unlimited quantity

- **File:** `components/pos/AddToCartDialog.tsx` line 214
- **Problem:** The comment explicitly says "Remove maxQuantity restriction — allow any quantity."
- **Business impact:** Negative stock, incorrect FIFO allocation, incorrect profit reporting.
- **Solution:** Default to blocking quantity > available stock. Provide an override requiring permission.
- **Priority:** Critical

#### 1.3.3 No below-cost price guard

- **File:** `components/pos/AddToCartDialog.tsx` lines 255–272; `app/api/sales/route.ts`
- **Problem:** Manual price accepts 0 and any positive number; it is never compared to `buy_price_per_unit`. The server accepts any `item.price` from the client.
- **Business impact:** Cashiers can accidentally or maliciously sell at a loss. Profit reports become meaningless.
- **Solution:**
  - Client: warn when manual price is below cost or below a configurable floor.
  - Server: reject prices below cost unless the user has `can_override_price` permission / manager PIN.
- **Priority:** Critical

#### 1.3.4 Barcode scanner hook timing issues

- **File:** `lib/hooks/use-barcode-scanner.ts`
- **Problem:** `maxDelay` default is 100 ms; wireless scanners may fire slower. The hook also swallows keystrokes when a non-search input is focused if time diff < 150 ms.
- **Business impact:** Missed scans or accidental scans entering wrong products.
- **Solution:** Make scanner delay configurable per device. Only intercept scan input when no input/textarea is focused, and require a leading scanner prefix/suffix if supported.
- **Priority:** Medium

#### 1.3.5 Camera scanner lacks controls

- **File:** `components/pos/BarcodeCameraScannerDialog.tsx` line 98
- **Problem:** Uses default camera (`undefined`), no torch, no switch-camera, no manual entry fallback.
- **Business impact:** On tablets the front camera is selected; scanning fails in low light.
- **Solution:** Add camera selection, torch toggle, and a "Type barcode" fallback.
- **Priority:** Medium

#### 1.3.6 No fuzzy barcode fallback

- **File:** `app/api/items/barcode/[code]/route.ts`
- **Problem:** Only exact barcode match.
- **Business impact:** Damaged or partially-scanned labels require manual search.
- **Solution:** Add fuzzy matching on the last N digits and show a disambiguation dialog.
- **Priority:** Low

#### 1.3.7 "Custom Amount" pill is dead on mobile

- **File:** `app/pos/page.tsx` line 2161–2164
- **Problem:** A non-interactive `<button>` labeled "Custom Amount" has no click handler.
- **Business impact:** Confuses cashiers; appears broken.
- **Solution:** Implement quick custom-item/sale flow or remove the pill.
- **Priority:** Medium

#### 1.3.8 Tiny quick-add buttons on mobile

- **File:** `components/pos/ItemGrid.tsx` lines 884–894
- **Problem:** Quick-add button is `h-4 sm:h-5` with `text-[8px]`.
- **Business impact:** Hard to tap accurately on a kiosk/tablet, leading to wrong quantities.
- **Solution:** Minimum touch target 44×44 dp, larger font.
- **Priority:** Medium

---

### 1.4 Cart Management

#### 1.4.1 Cart stores stale prices and inactive items

- **File:** `lib/stores/cart-store.ts` lines 34–36, 169–220
- **Problem:** Cart stores `itemId`, `price`, `name`, etc. It does not re-fetch current price or active status at checkout.
- **Business impact:** Admin price changes are ignored; inactive or deleted products can be sold.
- **Solution:** At checkout, revalidate every cart line against the server (price, active status, stock, expiry). Reject or refresh stale lines.
- **Priority:** High

#### 1.4.2 No customer/order notes per cart

- **Problem:** Multi-cart tabs exist but cannot be labeled "Table 5 / Mary / Phone order."
- **Business impact:** Confusion when multiple held orders exist.
- **Solution:** Add cart name/notes and show them on tabs.
- **Priority:** Medium

#### 1.4.3 Delete cart creates a new empty cart silently

- **File:** `lib/stores/cart-store.ts` lines 135–159
- **Problem:** Deleting the last cart auto-creates a new one without clear feedback.
- **Business impact:** Cashiers may think the cart was not cleared.
- **Solution:** Keep at least one cart visually stable; animate the clear action.
- **Priority:** Low

#### 1.4.4 Clear cart has no confirmation in CartView

- **File:** `components/pos/CartView.tsx` line 266
- **Problem:** `onClick={clearCart}` directly clears the cart. The main POS page only confirms for the floating cart button.
- **Business impact:** Accidental loss of a large order.
- **Solution:** Require confirmation or undo toast for any clear action.
- **Priority:** High

#### 1.4.5 Manual-price lines are not visually flagged

- **File:** `components/pos/CartView.tsx` lines 166–205
- **Problem:** A line sold at a manual price looks identical to a regular line.
- **Business impact:** Manager cannot spot suspicious pricing at a glance.
- **Solution:** Show a "manual price" badge and highlight discounted lines.
- **Priority:** Medium

---

### 1.5 Discounts, Price Overrides & Permissions

#### 1.5.1 No permission for price override / discount

- **Files:** `components/pos/AddToCartDialog.tsx`, `app/api/sales/route.ts`
- **Problem:** Manual price is available to every authenticated user; the backend accepts any price.
- **Business impact:** Untrained cashiers can give arbitrary discounts.
- **Solution:**
  - Add `can_override_price` and `can_give_discount` permissions.
  - Require manager PIN for discounts above a threshold or below cost.
  - Backend must validate submitted price against `current_sell_price` and `buy_price`.
- **Priority:** Critical

#### 1.5.2 No percentage discount, only absolute manual price

- **File:** `components/pos/AddToCartDialog.tsx`
- **Problem:** Cashiers must calculate "10% off" mentally and type the result.
- **Business impact:** Slower checkout, calculation errors.
- **Solution:** Offer "% off", "amount off", and "new price" inputs with live preview.
- **Priority:** High

#### 1.5.3 Bundle quantity control is slow

- **File:** `components/pos/AddToCartDialog.tsx` lines 622–635
- **Problem:** Only +/- buttons; no typed input for bundle count.
- **Business impact:** Slow for large bundles (e.g., 24-pack water).
- **Solution:** Allow direct number entry for bundle quantity.
- **Priority:** Medium

---

### 1.6 Customer Selection & Credit

#### 1.6.1 Phone normalization inconsistent

- **Files:** `components/pos/CreditForm.tsx` lines 118–121; `components/pos/WalletApplySection.tsx` lines 156–169
- **Problem:** Credit form strips leading 0; wallet form does not normalize consistently.
- **Business impact:** Duplicate or missed customer lookups.
- **Solution:** Centralize phone normalization (E.164 for Kenya) and reuse it.
- **Priority:** Medium

#### 1.6.2 Wallet auto-applies maximum without confirmation

- **File:** `components/pos/WalletApplySection.tsx` lines 121–129
- **Problem:** Selecting a customer immediately applies `Math.min(balance, cartTotal)`.
- **Business impact:** Cashiers may unintentionally consume a customer's full wallet balance.
- **Solution:** Show balance and let cashier type the amount to apply, with "Max" as a button.
- **Priority:** High

#### 1.6.3 `can_give_credit` flag is not surfaced in UI

- **File:** `app/api/sales/route.ts` lines 702–710
- **Problem:** Cashier only discovers they cannot give credit when the API returns an error.
- **Business impact:** Embarrassing delay at checkout.
- **Solution:** Disable/hide credit payment option when the cashier lacks `can_give_credit`.
- **Priority:** High

#### 1.6.4 Duplicate credit accounts possible

- **Evidence:** No unique constraint on normalized phone per business.
- **Business impact:** Same customer gets multiple accounts; balances diverge.
- **Solution:** Add unique index on `(business_id, normalized_phone)` and merge duplicates during migration.
- **Priority:** High

---

### 1.7 Payment Collection, Split Payments & Change

#### 1.7.1 M-Pesa "Mark Paid" bypasses verification

- **File:** `components/pos/CheckoutForm.tsx` lines 1289–1341
- **Problem:** A "Mark Paid" button completes the sale without verifying the STK payment.
- **Business impact:** Cashiers can mark fraudulent/unpaid M-Pesa sales as completed.
- **Solution:** Require manager PIN for "Mark Paid" and log it as a manual override. Prefer auto-verification only.
- **Priority:** Critical

#### 1.7.2 M-Pesa success is indistinguishable from manual mark-paid in DB

- **File:** `app/api/sales/route.ts` lines 448–466
- **Problem:** Both store `payment_method = 'mpesa'`.
- **Business impact:** Reconciliation with M-Pesa statement is impossible.
- **Solution:** Add `payment_verified` boolean and `mpesa_transaction_code` field. Record manual overrides separately.
- **Priority:** High

#### 1.7.3 Split payment lacks M-Pesa STK and wallet

- **File:** `components/pos/SplitPaymentForm.tsx` lines 28–31
- **Problem:** Split only supports cash/credit/M-Pesa lump amounts, not STK push or wallet partial pay.
- **Business impact:** Cannot handle common scenarios like "part cash + part M-Pesa."
- **Solution:** Allow any payment method in split payments, including wallet and M-Pesa STK per portion.
- **Priority:** High

#### 1.7.4 Split payment blocks duplicate methods

- **File:** `components/pos/SplitPaymentForm.tsx` lines 52–57
- **Problem:** Only one cash entry allowed.
- **Business impact:** Cannot record "two customers each paid cash."
- **Solution:** Allow multiple entries of the same method with separate amounts/notes.
- **Priority:** Medium

#### 1.7.5 Overpayment / underpayment only checked server-side

- **File:** `app/api/sales/route.ts` lines 276–283
- **Problem:** Cash received below amount due is blocked only on the server.
- **Business impact:** Cashier clicks "Complete" and only then gets an error.
- **Solution:** Validate totals client-side before enabling the complete button.
- **Priority:** High

#### 1.7.6 Suggested cash amounts can be unhelpful

- **File:** `components/pos/CheckoutForm.tsx` lines 189–206
- **Problem:** For amount 45, suggestions are just 45 instead of nearest convenient denomination.
- **Business impact:** Slower cash payment entry.
- **Solution:** Always suggest next common denominations (50, 100, 200, 500, 1000, 2000) and "Exact."
- **Priority:** Low

---

### 1.8 Receipt Generation & Sale Completion

#### 1.8.1 Hardcoded store details on receipt

- **File:** `components/pos/Receipt.tsx` lines 102, 128–135, 318–323
- **Problem:** Store name, till number, website, and phone are hardcoded as "FnM's / Fresh n More."
- **Business impact:** Receipts are incorrect for other businesses.
- **Solution:** Pull from `businesses` settings.
- **Priority:** High

#### 1.8.2 Receipt title ignores wallet-only sales

- **File:** `components/pos/Receipt.tsx` lines 25–38
- **Problem:** Title is based on `sale.payment_method`; wallet-only sales mislabeled.
- **Business impact:** Customer confusion and accounting mismatch.
- **Solution:** Detect wallet payment from `sale_payments` and label accordingly.
- **Priority:** Medium

#### 1.8.3 No reprint last receipt on main POS screen

- **Problem:** Once the receipt drawer closes, there is no quick reprint.
- **Business impact:** Cashier must navigate away or reopen sale history.
- **Solution:** Keep "Reprint last receipt" button in header or drawer.
- **Priority:** Medium

#### 1.8.4 Offline receipt is synthetic and incomplete

- **File:** `app/pos/receipt/[id]/page.tsx` lines 29–51
- **Problem:** Offline receipt uses `business_name: 'POS'` and no split payments.
- **Business impact:** Poor customer experience when offline.
- **Solution:** Cache business profile and full receipt data for offline viewing.
- **Priority:** Medium

---

### 1.9 Returns, Refunds & Voids

#### 1.9.1 No return / partial-refund flow

- **Evidence:** No return UI in `app/pos/` or `components/pos/`.
- **Problem:** Cashiers cannot process a return or partial refund. Only full admin void exists.
- **Business impact:** Slow customer service; returns must be escalated to admin.
- **Solution:** Build a "Returns" mode in POS: select original sale, choose items/qty to return, choose refund method (cash / M-Pesa / credit note), and print credit note/refund receipt.
- **Priority:** Critical

#### 1.9.2 Void permission is wrong and unused

- **Files:** `lib/auth/permissions.ts` defines `void_own_sale`; `app/api/sales/[id]/route.ts` line 115 uses `view_all_sales`.
- **Problem:** Cashiers cannot void their own sales even though the permission exists.
- **Business impact:** Minor mistakes require manager intervention, slowing the queue.
- **Solution:** Implement `void_own_sale` with ownership check (`sale.user_id === auth.userId`) and require reason + manager PIN for voids above a threshold.
- **Priority:** High

#### 1.9.3 Void does not require reason

- **File:** `app/api/sales/[id]/route.ts` lines 119–128
- **Problem:** Reason field is accepted but not validated.
- **Business impact:** No accountability for voids.
- **Solution:** Require non-empty reason; log it in activity log.
- **Priority:** High

---

### 1.10 Keyboard Accessibility & Shortcuts

#### 1.10.1 Limited keyboard shortcuts

- **File:** `app/pos/page.tsx` lines 646–667
- **Problem:** Only `Ctrl/Cmd + K` (search) and `Esc` (close search) are provided.
- **Business impact:** Power cashiers are slowed down.
- **Solution:** Add shortcuts for:
  - Checkout: `Ctrl/Cmd + Enter`
  - Clear cart: `Ctrl/Cmd + Shift + C`
  - New cart: `Ctrl/Cmd + T`
  - Focus search: `/`
  - Quantity +1/-1: `+` / `-`
- **Priority:** Medium

#### 1.10.2 Checkout fields lack Enter-to-submit consistency

- **Problem:** Some inputs require clicking the button.
- **Business impact:** Slower keyboard-driven checkout.
- **Solution:** Standardize `Enter` to advance/complete where appropriate.
- **Priority:** Low

---

### 1.11 Mobile / Kiosk UX

#### 1.11.1 Category buttons are tiny text pills

- **File:** `app/pos/page.tsx` lines 2183–2191
- **Problem:** Small touch targets, no icons.
- **Solution:** Larger chips with icons; horizontal scroll with snap points.
- **Priority:** Medium

#### 1.11.2 No numeric keypad for quantity on mobile

- **Problem:** Quantity is controlled by +/- or portion buttons.
- **Business impact:** Slow for bulk items.
- **Solution:** Show a full-screen numeric keypad when quantity is focused.
- **Priority:** High

#### 1.11.3 Offline payment methods not clearly disabled

- **Problem:** When offline, credit/split/wallet are blocked by API but UI does not pre-disable them.
- **Business impact:** Cashier selects option then gets an error.
- **Solution:** Detect offline state and disable unsupported payment methods with tooltip.
- **Priority:** Medium

---

## 2. Business Logic Validation Gaps

### 2.1 Products

| Validation | Status | Evidence | Risk | Priority |
|---|---|---|---|---|
| Selling below cost | Missing | `AddToCartDialog` allows 0; `api/sales` never checks `buy_price` | Direct losses | Critical |
| Selling inactive products | Missing | Cart stores `itemId`; checkout does not re-verify `is_active` | Sells delisted items | Critical |
| Selling out-of-stock products | Missing | Dialog explicitly removes max quantity restriction | Negative stock | Critical |
| Selling expired / near-expiry products | Missing | FIFO selects by `received_at` only; expiry not checked | Health/legal risk (pharmacy/food) | Critical |
| Selling restricted products | Missing | No age-restriction or prescription flags | Compliance risk | High |
| Duplicate product in cart | Partial | Allowed; could warn when same item added twice | Pricing errors | Low |
| Unit conversion validation | Partial | Fractional quantities allowed for all unit types | Inventory drift | Medium |

### 2.2 Inventory

| Validation | Status | Evidence | Risk | Priority |
|---|---|---|---|---|
| Negative stock prevention | Missing | No DB CHECK; sale UPDATE can drive negative | Inventory/COGS errors | Critical |
| Batch selection validation | Partial | Selected batch verified but fallback FIFO can oversell | Wrong cost/profit | High |
| Expiry date validation | Missing | Batches are not blocked by expiry at sale time | Expired sales | Critical |
| Stock-take reconciliation | Missing | Stock take updates `items.current_stock` but not batches | Batch vs total mismatch | High |
| Concurrent sale oversell | Missing | No locking on FIFO read | Two sales sell same batch | Critical |

### 2.3 Pricing

| Validation | Status | Evidence | Risk | Priority |
|---|---|---|---|---|
| Invalid discounts | Missing | No max discount rule | Margin erosion | Critical |
| Excessive discounts | Missing | No threshold for manager approval | Fraud | Critical |
| Unauthorized price overrides | Missing | No permission exists | Revenue loss | Critical |
| Incorrect tax calculations | Partial | Need review of tax logic | Compliance/fines | Medium |
| Promotion conflicts | Missing | No promotion engine visible | Over-discounting | Medium |

### 2.4 Payments

| Validation | Status | Evidence | Risk | Priority |
|---|---|---|---|---|
| Overpayments | Partial | Server blocks underpayment; overpayment handled as change but could mismatch | Cash drawer errors | Medium |
| Underpayments | Enforced | Server checks | — | — |
| Invalid split payments | Partial | Duplicate methods blocked; methods limited | Cannot record real splits | High |
| Duplicate payment submissions | Partial | No idempotency key visible | Double charges | High |
| Failed payment recovery | Partial | M-Pesa polling exists; "Mark Paid" bypass weakens it | Unpaid sales marked paid | Critical |
| Wallet overdraft | Enforced | Server caps at balance | — | — |

### 2.5 Cashier Permissions

| Action | Current Permission | Issue | Recommendation |
|---|---|---|---|
| Void own sale | `void_own_sale` defined but unused | Cashier cannot void own sale | Implement with ownership check |
| Edit completed sale | Uses `view_all_sales` | No dedicated permission | Add `edit_completed_sale` |
| Price override | None | Anyone can override | Add `can_override_price` + PIN |
| Discount | None | Anyone can discount | Add `can_give_discount` + threshold |
| Refund | None | No refund feature | Add `process_refund` permission |
| Credit sale | `can_give_credit` user flag | Parallel auth layer | Consolidate into permissions or surface flag in UI |

---

## 3. Supplier Bills Flow Findings

### 3.1 Supplier Selection & Invoice Creation

#### 3.1.1 Manual suppliers fragment payables

- **Files:** `components/admin/SupplierBillForm.tsx` lines 306, 761–767; `app/api/supplier-bills/route.ts` lines 181–201
- **Problem:** Bills can be created with `supplier_id = NULL` and free-text `supplier_name`. Owed totals are grouped by `supplier_id`, so manual bills disappear from supplier statements.
- **Business impact:** Under-reported liabilities; reconciliation nightmare.
- **Solution:** Force supplier selection from the master list; allow inline creation but always link to a supplier record.
- **Priority:** High

#### 3.1.2 No supplier invoice reference number

- **Problem:** `supplier_bills` has no `supplier_invoice_no` column.
- **Business impact:** Cannot reconcile against supplier statements or detect duplicate invoices.
- **Solution:** Add `supplier_invoice_no` and unique constraint `(business_id, supplier_id, supplier_invoice_no)`.
- **Priority:** Critical

#### 3.1.3 No duplicate invoice detection

- **File:** `app/api/supplier-bills/route.ts` lines 124–201
- **Problem:** No uniqueness check on supplier + invoice number + amount + date.
- **Business impact:** Same supplier invoice can be entered and paid twice.
- **Solution:** Add unique constraint and warn on duplicate detection.
- **Priority:** Critical

#### 3.1.4 Future invoice date prevention missing

- **File:** `app/api/supplier-bills/route.ts` line 175
- **Problem:** `dueDate` and presumably invoice date are not capped.
- **Business impact:** Accidentally post-dated or future-dated bills distort aging reports.
- **Solution:** Reject invoice dates in the future and due dates unreasonably far out.
- **Priority:** Medium

#### 3.1.5 Cashier can create supplier bills and receive stock

- **Files:** `middleware.ts` lines 50–55; `app/api/supplier-bills/route.ts` lines 124–305
- **Problem:** Middleware blocks the list page but the API only uses `requireAuth`, so cashiers can call `POST /api/supplier-bills` directly to receive stock, bypassing the stock-approval workflow.
- **Business impact:** Weak segregation of duties; fraud risk.
- **Solution:** Require `record_purchase` or `breakdown_purchase` permission for supplier bills; cashier submissions should create pending approvals.
- **Priority:** Critical

---

### 3.2 Product Entry, Batch & Quantity

#### 3.2.1 Bill total not reconciled with line items or stock

- **File:** `app/api/supplier-bills/route.ts` lines 160–172, 204–271
- **Problem:** `amount` is sent from client and never recomputed from `bill_description` or `stockItems`. `stockItems` quantities × costs are not compared to `amount`.
- **Business impact:** A malicious or buggy client can record KES 100,000 payable while receiving KES 10,000 of stock.
- **Solution:** Server must recompute totals and reject mismatches.
- **Priority:** Critical

#### 3.2.2 Packaging data is not persisted

- **File:** `components/admin/SupplierBillForm.tsx` lines 838–867, 962–981
- **Problem:** `packages`, `packagingUnitName`, and `packagingUnitQty` are only used to build a text description.
- **Business impact:** Cannot track that stock was received as "2 cartons × 18."
- **Solution:** Persist packaging metadata or at least store structured line items.
- **Priority:** Medium

#### 3.2.3 Removing a line unlinks supplier product permanently

- **File:** `components/admin/SupplierBillForm.tsx` lines 876–900
- **Problem:** `removeLineItem` calls `DELETE /api/suppliers/${supplierId}/products?itemId=...`.
- **Business impact:** Catalog relationships are destroyed while composing a bill.
- **Solution:** Decouple bill composition from supplier-product catalog. Remove the DELETE call.
- **Priority:** High

#### 3.2.4 Negative/zero cost and quantity not rejected

- **Files:** `app/api/supplier-bills/route.ts` lines 215–217, 246; `lib/db/buying-prices.ts`
- **Problem:** Negative/zero `costPricePerUnit` inserted directly. Quantity <= 0 is skipped silently.
- **Business impact:** Distorted COGS and profit.
- **Solution:** Reject any line with quantity <= 0 or cost <= 0.
- **Priority:** Critical

#### 3.2.5 Free-text lines can receive stock via crafted request

- **File:** `components/admin/SupplierBillForm.tsx` lines 1119–1120
- **Problem:** Client only sends `stockItems` for lines with `itemId`, but server never validates that `stockItems` match `bill_description`.
- **Business impact:** Stock can be inflated for items not on the bill.
- **Solution:** Server-side reconciliation and item ownership checks.
- **Priority:** Critical

---

### 3.3 Expiry Date Handling

#### 3.3.1 Expiry dates not validated

- **File:** `app/api/supplier-bills/route.ts` line 248
- **Problem:** Expiry is optional and not checked against received date.
- **Business impact:** Expired or impossibly far-future batches enter inventory.
- **Solution:** Require expiry for perishable items; reject expiry before received date or more than N years in future.
- **Priority:** Critical

#### 3.3.2 Expired batches not blocked from sale

- **Problem:** `inventory_batches.status` is set to `active` regardless of expiry.
- **Business impact:** Expired products sold.
- **Solution:** FIFO helper must skip expired batches; warn cashier if only expired batch available.
- **Priority:** Critical

#### 3.3.3 Expiry lost on edit/replication

- **File:** `components/admin/SupplierBillForm.tsx` lines 195–267
- **Problem:** `parseBillDescriptionToLineItems` does not restore `itemId`, `batchNumber`, or `expiryDate`.
- **Business impact:** Edited/replicated bills lose critical traceability.
- **Solution:** Store line items as structured JSON (`bill_items` table or JSON column), not plain text.
- **Priority:** High

---

### 3.4 Receiving Stock & Inventory Updates

#### 3.4.1 No database transaction for bill + stock receipt

- **File:** `app/api/supplier-bills/route.ts` lines 181–281
- **Problem:** Bill insert, batch inserts, stock updates, and buying-price inserts are separate `execute()` calls.
- **Business impact:** Partial failure leaves orphan stock or missing bill.
- **Solution:** Wrap in `BEGIN/COMMIT/ROLLBACK` transaction.
- **Priority:** Critical

#### 3.4.2 No link from batch back to supplier bill

- **File:** `app/api/supplier-bills/route.ts` lines 232–251
- **Problem:** `inventory_batches.source_breakdown_id` is NULL; no `supplier_bill_id` column.
- **Business impact:** Cannot trace stock to originating bill.
- **Solution:** Add `supplier_bill_id` foreign key to `inventory_batches`.
- **Priority:** High

#### 3.4.3 Cancelled/edited bills do not reverse inventory

- **Files:** `app/api/supplier-bills/[id]/route.ts` lines 210–216 (cancel), lines 64–165 (edit)
- **Problem:** Cancel sets status only. Edit updates header but explicitly does not update stock.
- **Business impact:** Inventory and payables diverge; cancelled bills can hide liabilities while keeping stock.
- **Solution:** On cancel, reverse stock and batches or require admin confirmation. On edit, block if stock has been sold/used; otherwise update batches atomically.
- **Priority:** Critical

#### 3.4.4 Concurrent stock updates unprotected

- **File:** `app/api/supplier-bills/route.ts` lines 254–259
- **Problem:** `UPDATE items SET current_stock = current_stock + ?` has no locking.
- **Business impact:** Two simultaneous bills for the same item can lose updates.
- **Solution:** Use transactions and/or row versioning.
- **Priority:** High

#### 3.4.5 "Reset stock to 0" from bill form is risky

- **File:** `components/admin/SupplierBillForm.tsx` lines 999–1052
- **Problem:** Generic stock adjustment with reason `counting_error` and notes `Reset from Supplier Bill`. UI updates local stock to 0 immediately.
- **Business impact:** Stock can be zeroed without clear audit trail or approval.
- **Solution:** Remove this side action from the bill form; route stock adjustments through the dedicated stock-adjustment workflow.
- **Priority:** High

#### 3.4.6 No stock adjustment record for receipt

- **Problem:** Unlike purchase breakdowns, supplier-bill receipts do not write `stock_adjustments`.
- **Business impact:** Stock movement history is incomplete.
- **Solution:** Write a `stock_adjustments` row for every supplier-bill stock receipt.
- **Priority:** Medium

---

### 3.5 Drafts, Editing, Posting/Finalizing

#### 3.5.1 Drafts are client-side only

- **File:** `components/admin/SupplierBillForm.tsx` lines 142–187, 418–464
- **Problem:** Drafts live in `sessionStorage` and are lost when the tab closes.
- **Business impact:** Partial bills lost; re-entry waste.
- **Solution:** Persist drafts to the database with `status = 'draft'` and tie to user/device.
- **Priority:** Medium

#### 3.5.2 No posted/finalized state

- **Problem:** Statuses are `pending` → `paid`/`cancelled`. There is no `posted`/`finalized` lock.
- **Business impact:** Bills can be edited after partial payment or stock consumption.
- **Solution:** Add `posted` status and lock inventory/financial impact once posted.
- **Priority:** High

#### 3.5.3 Mark-as-paid lacks amount validation

- **File:** `app/api/supplier-bills/[id]/pay/route.ts` lines 28–75
- **Problem:** Accepts any payment method/notes; does not verify payment covers amount.
- **Business impact:** Partial payments can mark bill as fully paid.
- **Solution:** Require `amountPaid` and record partial payments; enforce `amountPaid >= amount` for full paid status.
- **Priority:** High

#### 3.5.4 Replicate clones without duplicate warnings

- **File:** `app/admin/supplier-bills/page.tsx` lines 70–97
- **Problem:** Replicated bill is treated as brand new.
- **Business impact:** Duplicate supplier invoices.
- **Solution:** Warn if supplier + invoice number already exists.
- **Priority:** Medium

---

### 3.6 Supplier Bills Validation Matrix

| Validation | Status | Priority |
|---|---|---|
| Duplicate supplier invoice detection | Missing | Critical |
| Supplier belongs to business | Partial | High |
| Future invoice date prevention | Missing | Medium |
| Negative quantity prevention | Missing (skipped silently) | Critical |
| Negative cost prevention | Missing | Critical |
| Expiry date validation | Missing | Critical |
| Duplicate batch detection | Missing (no UNIQUE constraint) | Critical |
| Supplier-product consistency | Partial | High |
| Total mismatch warnings | Missing | Critical |
| Receiving quantity vs invoice quantity | Missing | Critical |
| Payment method allowed values | Missing | Medium |
| Paid bills cannot be edited/cancelled | Enforced | — |
| Only admin/owner can cancel/mark paid | Enforced | — |

---

## 4. Data Integrity & Audit Trail

### 4.1 No Database Transactions

- **Evidence:** `lib/db/index.ts` only exports `execute`, `query`, `queryOne`. No `transaction()` helper. Every multi-step mutation is independent.
- **Affected flows:** Sale creation, sale void, stock adjustments, purchase breakdown, supplier bills, credit payments, shift open/close, loyalty awards.
- **Risk:** Partial failures produce inconsistent ledgers, inventory, and shift cash.
- **Priority:** Critical

### 4.2 Foreign Keys Not Enforced Per Connection

- **Evidence:** `lib/db/sql/schema.sql` begins with `PRAGMA foreign_keys = ON`, but `lib/db/index.ts` never sets it on the runtime connection.
- **Risk:** Orphan rows, invalid references, silent data corruption.
- **Priority:** High

### 4.3 Concurrency / Race Conditions

| Scenario | Evidence | Risk | Priority |
|---|---|---|---|
| Concurrent sales oversell same batch | `lib/db/fifo.ts` no locking | Negative stock | Critical |
| Concurrent stock adjustments lose updates | `app/api/stock/adjust/route.ts` read-then-update | Wrong stock | Critical |
| Duplicate open shifts | `app/api/balance/approvals/[id]/approve/route.ts` non-atomic check | Two active shifts | High |
| Duplicate credit accounts | No unique phone constraint | Duplicate balances | High |
| Credit balance overwrites | `app/api/credits/pending-payments/[transactionId]/route.ts` no version check | Lost updates | High |

### 4.4 Inventory Synchronization Risks

- **Denormalized `items.current_stock`**: Updated by many paths but never guaranteed to equal sum of `inventory_batches.quantity_remaining`.
- **Batch status drift**: Only sale route marks batches `depleted`; adjustments/voids do not reconcile.
- **Stock take does not allocate to batches**: Only updates `items.current_stock`.
- **Wastage race in purchase breakdown**: Re-reads stock between adding usable quantity and subtracting wastage.
- **Priority:** Critical

### 4.5 Audit Trail Gaps

| Action | Logged? | Issue | Priority |
|---|---|---|---|
| Sale creation | No | No record of who sold what | Critical |
| Sale void | No | Void is unlogged | Critical |
| Supplier bill create | Minimal | Only amount/supplier/count; no item/batch details | High |
| Supplier bill edit | No | Changes untracked | Critical |
| Supplier bill cancel | No | Cancel untracked | Critical |
| Purchase item additions | No | Changes untracked | High |
| Supplier-product unlink in bill form | No | Catalog mutation hidden | High |
| `logActivity` failures | Ignored | Audit row may never be written | High |

- **Recommendation:** Make `logActivity` part of the same transaction as the business operation; add `before`/`after` snapshots, IP, and role snapshot.

### 4.6 Dangerous Unauthenticated Routes

| Route | Risk | Priority |
|---|---|---|
| `POST /api/auth/register` | Anyone can create business/owner | Critical |
| `POST /api/superadmin/setup` | Superadmin takeover on fresh install | Critical |
| `POST /api/db/seed` | Anyone can seed database | Critical |
| `GET /api/db/test` | DB connectivity probe | Low |
| `GET/POST /api/db/migrate` | Run migrations unauthenticated | Critical |
| `POST /api/db/reset` | Drop all tables unauthenticated | Critical |

---

## 5. Permissions & Security

### 5.1 Permission Model Issues

- **Permission type duplicated** in `lib/auth/api-auth.ts` and `lib/auth/permissions.ts` — maintenance risk.
- **`void_own_sale` is dead code** — defined but never enforced.
- **Cashier granted `manage_items` and `adjust_stock`** but blocked from `/admin/items/*/edit` and stock-take UI — contradictory.
- **No permissions for price override, discount, refund** — these powerful actions are unprotected.
- **Middleware excludes `/api/*`** — every API route must enforce auth itself; some do not.

### 5.2 Data Exposure to Cashiers

- `GET /api/sales/by-date`, `GET /api/sales/[id]`, `GET /api/sales/summary`, `GET /api/sales/analytics/daily` only require auth; cashiers can view all sales.
- `GET /api/items/[id]` returns `buy_price` to any authenticated user.
- `GET /api/activity-log` returns all logs to any authenticated user.
- **Priority:** High

### 5.3 Client-Side Role Checks Are Bypassable

- `app/admin/transactions/page.tsx` computes `canVoid` client-side. API correctly rejects, but the pattern is fragile.
- **Solution:** Always enforce in API; use client-side checks only for UI convenience.
- **Priority:** Medium

### 5.4 External API Keys

- SHA256 hashed, no HMAC, no per-key scoping, no expiry/rotation visible.
- **Risk:** Leaked key grants full user permissions.
- **Solution:** Scope keys to specific permissions, add rotation UI, and store only hashes.
- **Priority:** Medium

---

## 6. UX / Design Principles Assessment

### 6.1 Nielsen's Heuristics

| Heuristic | Rating | Notes |
|---|---|---|
| Visibility of system status | Partial | Stock status hidden; wallet auto-applies silently; offline status not reflected in payment options. |
| Match between system and real world | Good | Product grid, cart, payment language are familiar. |
| User control and freedom | Partial | Clear cart lacks confirmation; dead "Custom Amount" button; wallet auto-applies. |
| Consistency and standards | Partial | Mobile/desktop duplicated layouts; permission model inconsistent. |
| Error prevention | Weak | Below-cost, out-of-stock, inactive, expired sales all possible. |
| Recognition rather than recall | Partial | Search works; held carts lack names/notes. |
| Flexibility and efficiency of use | Partial | Few shortcuts; no numeric keypad; slow bundle controls. |
| Aesthetic and minimalist design | Partial | Header overloaded; receipt hardcoded. |
| Help users recognize, diagnose, recover from errors | Partial | Errors shown but often after server round-trip. |
| Help and documentation | Partial | Docs exist but not embedded in UI. |

### 6.2 Accessibility

- No visible ARIA labels audit performed; keyboard shortcuts are minimal.
- Color alone may convey stock status; add text/icons.
- Touch targets below 44 dp in several places.
- **Priority:** Medium

### 6.3 Mobile-First Usability

- POS page is responsive but not truly mobile-first.
- Numeric inputs rely on native keyboards; no dedicated POS keypad.
- Category chips are too small.
- **Priority:** High

---

## 7. Recommended Redesigns

### 7.1 POS Architecture Redesign

1. **Split `app/pos/page.tsx`** into:
   - `PosShell` (layout, header, shortcuts)
   - `ProductBrowser` (search, categories, grid, scanner)
   - `CartPanel` (tabs, lines, totals, clear, hold)
   - `CheckoutPanel` (payment methods, split, change, complete)
   - `ReceiptPanel` (preview, print, reprint)
2. Use a single responsive layout, not two JSX trees.
3. Introduce a POS state machine: `BROWSING → CART → CHECKOUT → PAYING → COMPLETED → RECEIPT`.
4. Move business logic to hooks and API validation.

### 7.2 Validation Layer Redesign

1. **Server-side sale validator** that checks every line for:
   - Active item belonging to business
   - Price >= cost (unless authorized)
   - Quantity <= available stock (unless oversell authorized)
   - Batch valid and not expired
   - Discount within allowed limit
2. **Server-side supplier-bill validator** that checks:
   - Supplier exists and belongs to business
   - Invoice number unique
   - Line totals reconcile to `amount`
   - Stock totals reconcile to `amount`
   - Quantity > 0, cost > 0
   - Expiry >= received date
   - Batch number unique within business
3. Wrap all multi-step operations in transactions.

### 7.3 Permission Redesign

1. Remove dead `void_own_sale` or implement it.
2. Add new permissions:
   - `can_override_price`
   - `can_give_discount`
   - `process_refund`
   - `edit_completed_sale`
   - `record_supplier_bill`
   - `approve_supplier_bill`
3. Centralize all permission checks in `lib/auth/permissions.ts` and remove hardcoded role checks.
4. Protect `/pos` with `sell` permission in middleware.

### 7.4 Inventory & Batch Redesign

1. Add `supplier_bill_id` to `inventory_batches`.
2. Reconcile `items.current_stock` from batches or add a periodic sync job.
3. Add DB-level CHECK constraints for non-negative quantities.
4. Skip expired batches in FIFO.
5. Add stock adjustment rows for every receipt.

### 7.5 Audit Trail Redesign

1. Make `logActivity` transactional.
2. Log: sale create, sale void, supplier bill create/edit/cancel, stock adjustments, credit payments, user logins, price overrides.
3. Store `before`/`after` snapshots in JSON.
4. Add `updated_at`, `updated_by`, `cancelled_at`, `cancelled_by` to `supplier_bills`.

---

## 8. Quick Wins (Can be shipped this week)

1. Fix hardcoded receipt details — pull from business settings.
2. Add confirmation to clear cart in `CartView`.
3. Disable out-of-stock items in product grid by default.
4. Remove dead "Custom Amount" button or implement it.
5. Add `Ctrl+Enter` checkout shortcut.
6. Block manual price below cost server-side.
7. Require manager PIN for "Mark Paid" M-Pesa.
8. Validate cash received >= amount due client-side.
9. Add unique constraint on supplier invoice number.
10. Protect `/api/db/*` routes with superadmin auth.
11. Fix phone normalization in wallet form.
12. Show `can_give_credit` status in POS UI.

---

## 9. Long-Term Improvements (1–3 months)

1. Database transaction wrapper for all multi-step operations.
2. Optimistic concurrency control for stock, credit, and shifts.
3. Return / partial-refund module with permissions and credit notes.
4. Supplier bill redesign: structured line items, server reconciliation, batch/expiry persistence, cancel reversal.
5. Promotion engine with conflict detection.
6. Tax engine review and compliance enhancements.
7. Comprehensive audit log with before/after snapshots.
8. POS redesign into maintainable sub-components.
9. Mobile-first POS keypad and larger touch targets.
10. Inventory reconciliation job and batch-level stock takes.
11. Role-based UI hiding driven by API permissions, not client role strings.
12. External API key scoping and rotation.

---

## 10. Priority Summary

### Critical (fix immediately)

1. No DB transactions on sale/void/supplier-bill operations.
2. Cashier can sell below cost, inactive, out-of-stock, and expired products.
3. Supplier bill amount not reconciled with stock; no duplicate invoice detection.
4. Cancelled/edited supplier bills do not reverse inventory.
5. Unauthenticated database admin routes (`/api/db/*`, register, superadmin setup).
6. M-Pesa "Mark Paid" bypasses verification.
7. No return/partial-refund capability.
8. Concurrent sales can oversell same batch.
9. Negative cost/quantity allowed in supplier bills.
10. Permission bypass: cashier can create supplier bills and receive stock via API.

### High (next sprint)

1. Monolithic duplicated POS page.
2. Out-of-stock items remain clickable.
3. Cart stores stale prices/inactive items.
4. No price override / discount permissions.
5. Wallet auto-applies without confirmation.
6. Hardcoded receipt store details.
7. Data exposure to cashiers via open API routes.
8. Foreign keys not enforced per connection.
9. No `supplier_bill_id` link on batches.
10. `void_own_sale` dead code / no own-sale void.
11. Split payment lacks M-Pesa STK and wallet.
12. Manual suppliers fragment payables.

### Medium (next quarter)

1. Barcode scanner timing and camera controls.
2. Mobile category chips and touch targets.
3. Numeric keypad for quantity.
4. Cart names/notes.
5. Offline payment method disabling.
6. Packaging metadata persistence.
7. Audit logging for sale create/void.
8. Stock adjustment records for supplier receipts.
9. Tax/promotion engine.
10. Accessibility improvements.

### Low (polish)

1. Fuzzy barcode fallback.
2. Suggested cash denominations.
3. Dead code cleanup.
4. Help tooltips in POS.
5. Receipt auto-print delay tuning.

---

## 11. Conclusion

The POS has a strong feature set, but its architecture and validation layer need hardening before it can safely run in a multi-cashier, high-volume retail environment. The highest-return investments are:

1. **Transactional safety** — wrap every multi-step operation.
2. **Business-rule enforcement** — validate price, stock, expiry, and permissions server-side.
3. **Supplier bill integrity** — reconcile amount, lines, and stock; link batches to bills; reverse on cancel.
4. **Permission model cleanup** — add missing permissions, remove contradictions, protect routes.
5. **POS UX refactor** — split the monolith, improve mobile usability, and add shortcuts.

With these changes, the system can credibly compete with modern cloud POS products while remaining simple enough for an ordinary cashier to learn in under 30 minutes.

---

## 12. Implementation Phases (Remediation Tracker)

### Phase 1 — Security & Infrastructure ✅ (2026-06-15)

- Database `transaction()` helper and per-connection `PRAGMA foreign_keys = ON`
- Protect `/api/db/*`, `/api/auth/register`, `/api/superadmin/setup` with superadmin auth
- Expand permission model (`can_override_price`, `can_give_discount`, `record_supplier_bill`, etc.)
- Restrict sales API data exposure (cashiers: own sales only; hide buy price/profit)
- Vitest test harness and route-level auth tests

### Phase 2 — Sales Business Logic Validation ✅ (2026-06-15)

- **Server-side sale line validator** (`lib/validation/sale-lines.ts`): active items, stock, below-cost, expired batches
- **Manager PIN verification** (`/api/auth/verify-pin`) for M-Pesa manual mark-paid and oversell/below-cost overrides
- **FIFO skips expired batches** (`lib/utils/fifo.ts`)
- **Out-of-stock items disabled** in product grid (`ItemGrid.tsx`)
- **Add-to-cart quantity capped** to available stock (`AddToCartDialog.tsx`)
- **Cart clear confirmation** (`CartView.tsx`)
- **`void_own_sale` implemented** with required void reason (`app/api/sales/[id]/route.ts`)
- **Credit permission surfaced in POS** — credit payment disabled when `can_give_credit` is false (`CheckoutForm.tsx`, `/api/users/me`)
- **M-Pesa Mark Paid requires manager PIN** when STK was not verified
- **Receipt footer from business settings** — `settings.receipt.{tagline,website,phone,tillNumber}` (`Receipt.tsx`)

### Phase 3 — Supplier Bills & Inventory Integrity ✅ (2026-06-15)

- **Migration** — `supplier_invoice_no` on bills, `supplier_bill_id` on `inventory_batches`, partial unique index for duplicate invoices
- **Server-side bill validator** (`lib/validation/supplier-bill.ts`) — supplier master list required, amount/stock reconciliation, cost/qty/expiry/batch checks, duplicate invoice detection
- **Transactional bill creation** — `POST /api/supplier-bills` wrapped in `transaction()`; stock receipt writes batches, `stock_adjustments`, and `buying_prices`
- **Cancel reversal** — `DELETE /api/supplier-bills/[id]` reverses unreceived batch stock atomically; blocks cancel if stock was sold
- **Permission enforcement** — `record_supplier_bill` required for list/create/edit
- **Audit logging** — bill create, edit, and cancel logged with stock details

### Phase 4 — POS UX Refactor ✅ (2026-06-15)

- **Component extraction** — `PosTransactionDrawers`, `PosCategoryChips`, `PosClearCacheButton`, `PosNumericKeypad`; category maps moved to `lib/pos/category-maps.tsx`
- **Keyboard shortcuts** — `usePosKeyboardShortcuts`: Ctrl+K / `/` search, Escape close, Ctrl+Enter checkout, Ctrl+Shift+C clear cart, Ctrl+T new cart
- **Touch targets** — category chips and quick-add buttons min 44×44px; numeric keypad on mobile add-to-cart
- **Dead code removed** — unused Custom Amount button; clear-cache actions use confirmation dialog
- **Note** — `app/pos/page.tsx` still has parallel mobile/desktop layouts; full single-tree refactor deferred

### Phase 5 — Concurrency, Audit Trail & Checkout Hardening ✅ (2026-06-15)

- **Atomic stock deduction** — `lib/db/sale-stock.ts` with conditional batch/item updates; sale create wrapped in `transaction()`; 409 on stock conflict
- **Audit logging** — sale create and void logged; void uses transactional `logActivityInTransaction`
- **Stale cart price rejection** — `validateSaleLines` rejects lines where price ≠ `current_sell_price` without manager approval
- **Wallet UX** — selecting a customer no longer auto-applies max balance; user must enter amount or tap Max
- **Phone normalization** — `extractKenyaPhoneDigits` / `formatKenyaPhoneForLookup` used in wallet lookup
- **Stock adjust concurrency** — optimistic lock on `current_stock` prevents lost updates (409 on conflict)

### Phase 6 — Returns & Partial Refunds ✅ (2026-06-15)

- **Schema** — `sale_returns` and `sale_return_items` tables with migration
- **API** — `GET/POST /api/sales/[id]/returns` with `process_refund` permission
- **Business logic** — partial qty validation, stock/batch restoration, cash shift adjustment, wallet credit, credit-note debt reduction, proportional loyalty reversal
- **POS UI** — `PosReturnsDialog` + `RefundReceipt` (printable credit note); Returns button in POS header for owner/admin
- **Audit** — return create logged in activity trail
- **Admin** — `/admin/returns` list with date filter; sidebar under Analytics; filter Activity Log by “Sale Return”

---

*End of audit report.*
