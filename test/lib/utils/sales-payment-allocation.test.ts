import { describe, it, expect } from 'vitest';
import {
  salePaidAmountSql,
  saleLineAllocatedRevenueSql,
  salesByPaymentMethodQuery,
} from '@/lib/utils/sales-payment-allocation';

describe('sales-payment-allocation', () => {
  it('scales line revenue to sale total_amount for departments', () => {
    const sql = saleLineAllocatedRevenueSql();
    expect(sql).toContain('si.quantity_sold * si.sell_price_per_unit');
    expect(sql).toContain('s.total_amount');
  });

  it('builds sale-level payment query without item type', () => {
    const sql = salesByPaymentMethodQuery('s.sale_date >= ?');
    expect(sql).toContain('FROM sales s');
    expect(sql).not.toContain('sale_items');
    expect(sql).toContain("'cash' AS payment_method");
    expect(sql).toContain('GROUP BY payment_method');
  });

  it('builds line-item payment query when item type is filtered', () => {
    const sql = salesByPaymentMethodQuery('s.sale_date >= ?', 'grocery');
    expect(sql).toContain('JOIN sale_items si');
    expect(sql).toContain("item_type_snapshot, 'retail') = ?");
  });
});
