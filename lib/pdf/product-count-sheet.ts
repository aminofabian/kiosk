import { getItemDisplayName } from '@/lib/utils';

export interface ProductCountSheetRow {
  displayName: string;
  barcode: string | null;
  priceLabel: string;
}

export interface ProductCountSheetPdfOptions {
  headline: string;
  subtitleLine: string;
  periodLine: string;
  priceColumnHeader: string;
  footnote: string;
  saveFileName: string;
  rows: ProductCountSheetRow[];
}

/**
 * Portrait A4 count sheet: product, price column, blank qty box, optional barcode under name.
 * Used by sales “blank qty” export and category inventory sheets.
 */
export async function downloadProductCountSheetPdf(
  opts: ProductCountSheetPdfOptions
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  const footerH = 14;

  const palette = {
    accent: [22, 163, 74] as const,
    ink: [15, 23, 42] as const,
    muted: [100, 116, 139] as const,
    headerBg: [241, 245, 249] as const,
    headerInk: [51, 65, 85] as const,
    border: [226, 232, 240] as const,
    zebra: [248, 250, 252] as const,
  };

  const rowH = 12;
  const headerH = 11;
  const headerBlockH = 26;
  const colQtyBoxR = pageW - margin - 6;
  const colQtyBoxW = 26;
  const colQtyBoxL = colQtyBoxR - colQtyBoxW;
  const colPriceR = colQtyBoxL - 5;
  const colNameL = margin + 14;
  const colAvgColumnW = 36;
  const colNameMaxW = Math.max(42, colPriceR - colNameL - colAvgColumnW - 4);
  const colNumCx = margin + 7;
  const qtyFieldH = 6.5;

  const truncateName = (t: string) => {
    let s = t;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    while (s.length > 1 && doc.getTextWidth(s) > colNameMaxW) {
      s = s.length > 4 ? `${s.slice(0, -4)}…` : '…';
    }
    return s;
  };

  const truncateBarcode = (t: string) => {
    let s = t;
    doc.setFontSize(7.5);
    doc.setFont('courier', 'normal');
    while (s.length > 1 && doc.getTextWidth(s) > colNameMaxW) {
      s = s.length > 5 ? `${s.slice(0, -4)}…` : '…';
    }
    return s;
  };

  const rowBaseline = (rowY: number) => rowY + rowH * 0.62;

  const drawPageHeader = (yy: number) => {
    doc.setFillColor(...palette.accent);
    doc.rect(margin, yy, 3.5, headerBlockH, 'F');

    doc.setTextColor(...palette.ink);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(opts.headline, margin + 8, yy + 8);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...palette.muted);
    doc.text(opts.subtitleLine, margin + 8, yy + 15);

    const printed = new Date().toLocaleString('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    doc.setFontSize(9);
    doc.text(printed, pageW - margin, yy + 7, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...palette.accent);
    doc.text(opts.periodLine, pageW - margin, yy + 15, { align: 'right' });

    doc.setTextColor(...palette.ink);
    return yy + headerBlockH + 5;
  };

  const drawTableHeader = (yy: number) => {
    doc.setFillColor(...palette.headerBg);
    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.25);
    doc.rect(margin, yy, contentW, headerH, 'FD');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...palette.headerInk);
    const hy = yy + 7.5;
    doc.text('#', colNumCx, hy, { align: 'center' });
    doc.text('Product', colNameL, hy);
    doc.text(opts.priceColumnHeader, colPriceR, hy, { align: 'right' });
    doc.text('Qty', colQtyBoxL + colQtyBoxW / 2, hy, { align: 'center' });

    return yy + headerH;
  };

  let y = drawPageHeader(margin);
  y = drawTableHeader(y);

  opts.rows.forEach((row, idx) => {
    if (y + rowH > pageH - margin - footerH) {
      doc.addPage();
      y = drawPageHeader(margin);
      y = drawTableHeader(y);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(...palette.zebra);
      doc.rect(margin, y, contentW, rowH, 'F');
    }

    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.1);
    doc.line(margin, y + rowH, pageW - margin, y + rowH);

    const by = rowBaseline(y);
    const barcodeRaw = (row.barcode ?? '').trim();

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...palette.ink);
    doc.text(String(idx + 1), colNumCx, by, { align: 'center' });
    doc.text(truncateName(row.displayName), colNameL, y + 4.2);
    doc.setFontSize(10);
    doc.text(row.priceLabel, colPriceR, by, { align: 'right' });
    doc.setFontSize(12);

    if (barcodeRaw) {
      doc.setTextColor(...palette.muted);
      doc.text(truncateBarcode(barcodeRaw), colNameL, y + 9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(...palette.ink);
    }

    const fieldY = y + (rowH - qtyFieldH) / 2;
    doc.setDrawColor(...palette.muted);
    doc.setLineWidth(0.35);
    doc.roundedRect(colQtyBoxL, fieldY, colQtyBoxW, qtyFieldH, 0.6, 0.6, 'S');

    y += rowH;
  });

  doc.setDrawColor(...palette.border);
  doc.setLineWidth(0.25);
  doc.line(margin, y, pageW - margin, y);

  y += 6;
  const summaryH = 12;
  if (y + summaryH > pageH - margin - footerH) {
    doc.addPage();
    y = drawPageHeader(margin);
  }

  doc.setFillColor(...palette.headerBg);
  doc.setDrawColor(...palette.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentW, summaryH, 1.2, 1.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...palette.headerInk);
  doc.text(
    `Total: ${opts.rows.length} product${opts.rows.length === 1 ? '' : 's'}`,
    margin + 5,
    y + 8
  );

  y += summaryH + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...palette.muted);
  const noteLines = doc.splitTextToSize(opts.footnote, contentW);
  const noteBlockH = noteLines.length * 4.8 + 2;
  if (y + noteBlockH > pageH - margin - footerH) {
    doc.addPage();
    y = drawPageHeader(margin);
  }
  doc.text(noteLines, margin, y + 4);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...palette.muted);
    doc.text(`Page ${i} of ${totalPages}`, pageW / 2, pageH - 8, { align: 'center' });
  }

  doc.save(opts.saveFileName.endsWith('.pdf') ? opts.saveFileName : `${opts.saveFileName}.pdf`);
}

/** Map sales daily products to count-sheet rows (avg sell / unit). */
export function dailyProductsToCountSheetRows(
  products: {
    item_name: string;
    variant_name: string | null;
    barcode?: string | null;
    unit_type: string;
    avg_sell_price: number;
  }[],
  unitLabels: Record<string, string>
): ProductCountSheetRow[] {
  const formatPrice = (price: number) =>
    `KES ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return products.map((p) => {
    const u = unitLabels[p.unit_type] || p.unit_type;
    return {
      displayName: getItemDisplayName(p.item_name, p.variant_name),
      barcode: p.barcode ?? null,
      priceLabel: `${formatPrice(p.avg_sell_price)}/${u}`,
    };
  });
}
