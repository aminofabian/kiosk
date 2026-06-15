import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/activity-log/route';

const queryMock = vi.fn();

vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
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
  return new Request('http://localhost/api/activity-log');
}

describe('/api/activity-log', () => {
  beforeEach(() => {
    queryMock.mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it('should reject cashiers', async () => {
    vi.mocked(requirePermission).mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 403 }));

    const response = await GET(createRequest() as never);
    expect(response.status).toBe(403);
  });

  it('should allow owners', async () => {
    vi.mocked(requirePermission).mockResolvedValue({ userId: 'owner-1', businessId: 'biz-1', role: 'owner', email: '', name: '', isSuperAdmin: false });
    queryMock.mockResolvedValue([]);

    const response = await GET(createRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
