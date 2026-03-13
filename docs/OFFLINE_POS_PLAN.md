# Offline POS Plan: Search, Cart, Cash & M-Pesa

## Goal

Enable cashiers to complete a full sale when offline:
1. **Search** for products
2. **Add to cart**
3. **Complete sale** (cash or M-Pesa)

---

## Current State

| Feature | Online | Offline | Notes |
|---------|--------|---------|-------|
| Categories | ✅ | ✅ | Cached via `apiGetOffline` |
| Items by category | ✅ | ✅ | Cached |
| Barcode scan | ✅ | ✅ | Cached |
| **Product search** | ✅ | ✅ | `searchItemsOffline` over cached items |
| Add to cart | ✅ | ✅ | Cart in `localStorage` |
| Cash checkout | ✅ | ✅ | Queued, syncs when online |
| M-Pesa Mark as Paid | ✅ | ✅ | Queued, syncs when online |

---

## M-Pesa Offline: The Constraint

**M-Pesa cannot work when fully offline.**

| Step | Requires |
|------|----------|
| Initiate STK push | Network → Pesapal API |
| Customer receives prompt | Network on customer's phone |
| Payment confirmation | Network → Poll status |

**Options:**

| Option | Description | Recommendation |
|--------|-------------|-----------------|
| **A. Cash only offline** | M-Pesa disabled when offline | ✅ **Recommended** — simple, no risk |
| **B. "Mark as M-Pesa"** | Record sale as M-Pesa offline; customer pays when they have signal | ⚠️ Complex — requires reconciliation, risk of non-payment |
| **C. Defer M-Pesa** | Show "M-Pesa requires connection"; complete sale when back online | Same as A for UX |

**Recommendation:** Keep **cash only** when offline. When connection returns, M-Pesa works again. This matches how most POS systems handle mobile money.

---

## Gap: Product Search Offline

**Problem:** Search uses `/api/items/suggest`, which is not in the offline cache.

**Solution:** Client-side search over cached items when offline.

### Implementation

1. **Add `searchItemsOffline(query: string)`** in `lib/offline/`:
   - Read all cached items (from `items:category:*` or a dedicated `items:all` store)
   - Filter by `name`, `variant_name`, `barcode` (case-insensitive, contains)
   - Return top 10 matches in suggest format

2. **Update POS search flow** in `app/pos/page.tsx`:
   - When online: keep current `/api/items/suggest` flow
   - When offline: call `searchItemsOffline(query)` instead of fetch
   - Reuse same suggestion UI and selection flow

3. **Cache structure:** `preloadOfflineData` already stores all items by category. We need either:
   - Iterate all `items:category:*` keys (requires listing keys in IndexedDB), or
   - Add `items:all` — store flat list of all items during preload for fast search

---

## Implementation Checklist

### Phase 1: Offline Search (blocks full offline flow)

- [x] Add `items:all` cache key — store all items during `preloadOfflineData`
- [x] Add `searchItemsOffline(query, limit)` in `lib/offline/search.ts`
- [x] Update POS search `useEffect` to use offline search when `!navigator.onLine`
- [x] Ensure barcode-like input still uses barcode lookup (already works)

### Phase 2: M-Pesa UX

- [ ] Keep M-Pesa disabled when offline (current behavior)
- [ ] Show clear message: "M-Pesa requires connection. Use Cash for offline sales."
- [ ] Optional: Add "Sync for offline" reminder when going offline with no cache

### Phase 3: End-to-end verification

- [ ] Test: Go online → Sync for offline → Go offline
- [ ] Test: Search product by name → Add to cart → Cash checkout → Receipt
- [ ] Test: Barcode scan → Add to cart → Cash checkout
- [ ] Test: Category browse → Add items → Cash checkout

---

## Data Flow (Offline)

```
┌─────────────────────────────────────────────────────────────────┐
│                        OFFLINE FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Search:  query → searchItemsOffline() → IndexedDB (cached)   │
│  2. Select:  itemId → getItemById() → IndexedDB                  │
│  3. Cart:    add/update → localStorage (Zustand persist)          │
│  4. Checkout: cash only → addPendingSale() → IndexedDB queue     │
│  5. Receipt: local-xxx → getPendingSaleById() → render           │
│  6. Sync:    online event → syncPendingSales() → POST /api/sales │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `lib/offline/search.ts` — `searchItemsOffline(query, limit)` |
| Modify | `lib/offline/cache.ts` — add `items:all` get/set |
| Modify | `lib/offline/sync.ts` — store `items:all` in preload |
| Modify | `app/pos/page.tsx` — use offline search when offline |

---

## Summary

| Feature | After implementation |
|---------|----------------------|
| Search product | ✅ Works offline (client-side over cached items) |
| Add to cart | ✅ Already works |
| Cash sale | ✅ Already works |
| M-Pesa sale | ❌ Requires connection (by design) |
