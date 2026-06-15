import { describe, it, expect } from 'vitest';
import {
  salePaymentAmountSql,
  salesByPaymentMethodQuery,
} from '@/lib/utils/sales-payment-allocation';

describe('sales-payment-allocation', () => {
  it('allocates remainder to the primary payment method', () => {
    expect(salePaymentAmountSql('cash')).toContain("s.payment_method = 'cash'");
    expect(salePaymentAmountSql('wallet')).toContain("payment_method = 'wallet'");
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
