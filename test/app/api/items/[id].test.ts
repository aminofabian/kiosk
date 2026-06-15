import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/items/[id]/route';

const queryOneMock = vi.fn();
const queryMock = vi.fn();

vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
}));

vi.mock('@/lib/auth/api-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/api-auth')>('@/lib/auth/api-auth');
  return {
    ...actual,
    requireAuth: vi.fn(),
    requirePermission: vi.fn(),
  };
});

import { requireAuth } from '@/lib/auth/api-auth';

function createParams(id: string) {
  return Promise.resolve({ id });
}

describe('/api/items/[id]', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
    queryMock.mockReset();
    vi.mocked(requireAuth).mockReset();
  });

  it('should hide buy_price from cashiers', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'cashier-1', businessId: 'biz-1', role: 'cashier', email: '', name: '', isSuperAdmin: false });
    queryOneMock
      .mockResolvedValueOnce({ id: 'item-1', name: 'Milk', parent_item_id: null })
      .mockResolvedValueOnce({ buy_price_per_unit: 50 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce(null);

    const response = await GET({} as never, { params: createParams('item-1') });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.buy_price).toBeNull();
  });

  it('should show buy_price to owners', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'owner-1', businessId: 'biz-1', role: 'owner', email: '', name: '', isSuperAdmin: false });
    queryOneMock
      .mockResolvedValueOnce({ id: 'item-1', name: 'Milk', parent_item_id: null })
      .mockResolvedValueOnce({ buy_price_per_unit: 50 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce(null);

    const response = await GET({} as never, { params: createParams('item-1') });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.buy_price).toBe(50);
  });
});
