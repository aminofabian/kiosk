import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/sales/[id]/route';

const queryOneMock = vi.fn();
const queryMock = vi.fn();
const resolveSaleIdMock = vi.fn();

vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
}));

vi.mock('@/lib/db/resolve-sale-id', () => ({
  resolveSaleId: (...args: unknown[]) => resolveSaleIdMock(...args),
  normalizeSaleIdInput: (s: string) => s.trim().replace(/^#+/, '').toLowerCase(),
}));

vi.mock('@/lib/auth/api-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/api-auth')>('@/lib/auth/api-auth');
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

import { requireAuth } from '@/lib/auth/api-auth';

function createParams(id: string) {
  return Promise.resolve({ id });
}

describe('/api/sales/[id]', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
    queryMock.mockReset();
    resolveSaleIdMock.mockReset();
    vi.mocked(requireAuth).mockReset();
    resolveSaleIdMock.mockResolvedValue({ ok: true, saleId: 'sale-1' });
  });

  it('should reject cashiers viewing another cashier sale', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'cashier-1', businessId: 'biz-1', role: 'cashier', email: '', name: '', isSuperAdmin: false });
    resolveSaleIdMock.mockResolvedValue({ ok: false, reason: 'not_found' });

    const response = await GET({} as never, { params: createParams('sale-1') });
    expect(response.status).toBe(404);
  });

  it('should allow owners to view any sale', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'owner-1', businessId: 'biz-1', role: 'owner', email: '', name: '', isSuperAdmin: false });
    resolveSaleIdMock.mockResolvedValue({ ok: true, saleId: 'sale-1' });
    queryOneMock.mockResolvedValue({ id: 'sale-1', total_amount: 100 });
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockResolvedValueOnce([]);

    const response = await GET({} as never, { params: createParams('sale-1') });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const [sql, params] = queryOneMock.mock.calls[0];
    expect(sql).not.toContain('AND s.user_id = ?');
    expect(params).not.toContain('owner-1');
  });

  it('should hide buy_price and profit from cashiers', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'cashier-1', businessId: 'biz-1', role: 'cashier', email: '', name: '', isSuperAdmin: false });
    queryOneMock.mockResolvedValue({ id: 'sale-1', total_amount: 100, user_id: 'cashier-1' });
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockResolvedValueOnce([]);

    const response = await GET({} as never, { params: createParams('sale-1') });
    expect(response.status).toBe(200);

    const [itemsSql] = queryMock.mock.calls[0];
    expect(itemsSql).not.toContain('si.buy_price_per_unit');
    expect(itemsSql).not.toContain('si.profit');
  });

  it('should include buy_price and profit for owners', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'owner-1', businessId: 'biz-1', role: 'owner', email: '', name: '', isSuperAdmin: false });
    queryOneMock.mockResolvedValue({ id: 'sale-1', total_amount: 100 });
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockResolvedValueOnce([]);

    const response = await GET({} as never, { params: createParams('sale-1') });
    expect(response.status).toBe(200);

    const [itemsSql] = queryMock.mock.calls[0];
    expect(itemsSql).toContain('si.buy_price_per_unit');
    expect(itemsSql).toContain('si.profit');
  });
});
