import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSupplierBillCreate } from '@/lib/validation/supplier-bill';

const queryOneMock = vi.fn();

vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
}));

describe('validateSupplierBillCreate', () => {
  const now = 1_700_000_000;

  beforeEach(() => {
    queryOneMock.mockReset();
  });

  it('requires supplier_id from master list', async () => {
    const result = await validateSupplierBillCreate({
      businessId: 'biz-1',
      supplierName: 'Acme',
      amount: 100,
      dueDateTimestamp: now + 86400,
      now,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_supplier_id')).toBe(true);
  });

  it('rejects amount mismatch with stock lines', async () => {
    queryOneMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM suppliers')) return { id: 'sup-1' };
      if (sql.includes('FROM items')) return { id: 'item-1', name: 'Milk' };
      return null;
    });

    const result = await validateSupplierBillCreate({
      businessId: 'biz-1',
      supplierId: 'sup-1',
      supplierName: 'Acme',
      amount: 100,
      dueDateTimestamp: now + 86400,
      stockItems: [{ itemId: 'item-1', quantity: 2, costPricePerUnit: 30 }],
      now,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'amount_mismatch')).toBe(true);
    expect(result.stockTotal).toBe(60);
  });

  it('accepts bill when amount matches stock total', async () => {
    queryOneMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM suppliers')) return { id: 'sup-1' };
      if (sql.includes('FROM items')) return { id: 'item-1', name: 'Milk' };
      return null;
    });

    const result = await validateSupplierBillCreate({
      businessId: 'biz-1',
      supplierId: 'sup-1',
      supplierName: 'Acme',
      amount: 60,
      dueDateTimestamp: now + 86400,
      stockItems: [{ itemId: 'item-1', quantity: 2, costPricePerUnit: 30 }],
      now,
    });

    expect(result.ok).toBe(true);
    expect(result.stockTotal).toBe(60);
  });

  it('detects duplicate supplier invoice numbers', async () => {
    queryOneMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM suppliers')) return { id: 'sup-1' };
      if (sql.includes('supplier_invoice_no')) return { id: 'bill-existing' };
      return null;
    });

    const result = await validateSupplierBillCreate({
      businessId: 'biz-1',
      supplierId: 'sup-1',
      supplierName: 'Acme',
      amount: 50,
      dueDateTimestamp: now + 86400,
      supplierInvoiceNo: 'INV-001',
      now,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'duplicate_invoice')).toBe(true);
  });

  it('rejects zero or negative cost on stock lines', async () => {
    queryOneMock.mockResolvedValue({ id: 'sup-1' });

    const result = await validateSupplierBillCreate({
      businessId: 'biz-1',
      supplierId: 'sup-1',
      supplierName: 'Acme',
      amount: 0,
      dueDateTimestamp: now + 86400,
      stockItems: [{ itemId: 'item-1', quantity: 1, costPricePerUnit: 0 }],
      now,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_cost')).toBe(true);
  });
});
