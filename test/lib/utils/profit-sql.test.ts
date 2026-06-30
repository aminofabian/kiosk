import { describe, it, expect } from 'vitest';
import {
  resolvedBuyPriceSql,
  saleLineCostSql,
  saleLineProfitSql,
  saleLineRevenueSql,
  isCappedBuyPriceSql,
  isZeroCostSql,
  RESOLVED_BUY_PRICE_PARAM_COUNT,
} from '@/lib/utils/profit-sql';

describe('profit-sql helpers', () => {
  it('resolvedBuyPriceSql contains fallback chain and outlier cap', () => {
    const sql = resolvedBuyPriceSql();
    expect(sql).toContain('si.buy_price_per_unit');
    expect(sql).toContain('inventory_batches');
    expect(sql).toContain('purchase_breakdowns');
    expect(sql).toContain('si.sell_price_per_unit * 0.85');
    expect(sql).toContain('> si.sell_price_per_unit');
  });

  it('exports the number of placeholders each helper injects', () => {
    expect(RESOLVED_BUY_PRICE_PARAM_COUNT).toBe(2);
  });

  it('saleLineCostSql multiplies quantity by resolved buy price', () => {
    const sql = saleLineCostSql();
    expect(sql).toContain('si.quantity_sold *');
    expect(sql).toContain('si.sell_price_per_unit * 0.85');
  });

  it('saleLineProfitSql computes revenue minus cost', () => {
    const sql = saleLineProfitSql();
    expect(sql).toContain('si.sell_price_per_unit -');
    expect(sql).toContain('si.sell_price_per_unit * 0.85');
  });

  it('saleLineRevenueSql is gross line revenue', () => {
    const sql = saleLineRevenueSql();
    expect(sql).toContain('si.quantity_sold * si.sell_price_per_unit');
  });

  it('isCappedBuyPriceSql returns a CASE expression', () => {
    const sql = isCappedBuyPriceSql();
    expect(sql).toContain('CASE WHEN');
    expect(sql).toContain('THEN 1 ELSE 0 END');
  });

  it('isZeroCostSql flags zero buy price', () => {
    const sql = isZeroCostSql();
    expect(sql).toContain("si.buy_price_per_unit = 0");
  });
});
