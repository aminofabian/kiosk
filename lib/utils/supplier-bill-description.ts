export interface BillDescriptionLine {
  description: string;
  quantity: string | number;
  unitPrice: string | number;
}

/** Format line items into the bill_description string stored on supplier_bills. */
export function formatBillItemsDescription(items: BillDescriptionLine[]): string {
  const validItems = items.filter(
    (item) => String(item.description).trim() && item.quantity !== '' && item.quantity != null
  );
  if (validItems.length === 0) return '';

  const formatLine = (item: BillDescriptionLine) => {
    const qty = parseFloat(String(item.quantity) || '0');
    const unitPrice = parseFloat(String(item.unitPrice) || '0');
    const total = qty * unitPrice;
    return {
      qty,
      unitPrice,
      total,
      description: String(item.description).trim(),
    };
  };

  if (validItems.length === 1) {
    const { qty, unitPrice, total, description } = formatLine(validItems[0]);
    return `${description} (${qty} × KES ${unitPrice.toFixed(2)} = KES ${total.toFixed(2)})`;
  }

  return validItems
    .map((item, index) => {
      const { qty, unitPrice, total, description } = formatLine(item);
      return `${index + 1}. ${description} - ${qty} × KES ${unitPrice.toFixed(2)} = KES ${total.toFixed(2)}`;
    })
    .join('\n');
}

export function billDescriptionLineTotal(items: BillDescriptionLine[]): number {
  return items.reduce((sum, item) => {
    const qty = parseFloat(String(item.quantity) || '0');
    const unitPrice = parseFloat(String(item.unitPrice) || '0');
    if (isNaN(qty) || isNaN(unitPrice)) return sum;
    return sum + qty * unitPrice;
  }, 0);
}

export function toSupplierBillDateTimeLocal(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
