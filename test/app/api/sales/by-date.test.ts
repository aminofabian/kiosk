import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/sales/by-date/route';

const queryMock = vi.fn();

vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

vi.mock('@/lib/auth/api-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/api-auth')>('@/lib/auth/api-auth');
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

import { requireAuth } from '@/lib/auth/api-auth';

function createRequest(date: string) {
  return {
    nextUrl: new URL(`http://localhost/api/sales/by-date?date=${date}`),
  } as unknown as import('next/server').NextRequest;
}

describe('/api/sales/by-date', () => {
  beforeEach(() => {
    queryMock.mockReset();
    vi.mocked(requireAuth).mockReset();
  });

  it('should reject unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 401 }));

    const response = await GET(createRequest('2026-06-15'));
    expect(response.status).toBe(401);
  });

  it('should allow cashiers to view only their own sales', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'cashier-1', businessId: 'biz-1', role: 'cashier', email: '', name: '', isSuperAdmin: false });
    queryMock.mockResolvedValueOnce([]);

    const response = await GET(createRequest('2026-06-15'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain('AND s.user_id = ?');
    expect(params).toContain('cashier-1');
  });

  it('should allow owners to view all sales', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'owner-1', businessId: 'biz-1', role: 'owner', email: '', name: '', isSuperAdmin: false });
    queryMock.mockResolvedValueOnce([]);

    const response = await GET(createRequest('2026-06-15'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).not.toContain('AND s.user_id = ?');
    expect(params).not.toContain('owner-1');
  });
});
