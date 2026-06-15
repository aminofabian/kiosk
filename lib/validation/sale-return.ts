export type RefundMethod = 'cash' | 'mpesa' | 'wallet' | 'credit_note';

export interface SaleReturnLineInput {
  saleItemId: string;
  quantity: number;
}

export interface ValidateSaleReturnInput {
  reason: string;
  refundMethod: RefundMethod;
  creditAccountId?: string;
  mpesaReference?: string;
  lines: SaleReturnLineInput[];
}

export interface ReturnableSaleItem {
  id: string;
  item_id: string;
  item_name: string;
  quantity_sold: number;
  quantity_returned: number;
  quantity_returnable: number;
  sell_price_per_unit: number;
}

export interface SaleReturnValidationError {
  code:
    | 'missing_reason'
    | 'missing_lines'
    | 'invalid_quantity'
    | 'exceeds_returnable'
    | 'unknown_sale_item'
    | 'missing_credit_account'
    | 'missing_mpesa_reference';
  message: string;
  saleItemId?: string;
}

export function validateSaleReturnRequest(
  input: ValidateSaleReturnInput,
  returnableItems: ReturnableSaleItem[]
): { ok: true; lines: { saleItemId: string; quantity: number; refundAmount: number }[] } | { ok: false; errors: SaleReturnValidationError[] } {
  const errors: SaleReturnValidationError[] = [];
  const reason = input.reason?.trim() ?? '';
  if (!reason) {
    errors.push({ code: 'missing_reason', message: 'A reason is required for returns' });
  }

  const validMethods: RefundMethod[] = ['cash', 'mpesa', 'wallet', 'credit_note'];
  if (!validMethods.includes(input.refundMethod)) {
    errors.push({ code: 'missing_reason', message: 'Invalid refund method' });
  }

  if (input.refundMethod === 'wallet' || input.refundMethod === 'credit_note') {
    if (!input.creditAccountId?.trim()) {
      errors.push({
        code: 'missing_credit_account',
        message: 'Select a customer account for wallet or credit-note refunds',
      });
    }
  }

  if (input.refundMethod === 'mpesa' && !input.mpesaReference?.trim()) {
    errors.push({
      code: 'missing_mpesa_reference',
      message: 'M-Pesa confirmation code or reference is required',
    });
  }

  const itemMap = new Map(returnableItems.map((i) => [i.id, i]));
  const validatedLines: { saleItemId: string; quantity: number; refundAmount: number }[] = [];

  for (const line of input.lines) {
    if (!line.saleItemId || line.quantity <= 0) continue;
    const item = itemMap.get(line.saleItemId);
    if (!item) {
      errors.push({
        code: 'unknown_sale_item',
        message: 'One or more items are not part of this sale',
        saleItemId: line.saleItemId,
      });
      continue;
    }
    if (line.quantity > item.quantity_returnable + 0.0001) {
      errors.push({
        code: 'exceeds_returnable',
        message: `Cannot return more than ${item.quantity_returnable} of "${item.item_name}"`,
        saleItemId: line.saleItemId,
      });
      continue;
    }
    const refundAmount = Math.round(line.quantity * item.sell_price_per_unit * 100) / 100;
    validatedLines.push({
      saleItemId: line.saleItemId,
      quantity: line.quantity,
      refundAmount,
    });
  }

  if (validatedLines.length === 0 && errors.length === 0) {
    errors.push({ code: 'missing_lines', message: 'Select at least one item to return' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, lines: validatedLines };
}
