import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSaleLines } from '@/lib/validation/sale-lines';

const queryOneMock = vi.fn();

vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  // validateSaleLines batches item lookups via `query()` and expects an array of rows.
  // We reuse the existing queryOneMock and wrap its result into an array.
  query: (...args: unknown[]) =>
    queryOneMock(...args).then((row: unknown) => [row]),
}));

vi.mock('@/lib/auth/verify-manager-pin', () => ({
  verifyManagerPin: vi.fn(),
}));

import { verifyManagerPin } from '@/lib/auth/verify-manager-pin';

describe('validateSaleLines', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
    vi.mocked(verifyManagerPin).mockReset();
  });

  it('rejects inactive items', async () => {
    queryOneMock.mockResolvedValue({
      id: 'item-1',
      name: 'Milk',
      active: 0,
      current_stock: 10,
      current_sell_price: 50,
      buy_price: 30,
    });

    const result = await validateSaleLines({
      businessId: 'biz-1',
      role: 'cashier',
      lines: [{ itemId: 'item-1', quantity: 1, price: 50 }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('item_inactive');
  });

  it('allows selling below cost without manager authorization', async () => {
    queryOneMock.mockResolvedValue({
      id: 'item-1',
      name: 'Milk',
      active: 1,
      current_stock: 10,
      current_sell_price: 35,
    });

    const result = await validateSaleLines({
      businessId: 'biz-1',
      role: 'cashier',
      lines: [{ itemId: 'item-1', quantity: 1, price: 35 }],
    });

    expect(result.ok).toBe(true);
  });

  it('rejects overselling without manager PIN', async () => {
    queryOneMock.mockResolvedValue({
      id: 'item-1',
      name: 'Milk',
      active: 1,
      current_stock: 2,
      current_sell_price: 50,
      buy_price: 30,
    });

    const result = await validateSaleLines({
      businessId: 'biz-1',
      role: 'cashier',
      lines: [{ itemId: 'item-1', quantity: 5, price: 50 }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('insufficient_stock');
  });

  it('allows oversell when manager PIN verifies', async () => {
    queryOneMock.mockResolvedValue({
      id: 'item-1',
      name: 'Milk',
      active: 1,
      current_stock: 2,
      current_sell_price: 50,
      buy_price: 30,
    });
    vi.mocked(verifyManagerPin).mockResolvedValue({
      userId: 'admin-1',
      name: 'Admin',
      role: 'admin',
    });

    const result = await validateSaleLines({
      businessId: 'biz-1',
      role: 'cashier',
      lines: [{ itemId: 'item-1', quantity: 5, price: 50 }],
      managerPin: '1234',
    });

    expect(result.ok).toBe(true);
    expect(result.managerAuthorized).toBe(true);
  });

  it('allows oversell when business setting allowSellOutOfStock is enabled', async () => {
    queryOneMock.mockResolvedValue({
      id: 'item-1',
      name: 'Milk',
      active: 1,
      current_stock: 0,
      current_sell_price: 50,
      buy_price: 30,
    });

    const result = await validateSaleLines({
      businessId: 'biz-1',
      role: 'cashier',
      lines: [{ itemId: 'item-1', quantity: 2, price: 50 }],
      allowSellOutOfStock: true,
    });

    expect(result.ok).toBe(true);
    expect(result.allowNegativeStock).toBe(true);
  });

  it('rejects stale cart prices without manager authorization', async () => {
    queryOneMock.mockResolvedValue({
      id: 'item-1',
      name: 'Milk',
      active: 1,
      current_stock: 10,
      current_sell_price: 55,
      buy_price: 30,
    });

    const result = await validateSaleLines({
      businessId: 'biz-1',
      role: 'cashier',
      lines: [{ itemId: 'item-1', quantity: 1, price: 50 }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('stale_price');
  });
});
