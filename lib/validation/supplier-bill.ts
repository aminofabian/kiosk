import { queryOne } from '@/lib/db';

const EPS = 0.01;
const MAX_FUTURE_YEARS = 10;
const MAX_DUE_YEARS_AHEAD = 5;

export interface SupplierBillStockItem {
  itemId: string;
  quantity: number;
  costPricePerUnit: number;
  batchNumber?: string;
  expiryDate?: number;
}

export interface ValidateSupplierBillInput {
  businessId: string;
  supplierId?: string | null;
  supplierName: string;
  amount: number;
  dueDateTimestamp: number;
  supplierInvoiceNo?: string | null;
  stockItems?: SupplierBillStockItem[];
  now?: number;
  excludeBillId?: string;
}

export interface SupplierBillValidationError {
  code: string;
  message: string;
}

export interface ValidateSupplierBillResult {
  ok: boolean;
  errors: SupplierBillValidationError[];
  stockTotal: number;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function validateSupplierBillCreate(
  input: ValidateSupplierBillInput
): Promise<ValidateSupplierBillResult> {
  const errors: SupplierBillValidationError[] = [];
  const now = input.now ?? Math.floor(Date.now() / 1000);

  const supplierName = input.supplierName?.trim();
  if (!supplierName) {
    errors.push({ code: 'missing_supplier', message: 'Supplier name is required' });
  }

  if (!input.supplierId) {
    errors.push({
      code: 'missing_supplier_id',
      message: 'Select a supplier from the master list (supplier_id is required)',
    });
  } else {
    const supplier = await queryOne<{ id: string }>(
      `SELECT id FROM suppliers WHERE id = ? AND business_id = ? AND active = 1`,
      [input.supplierId, input.businessId]
    );
    if (!supplier) {
      errors.push({
        code: 'invalid_supplier',
        message: 'Supplier not found or inactive for this business',
      });
    }
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    errors.push({ code: 'invalid_amount', message: 'Amount must be greater than 0' });
  }

  if (!Number.isFinite(input.dueDateTimestamp)) {
    errors.push({ code: 'invalid_due_date', message: 'Due date is invalid' });
  } else {
    const maxDue = now + MAX_DUE_YEARS_AHEAD * 365 * 24 * 3600;
    if (input.dueDateTimestamp > maxDue) {
      errors.push({
        code: 'due_date_too_far',
        message: `Due date cannot be more than ${MAX_DUE_YEARS_AHEAD} years in the future`,
      });
    }
  }

  const invoiceNo = input.supplierInvoiceNo?.trim();
  if (invoiceNo && input.supplierId) {
    const dup = await queryOne<{ id: string }>(
      `SELECT id FROM supplier_bills
       WHERE business_id = ? AND supplier_id = ? AND supplier_invoice_no = ?
       AND status != 'cancelled'
       ${input.excludeBillId ? 'AND id != ?' : ''}
       LIMIT 1`,
      input.excludeBillId
        ? [input.businessId, input.supplierId, invoiceNo, input.excludeBillId]
        : [input.businessId, input.supplierId, invoiceNo]
    );
    if (dup) {
      errors.push({
        code: 'duplicate_invoice',
        message: `Invoice number "${invoiceNo}" already exists for this supplier`,
      });
    }
  }

  let stockTotal = 0;
  const stockItems = input.stockItems ?? [];
  const seenBatchNumbers = new Set<string>();

  for (const line of stockItems) {
    if (!line.itemId) {
      errors.push({ code: 'invalid_stock_line', message: 'Stock line missing itemId' });
      continue;
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      errors.push({
        code: 'invalid_quantity',
        message: `Quantity must be greater than 0 for item ${line.itemId}`,
      });
      continue;
    }
    if (!Number.isFinite(line.costPricePerUnit) || line.costPricePerUnit <= 0) {
      errors.push({
        code: 'invalid_cost',
        message: `Cost per unit must be greater than 0 for item ${line.itemId}`,
      });
      continue;
    }

    const item = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM items WHERE id = ? AND business_id = ? AND active = 1`,
      [line.itemId, input.businessId]
    );
    if (!item) {
      errors.push({
        code: 'invalid_item',
        message: `Product not found or inactive: ${line.itemId}`,
      });
      continue;
    }

    if (line.expiryDate != null) {
      if (line.expiryDate < now) {
        errors.push({
          code: 'expiry_in_past',
          message: `Expiry date for "${item.name}" cannot be in the past`,
        });
      }
      const maxExpiry = now + MAX_FUTURE_YEARS * 365 * 24 * 3600;
      if (line.expiryDate > maxExpiry) {
        errors.push({
          code: 'expiry_too_far',
          message: `Expiry date for "${item.name}" is unreasonably far in the future`,
        });
      }
    }

    const batchNo = line.batchNumber?.trim();
    if (batchNo) {
      const key = batchNo.toLowerCase();
      if (seenBatchNumbers.has(key)) {
        errors.push({
          code: 'duplicate_batch_in_request',
          message: `Duplicate batch number "${batchNo}" in this bill`,
        });
      }
      seenBatchNumbers.add(key);

      const existingBatch = await queryOne<{ id: string }>(
        `SELECT id FROM inventory_batches
         WHERE business_id = ? AND batch_number = ? AND status != 'deactivated'
         LIMIT 1`,
        [input.businessId, batchNo]
      );
      if (existingBatch) {
        errors.push({
          code: 'duplicate_batch',
          message: `Batch number "${batchNo}" already exists`,
        });
      }
    }

    stockTotal += line.quantity * line.costPricePerUnit;
  }

  stockTotal = roundMoney(stockTotal);

  if (stockItems.length > 0) {
    if (Math.abs(stockTotal - input.amount) > EPS) {
      errors.push({
        code: 'amount_mismatch',
        message: `Bill amount (KES ${input.amount.toFixed(2)}) does not match stock total (KES ${stockTotal.toFixed(2)})`,
      });
    }
  }

  return { ok: errors.length === 0, errors, stockTotal };
}
