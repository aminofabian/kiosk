'use client';

interface RefundItem {
  item_name: string;
  quantity_returned: number;
  refund_amount: number;
  sell_price_per_unit: number;
}

interface RefundReceiptProps {
  businessName: string;
  originalSaleId: string;
  returnId: string;
  totalRefundAmount: number;
  refundMethod: string;
  reason: string;
  mpesaReference?: string | null;
  items: RefundItem[];
  saleDate: number;
  createdAt: number;
}

function refundMethodLabel(method: string): string {
  switch (method) {
    case 'cash':
      return 'CASH REFUND';
    case 'mpesa':
      return 'M-PESA REFUND';
    case 'wallet':
      return 'WALLET CREDIT';
    case 'credit_note':
      return 'CREDIT NOTE';
    default:
      return 'REFUND';
  }
}

export function RefundReceipt({
  businessName,
  originalSaleId,
  returnId,
  totalRefundAmount,
  refundMethod,
  reason,
  mpesaReference,
  items,
  saleDate,
  createdAt,
}: RefundReceiptProps) {
  const formatPrice = (n: number) => n.toFixed(0);
  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="refund-receipt max-w-md mx-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-6 font-mono text-sm">
      <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-600 pb-4 mb-4">
        <h2 className="text-lg font-bold tracking-wide">{businessName}</h2>
        <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
          {refundMethodLabel(refundMethod)}
        </p>
      </div>

      <div className="space-y-1 text-xs mb-4">
        <p>
          <span className="text-slate-500">Original sale:</span>{' '}
          {originalSaleId.slice(0, 8).toUpperCase()}
        </p>
        <p>
          <span className="text-slate-500">Return ref:</span>{' '}
          {returnId.slice(0, 8).toUpperCase()}
        </p>
        <p>
          <span className="text-slate-500">Sale date:</span> {formatDate(saleDate)}
        </p>
        <p>
          <span className="text-slate-500">Processed:</span> {formatDate(createdAt)}
        </p>
        {mpesaReference && (
          <p>
            <span className="text-slate-500">M-Pesa ref:</span> {mpesaReference}
          </p>
        )}
        <p>
          <span className="text-slate-500">Reason:</span> {reason}
        </p>
      </div>

      <table className="w-full text-xs mb-4">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-1">Item</th>
            <th className="text-right py-1">Qty</th>
            <th className="text-right py-1">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-1.5 pr-2">{item.item_name}</td>
              <td className="text-right py-1.5">{item.quantity_returned}</td>
              <td className="text-right py-1.5">KES {formatPrice(item.refund_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-slate-300 dark:border-slate-600 pt-3 text-center">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Total refunded</p>
        <p className="text-2xl font-bold text-[#1c6a1e]">
          KES {formatPrice(totalRefundAmount)}
        </p>
      </div>

      <p className="text-center text-[10px] text-slate-400 mt-6">
        Thank you — goods returned in acceptable condition
      </p>
    </div>
  );
}
