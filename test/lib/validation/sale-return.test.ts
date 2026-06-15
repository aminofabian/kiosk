import { describe, it, expect } from 'vitest';
import { validateSaleReturnRequest } from '@/lib/validation/sale-return';
import type { ReturnableSaleItem } from '@/lib/validation/sale-return';

const items: ReturnableSaleItem[] = [
  {
    id: 'si-1',
    item_id: 'item-1',
    item_name: 'Milk',
    quantity_sold: 2,
    quantity_returned: 0,
    quantity_returnable: 2,
    sell_price_per_unit: 50,
  },
  {
    id: 'si-2',
    item_id: 'item-2',
    item_name: 'Bread',
    quantity_sold: 1,
    quantity_returned: 1,
    quantity_returnable: 0,
    sell_price_per_unit: 30,
  },
];

describe('validateSaleReturnRequest', () => {
  it('requires a reason', () => {
    const result = validateSaleReturnRequest(
      { reason: '', refundMethod: 'cash', lines: [{ saleItemId: 'si-1', quantity: 1 }] },
      items
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('missing_reason');
    }
  });

  it('rejects returning more than returnable quantity', () => {
    const result = validateSaleReturnRequest(
      {
        reason: 'Damaged',
        refundMethod: 'cash',
        lines: [{ saleItemId: 'si-1', quantity: 5 }],
      },
      items
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('exceeds_returnable');
    }
  });

  it('accepts valid partial return', () => {
    const result = validateSaleReturnRequest(
      {
        reason: 'Changed mind',
        refundMethod: 'cash',
        lines: [{ saleItemId: 'si-1', quantity: 1 }],
      },
      items
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lines[0]?.refundAmount).toBe(50);
    }
  });

  it('requires credit account for wallet refunds', () => {
    const result = validateSaleReturnRequest(
      {
        reason: 'Exchange',
        refundMethod: 'wallet',
        lines: [{ saleItemId: 'si-1', quantity: 1 }],
      },
      items
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'missing_credit_account')).toBe(true);
    }
  });
});
