import type { Item } from '@/lib/db/types';
import { formatSellableItemName } from '@/lib/utils/group-items-by-parent';
import { isDiscreteUnitType } from '@/lib/constants';
import type { StockReorderListRow } from '@/lib/department/stock-reorder-list';

const UNIT_LABELS: Record<string, string> = {
  kg: 'kg',
  g: 'g',
  piece: 'pcs',
  bunch: 'bunches',
  tray: 'trays',
  litre: 'L',
  ml: 'ml',
};

function formatQty(value: number, unitType: Item['unit_type']): string {
  const n = isDiscreteUnitType(unitType)
    ? Math.round(value).toString()
    : value.toFixed(2).replace(/\.?0+$/, '');
  const u = UNIT_LABELS[unitType] || unitType;
  return `${n} ${u}`;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export interface StockReorderListPdfOptions {
  businessName?: string;
  departmentLabel?: string;
  periodLabel: string;
  saveFileName: string;
  rows: StockReorderListRow[];
}

export async function downloadStockReorderListPdf(
  opts: StockReorderListPdfOptions,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 9;
  const contentW = pageW - margin * 2;
  const footerH = 9;

  const palette = {
    accent: [22, 163, 74] as const,
    ink: [15, 23, 42] as const,
    muted: [100, 116, 139] as const,
    headerBg: [241, 245, 249] as const,
    headerInk: [51, 65, 85] as const,
    border: [226, 232, 240] as const,
    zebra: [248, 250, 252] as const,
    outBg: [254, 242, 242] as const,
    lowBg: [255, 251, 235] as const,
  };

  const rowH = 9;
  const headerH = 8;
  const headerBlockH = 22;
  const colNumCx = margin + 5;
  const colOrderR = pageW - margin - 4;
  const colOrderW = 18;
  const colOrderL = colOrderR - colOrderW;
  const colSuggestR = colOrderL - 3;
  const colSoldR = colSuggestR - 22;
  const colStockR = colSoldR - 18;
  const colStatusR = colStockR - 14;
  const colNameL = margin + 11;
  const colNameMaxW = Math.max(35, colStatusR - colNameL - 4);

  const truncate = (text: string, maxW: number, fontSize = 9) => {
    let s = text;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    while (s.length > 1 && doc.getTextWidth(s) > maxW) {
      s = s.length > 4 ? `${s.slice(0, -4)}…` : '…';
    }
    return s;
  };

  const rowBaseline = (rowY: number) => rowY + rowH * 0.55;

  const drawPageHeader = (yy: number) => {
    doc.setFillColor(...palette.accent);
    doc.rect(margin, yy, 3, headerBlockH, 'F');

    doc.setTextColor(...palette.ink);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('Stock reorder list', margin + 7, yy + 6);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...palette.muted);
    const subtitle = [
      opts.businessName,
      opts.departmentLabel,
      'Low / out · sold in past 7 days',
    ]
      .filter(Boolean)
      .join(' · ');
    doc.text(subtitle, margin + 7, yy + 11.5);

    const printed = new Date().toLocaleString('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    doc.setFontSize(8);
    doc.text(printed, pageW - margin, yy + 5.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...palette.accent);
    doc.text(opts.periodLabel, pageW - margin, yy + 11.5, { align: 'right' });

    return yy + headerBlockH + 3;
  };

  const drawTableHeader = (yy: number) => {
    doc.setFillColor(...palette.headerBg);
    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.25);
    doc.rect(margin, yy, contentW, headerH, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...palette.headerInk);
    const hy = yy + 5.2;
    doc.text('#', colNumCx, hy, { align: 'center' });
    doc.text('Product', colNameL, hy);
    doc.text('St', colStatusR, hy, { align: 'right' });
    doc.text('Stock', colStockR, hy, { align: 'right' });
    doc.text('Sold 7d', colSoldR, hy, { align: 'right' });
    doc.text('Suggest', colSuggestR, hy, { align: 'right' });
    doc.text('Order', colOrderL + colOrderW / 2, hy, { align: 'center' });

    return yy + headerH;
  };

  let y = drawPageHeader(margin);
  y = drawTableHeader(y);

  if (opts.rows.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...palette.muted);
    doc.text('No products match: low/out of stock and sold in the past week.', margin, y + 8);
  }

  opts.rows.forEach((row, idx) => {
    if (y + rowH > pageH - margin - footerH) {
      doc.addPage();
      y = drawPageHeader(margin);
      y = drawTableHeader(y);
    }

    if (row.stock_status === 'out') {
      doc.setFillColor(...palette.outBg);
      doc.rect(margin, y, contentW, rowH, 'F');
    } else if (idx % 2 === 1) {
      doc.setFillColor(...palette.zebra);
      doc.rect(margin, y, contentW, rowH, 'F');
    }

    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.1);
    doc.line(margin, y + rowH, pageW - margin, y + rowH);

    const name = formatSellableItemName({
      id: row.item_id,
      name: row.item_name,
      variant_name: row.variant_name,
      parent_name: row.parent_name,
      parent_item_id: row.parent_item_id,
    } as Item & { parent_name?: string | null });
    const by = rowBaseline(y);
    const barcodeRaw = (row.barcode ?? '').trim();

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...palette.ink);
    doc.text(String(idx + 1), colNumCx, by, { align: 'center' });
    doc.text(truncate(name, colNameMaxW), colNameL, y + 3.1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(row.stock_status === 'out' ? 185 : 180, row.stock_status === 'out' ? 28 : 83, row.stock_status === 'out' ? 28 : 9);
    doc.text(row.stock_status === 'out' ? 'OUT' : 'LOW', colStatusR, by, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...palette.ink);
    doc.text(formatQty(row.current_stock, row.unit_type as Item['unit_type']), colStockR, by, { align: 'right' });
    doc.text(formatNumber(row.quantity_sold_7d), colSoldR, by, { align: 'right' });
    doc.text(
      row.suggested_order_qty > 0
        ? formatNumber(row.suggested_order_qty)
        : '—',
      colSuggestR,
      by,
      { align: 'right' },
    );

    if (barcodeRaw) {
      doc.setTextColor(...palette.muted);
      doc.setFontSize(6.5);
      doc.setFont('courier', 'normal');
      doc.text(truncate(barcodeRaw, colNameMaxW, 6.5), colNameL, y + 6.5);
    }

    const fieldH = 5;
    const fieldY = y + (rowH - fieldH) / 2;
    doc.setDrawColor(...palette.muted);
    doc.setLineWidth(0.35);
    doc.roundedRect(colOrderL, fieldY, colOrderW, fieldH, 0.5, 0.5, 'S');

    y += rowH;
  });

  doc.setDrawColor(...palette.border);
  doc.setLineWidth(0.25);
  doc.line(margin, y, pageW - margin, y);

  y += 4;
  const summaryH = 9;
  if (y + summaryH > pageH - margin - footerH) {
    doc.addPage();
    y = drawPageHeader(margin);
  }

  doc.setFillColor(...palette.headerBg);
  doc.setDrawColor(...palette.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentW, summaryH, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...palette.headerInk);
  doc.text(
    `Total: ${opts.rows.length} product${opts.rows.length === 1 ? '' : 's'} to reorder`,
    margin + 4,
    y + 6.2,
  );

  y += summaryH + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...palette.muted);
  const note =
    'Products are low or out of stock and had sales in the past 7 days. Write order quantities in the Order column. Suggest uses expected stock minus current when below minimum.';
  const noteLines = doc.splitTextToSize(note, contentW);
  if (y + noteLines.length * 3.9 > pageH - margin - footerH) {
    doc.addPage();
    y = drawPageHeader(margin);
  }
  doc.text(noteLines, margin, y + 4);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...palette.muted);
    doc.text(`Page ${i} of ${totalPages}`, pageW / 2, pageH - 6.5, { align: 'center' });
  }

  doc.save(opts.saveFileName.endsWith('.pdf') ? opts.saveFileName : `${opts.saveFileName}.pdf`);
}
