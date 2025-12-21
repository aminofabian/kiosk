# Domain Resolution System

## Overview

The Kiosk platform uses **domain-based multi-tenancy** where each business is uniquely identified by its domain or subdomain. This ensures complete data isolation and prevents cross-business data leakage.

## Core Architecture

### Domain → Business ID Resolution

1. **Request arrives** with a domain (e.g., `biashara.co.ke`)
2. **Domain is normalized** (lowercased, port removed, localhost → default)
3. **Database lookup** resolves domain → Business ID
4. **All queries** are scoped to the resolved Business ID (never from user input)

### Key Files

- `lib/domain/resolve.ts` - Domain resolution logic
- `lib/domain/context.ts` - Server-side domain context utilities
- `lib/auth/domain-auth.ts` - Combined domain + auth verification
- `lib/db/sql/schema.sql` - Domains table schema
- `lib/db/migrate-domains.ts` - Migration script

## Database Schema

```sql
CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  business_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
```

## Usage in API Routes

### Option 1: Domain + Auth (Recommended)

Use when you need both domain resolution AND user authentication:

```typescript
import { requireDomainAuth, isAuthResponse } from '@/lib/auth/domain-auth';

export async function GET(request: NextRequest) {
  const auth = await requireDomainAuth();
  if (isAuthResponse(auth)) return auth;

  // auth.businessId is from domain resolution
  // auth.userId, auth.role, etc. from session
  // User is verified to belong to the domain's business

  const items = await query(
    `SELECT * FROM items WHERE business_id = ?`,
    [auth.businessId]
  );

  return jsonResponse({ success: true, data: items });
}
```

### Option 2: Domain Only (Public Routes)

Use for public routes that need business context but not auth:

```typescript
import { getBusinessIdFromDomain } from '@/lib/auth/domain-auth';

export async function GET(request: NextRequest) {
  const businessId = await getBusinessIdFromDomain();
  
  if (!businessId) {
    return jsonResponse(
      { success: false, message: 'Domain not found' },
      404
    );
  }

  // Use businessId for queries
}
```

### Option 3: Domain Context (Server Components)

Use in Server Components:

```typescript
import { getDomainContext } from '@/lib/domain/context';

export default async function Page() {
  const context = await getDomainContext();
  
  if ('error' in context) {
    return <div>Domain not found</div>;
  }

  // Use context.businessId, context.business, etc.
}
```

## Domain Management (Super Admin)

### API Endpoints

- `GET /api/domains?businessId=<id>` - List domains (optionally filtered by business)
- `POST /api/domains` - Create domain mapping
- `GET /api/domains/[id]` - Get domain details
- `PUT /api/domains/[id]` - Update domain (activate/suspend, set primary)
- `DELETE /api/domains/[id]` - Delete domain mapping

### Example: Creating Domain Mapping

```typescript
// Super admin only
POST /api/domains
{
  "domain": "biashara.co.ke",
  "businessId": "business-uuid",
  "isPrimary": true
}
```

## Default Domain

- **Default domain**: `kiosk.ke`
- **Localhost resolution**: `localhost`, `127.0.0.1` → `kiosk.ke`
- **Fallback behavior**: Unregistered domains fall back to default business

## Security Rules

1. **Business ID is NEVER from frontend** - Always resolved server-side from domain
2. **Domain resolution happens BEFORE auth** - Business context is established first
3. **All queries include business_id** - Every data access is scoped
4. **User verification** - When auth is required, user must belong to domain's business

## Migration from Session-Based Auth

### Before (Session-Based)

```typescript
const auth = await requireAuth();
// auth.businessId comes from session
```

### After (Domain-Based)

```typescript
const auth = await requireDomainAuth();
// auth.businessId comes from domain resolution
// Session is only used to verify user belongs to that business
```

## Edge Cases Handled

1. **Domain not registered** → Falls back to default business
2. **Domain suspended** → Returns 403 with error
3. **Business suspended** → Returns 403 with error
4. **User belongs to different business** → Returns 403
5. **Localhost/development** → Resolves to default domain
6. **Subdomains** → Treated as unique domains (e.g., `shop.kiosk.ke`)

## Next Steps

1. **Update existing API routes** to use `requireDomainAuth()` instead of `requireAuth()`
2. **Add domain management UI** to Super Admin business detail page
3. **Set default business** with domain `kiosk.ke` after migration
4. **Test domain resolution** with multiple businesses
5. **Update middleware** to handle domain errors gracefully
