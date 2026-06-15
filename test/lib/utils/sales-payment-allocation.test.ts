import { describe, it, expect } from 'vitest';
import { salePaymentShareSql, salesByPaymentMethodQuery } from '@/lib/utils/sales-payment-allocation';

describe('sales-payment-allocation', () => {
  it('builds share SQL for each payment method', () => {
    expect(salePaymentShareSql('cash')).toContain("s.payment_method = 'cash'");
    expect(salePaymentShareSql('mpesa')).toContain("s.payment_method = 'mpesa'");
    expect(salePaymentShareSql('wallet')).toContain("payment_method = 'wallet'");
  });

  it('builds a grouped payment query from line items', () => {
    const sql = salesByPaymentMethodQuery('s.sale_date >= ?');
    expect(sql).toContain('si.quantity_sold * si.sell_price_per_unit');
    expect(sql).toContain("'cash' AS payment_method");
    expect(sql).toContain("'wallet' AS payment_method");
    expect(sql).toContain('GROUP BY payment_method');
  });

  it('includes item type filter when provided', () => {
    const sql = salesByPaymentMethodQuery('s.sale_date >= ?', 'grocery');
    expect(sql).toContain("item_type_snapshot, 'retail') = ?");
  });
});
