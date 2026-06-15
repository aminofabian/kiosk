import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/sales/summary/route';

const queryOneMock = vi.fn();

vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
}));

vi.mock('@/lib/auth/api-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/api-auth')>('@/lib/auth/api-auth');
  return {
    ...actual,
    requirePermission: vi.fn(),
  };
});

import { requirePermission } from '@/lib/auth/api-auth';

function createRequest() {
  return new Request('http://localhost/api/sales/summary?start=0&end=9999999999');
}

describe('/api/sales/summary', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it('should reject cashiers', async () => {
    vi.mocked(requirePermission).mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 403 }));

    const response = await GET(createRequest() as never);
    expect(response.status).toBe(403);
  });

  it('should return summary for owners', async () => {
    vi.mocked(requirePermission).mockResolvedValue({ userId: 'owner-1', businessId: 'biz-1', role: 'owner', email: '', name: '', isSuperAdmin: false });
    queryOneMock.mockResolvedValue({ total_revenue: 1000, total_transactions: 5 });

    const response = await GET(createRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.totalRevenue).toBe(1000);
  });
});
