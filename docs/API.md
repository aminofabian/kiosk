# HTTP API (external integrations)

All routes live under **`/api`** on your deployed host (for local development, `http://localhost:3000/api/...`).

Responses are JSON unless noted. Many handlers return `{ success: boolean, ... }` and appropriate HTTP status codes (`401` unauthorized, `403` forbidden, `404`, `500`).

---

## Authentication

### 1. Browser / same-origin (NextAuth session)

The admin UI uses a **session cookie** from NextAuth. Same-origin `fetch` calls include the cookie automatically.

### 2. External clients (API keys)

For servers, scripts, or mobile backends **without** a session cookie:

1. Run database migrations so the `external_api_keys` table exists (see [Database migrations](#database-migrations)).
2. While logged in as an **owner**, create a key (browser session required once):

   - `POST /api/external-api-keys`  
     Optional JSON body: `{ "label": "Warehouse server", "userId": "<optional same-business user id>" }`  
     Defaults `userId` to you. The key inherits that user’s **role** and **permissions** for all other business APIs.

3. Send the secret on every request using **either**:

   - `Authorization: Bearer <token>`  
   - or `X-API-Key: <token>`

The plaintext token is returned **only once** in the create response. The server stores only a SHA-256 hash.

**Manage keys (owner only):**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/external-api-keys` | List keys (prefix, label, user, timestamps; never the secret). |
| `POST` | `/api/external-api-keys` | Create a key; response includes `token` once. |
| `DELETE` | `/api/external-api-keys/[id]` | Revoke a key (`active = 0`). |

### 3. Superadmin APIs

Routes under `/api/superadmin/...` (except documented public setup) expect a **superadmin NextAuth session**. External API keys are **business-scoped** and do **not** grant superadmin access.

---

## CORS (browser-based integrations)

By default, JSON responses do not add CORS headers. To allow a browser on another origin to call the API, set:

```bash
EXTERNAL_API_CORS_ORIGIN=https://your-integrations-app.example
# or, for public read-only experiments only:
# EXTERNAL_API_CORS_ORIGIN=*
```

When this variable is set, `jsonResponse` and `optionsResponse` add matching `Access-Control-*` headers. For a specific origin (not `*`), `Access-Control-Allow-Credentials: true` is set so you can combine with cookies if needed.

Allowed headers include: `Content-Type`, `Authorization`, `X-API-Key`.

---

## Database migrations

New installs pick up `external_api_keys` from `lib/db/sql/schema.sql`. Existing databases should run migrations (same process you already use), for example calling **`GET` or `POST` `/api/db/migrate`** in environments where that route is enabled, or your deployment’s migration command.

---

## Public and special routes (no business API key)

These are intended to be reachable without a tenant session (still use HTTPS in production). **Review each before exposing your deployment to the internet.**

| Area | Notes |
|------|--------|
| `/api/auth/*` | NextAuth and related auth flows. |
| `/api/auth/register`, forgot/reset password | Registration and password flows. |
| `/api/domain/resolve` | Resolves host / `?domain=` to business context. |
| `/api/public/credit-by-phone/...` | Public customer credit flows. |
| `/api/pesapal/callback` | Payment provider callback. |
| `/api/superadmin/setup` | One-time platform setup; protect at the network layer after use. |
| `/api/db/*` | **Dangerous** maintenance (migrate, seed, reset, etc.); restrict by deployment policy. |
| `GET /api/businesses/[id]` | Returns minimal business info (`id`, `name`) without auth today. |

---

## Authenticated business APIs

Any route that calls `requireAuth` / `requirePermission` / `requireRole` from `@/lib/auth/api-auth` (or `getSession()` from `@/lib/auth` for a few routes such as **`/api/users`**) accepts:

- session cookie, or  
- `Authorization: Bearer` / `X-API-Key` as above.

Authorization follows the **impersonated user’s role** (owner / admin / cashier) and your existing permission matrix.

Typical groups:

- **Items & catalog:** `/api/items`, `/api/items/[id]`, `/api/items/barcode/[code]`, `/api/categories`, `/api/aisles`, …
- **Sales:** `/api/sales`, `/api/sales/[id]`, `/api/sales/summary`, analytics routes, …
- **Stock:** `/api/stock`, `/api/stock/adjust`, `/api/stock/take`, approvals, …
- **Purchases & suppliers:** `/api/purchases`, `/api/suppliers`, `/api/supplier-bills`, …
- **Credits & balance:** `/api/credits`, …
- **Shifts & drawers:** `/api/shifts`, …
- **Reports & profit:** `/api/reports/*`, `/api/profit`, …
- **Settings & domains:** `/api/settings`, `/api/domains`, …
- **POS:** `/api/pos/insights`, `/api/dashboard`, …

Exact HTTP methods and bodies are defined in each `app/api/**/route.ts` file (exported `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`).

---

## Route index (App Router)

Each line is the path segment after `/api/`. The full URL is `https://<host>/api/<segment>` with dynamic parts such as `[id]` replaced by real IDs.

| Path segment |
|--------------|
| `activity-log` |
| `aisles` |
| `aisles/[id]` |
| `analytics/customers` |
| `auth/[...nextauth]` |
| `auth/forgot-password` |
| `auth/register` |
| `auth/reset-password` |
| `auth/test-email` |
| `balance/approvals` |
| `balance/approvals/[id]/approve` |
| `balance/approvals/[id]/reject` |
| `batches` |
| `batches/[id]` |
| `batches/expiring` |
| `batches/next` |
| `batches/preview` |
| `businesses/[id]` |
| `businesses/[id]/banners` |
| `businesses/[id]/banners/[bannerId]` |
| `categories` |
| `categories/[id]` |
| `categories/merge` |
| `categories/purge-inactive` |
| `credits` |
| `credits/[id]` |
| `credits/[id]/payment` |
| `credits/[id]/transfer-recorder` |
| `credits/claims/[transactionId]` |
| `credits/merge` |
| `credits/pending-claims` |
| `credits/transfer-users` |
| `credits/wallet-claims/[transactionId]` |
| `dashboard` |
| `db/migrate` |
| `db/migrate-inventory-batches` |
| `db/migrate-stock-adjustments` |
| `db/migrate-variants` |
| `db/reset` |
| `db/seed` |
| `db/test` |
| `domain/resolve` |
| `domains` |
| `domains/[id]` |
| `expenses` |
| `expenses/[id]` |
| `expenses/daily-cost` |
| `external-api-keys` |
| `external-api-keys/[id]` |
| `items` |
| `items/[id]` |
| `items/[id]/aisle` |
| `items/[id]/barcode` |
| `items/[id]/batches` |
| `items/[id]/cost-history` |
| `items/[id]/price` |
| `items/[id]/prices` |
| `items/[id]/supplier-costs` |
| `items/[id]/type` |
| `items/[id]/unit` |
| `items/barcode/[code]` |
| `items/suggest` |
| `out-of-stock-requests` |
| `pesapal/callback` |
| `pesapal/register-ipn` |
| `pesapal/status/[orderId]` |
| `pesapal/stk-push` |
| `pos/insights` |
| `profit` |
| `profit/batches` |
| `profit/daily` |
| `public/credit-by-phone/[slug]` |
| `public/credit-by-phone/[slug]/payment` |
| `public/credit-by-phone/[slug]/stk-push` |
| `public/credit-by-phone/[slug]/stk-status/[orderId]` |
| `public/credit-by-phone/[slug]/wallet-claim` |
| `public/credit-by-phone/[slug]/wallet-topup/stk-push` |
| `purchases` |
| `purchases/[id]` |
| `purchases/[id]/breakdown` |
| `reports/ai-insights` |
| `reports/daily-summary` |
| `reports/profit` |
| `reports/sales` |
| `reports/supplier-price-comparison` |
| `sales` |
| `sales/[id]` |
| `sales/analytics` |
| `sales/analytics/daily` |
| `sales/by-date` |
| `sales/latest` |
| `sales/summary` |
| `settings` |
| `shifts` |
| `shifts/[id]` |
| `shifts/[id]/close` |
| `shifts/[id]/summary` |
| `shifts/current` |
| `shifts/drawers` |
| `shifts/last-closed` |
| `stock` |
| `stock/adjust` |
| `stock/analysis` |
| `stock/approvals` |
| `stock/approvals/[id]/approve` |
| `stock/approvals/[id]/reject` |
| `stock/take` |
| `superadmin/admins` |
| `superadmin/admins/[id]` |
| `superadmin/businesses` |
| `superadmin/businesses/[id]` |
| `superadmin/settings` |
| `superadmin/setup` |
| `superadmin/stats` |
| `supplier-bills` |
| `supplier-bills/[id]` |
| `supplier-bills/[id]/pay` |
| `supplier-bills/by-day-of-week` |
| `supplier-bills/notifications` |
| `suppliers` |
| `suppliers/[id]` |
| `suppliers/[id]/products` |
| `users` |
| `users/[id]` |

---

## Implementation references

- Session + API key resolution: `lib/auth/session-resolve.ts`, `lib/auth/external-api-key.ts`, `lib/auth/api-auth.ts`
- Middleware no longer gates `/api` (auth runs in handlers): `middleware.ts`
- CORS helper: `lib/utils/api-response.ts`
