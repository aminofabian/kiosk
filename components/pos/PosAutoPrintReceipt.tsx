'use client';

import { useEffect, useRef } from 'react';
import { Receipt } from '@/components/pos/Receipt';
import type { ReceiptPayload } from '@/lib/pos/receipt-data';
import { printReceiptElement } from '@/lib/pos/print-receipt';

interface PosAutoPrintReceiptProps {
  payload: ReceiptPayload;
  onDone: () => void;
}

export function PosAutoPrintReceipt({ payload, onDone }: PosAutoPrintReceiptProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const saleId = String(payload.sale.id ?? '');

  useEffect(() => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDoneRef.current();
    };

    const renderTimer = setTimeout(() => {
      const handleAfterPrint = () => {
        window.removeEventListener('afterprint', handleAfterPrint);
        finish();
      };
      window.addEventListener('afterprint', handleAfterPrint);
      printReceiptElement();
      setTimeout(finish, 3000);
    }, 600);

    return () => {
      clearTimeout(renderTimer);
    };
  }, [saleId]);

  return (
    <div
      aria-hidden
      className="fixed -left-[9999px] top-0 w-[72mm] overflow-hidden pointer-events-none print:static print:left-0"
    >
      <Receipt
        sale={payload.sale}
        items={payload.items}
        splitPayments={payload.splitPayments}
        receiptSettings={payload.receiptSettings}
      />
    </div>
  );
}
