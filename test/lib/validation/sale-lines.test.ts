import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSaleLines } from '@/lib/validation/sale-lines';

const queryOneMock = vi.fn();

vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
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

  it('rejects below-cost sales without manager authorization', async () => {
    queryOneMock.mockResolvedValue({
      id: 'item-1',
      name: 'Milk',
      active: 1,
      current_stock: 10,
      current_sell_price: 35,
      buy_price: 40,
    });

    const result = await validateSaleLines({
      businessId: 'biz-1',
      role: 'cashier',
      lines: [{ itemId: 'item-1', quantity: 1, price: 35 }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('below_cost');
  });

  it('allows below-cost when owner has can_override_price', async () => {
    queryOneMock.mockResolvedValue({
      id: 'item-1',
      name: 'Milk',
      active: 1,
      current_stock: 10,
      current_sell_price: 50,
      buy_price: 40,
    });

    const result = await validateSaleLines({
      businessId: 'biz-1',
      role: 'owner',
      lines: [{ itemId: 'item-1', quantity: 1, price: 35 }],
    });

    expect(result.ok).toBe(true);
    expect(result.managerAuthorized).toBe(true);
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
