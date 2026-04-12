import type { ProductCountSheetRow } from './product-count-sheet';

export interface ProductWeeklyCountSheetPdfOptions {
  headline: string;
  subtitleLine: string;
  periodLine: string;
  /** Short label (e.g. "Avg") — column is narrow. */
  priceColumnHeader: string;
  footnote: string;
  saveFileName: string;
  rows: ProductCountSheetRow[];
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * Portrait A4: product + avg price stacked on the left; Mon–Sun boxes use the rest of the
 * row width (no separate price column, so day cells are much wider).
 */
export async function downloadProductWeeklyCountSheetPdf(
  opts: ProductWeeklyCountSheetPdfOptions
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageW - margin * 2;
  const footerH = 8;

  const palette = {
    accent: [22, 163, 74] as const,
    ink: [15, 23, 42] as const,
    muted: [100, 116, 139] as const,
    headerBg: [241, 245, 249] as const,
    headerInk: [51, 65, 85] as const,
    border: [226, 232, 240] as const,
    zebra: [248, 250, 252] as const,
  };

  const rowH = 9.5;
  const headerH = 8;
  const headerBlockH = 18;
  const dayGap = 0.55;
  const numColW = 9;
  const gapNameToDays = 1.5;
  /** Max width for product + avg subline; remaining width goes to Mon–Sun boxes. */
  const nameColMaxW = 64;
  const colNumCx = margin + numColW / 2;
  const colNameL = margin + numColW + 1;
  const dayStartX = colNameL + nameColMaxW + gapNameToDays;
  const daysAvailW = pageW - margin - dayStartX;
  const dayBoxW =
    (daysAvailW - (DAY_HEADERS.length - 1) * dayGap) / DAY_HEADERS.length;
  const colNameMaxW = nameColMaxW;
  const qtyFieldH = Math.min(5.4, rowH - 2.2);

  const truncateName = (t: string) => {
    let s = t;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    while (s.length > 1 && doc.getTextWidth(s) > colNameMaxW) {
      s = s.length > 4 ? `${s.slice(0, -4)}…` : '…';
    }
    return s;
  };

  const truncateBarcode = (t: string) => {
    let s = t;
    doc.setFontSize(6);
    doc.setFont('courier', 'normal');
    while (s.length > 1 && doc.getTextWidth(s) > colNameMaxW) {
      s = s.length > 5 ? `${s.slice(0, -4)}…` : '…';
    }
    return s;
  };

  const truncateSubline = (t: string, maxW: number, size: number) => {
    let s = t;
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    while (s.length > 1 && doc.getTextWidth(s) > maxW) {
      s = s.length > 8 ? `${s.slice(0, -4)}…` : '…';
    }
    return s;
  };

  const rowBaseline = (rowY: number) => rowY + rowH * 0.52;

  const drawPageHeader = (yy: number) => {
    doc.setFillColor(...palette.accent);
    doc.rect(margin, yy, 2.8, headerBlockH, 'F');

    doc.setTextColor(...palette.ink);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(opts.headline, margin + 6.5, yy + 5.8);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...palette.muted);
    doc.text(opts.subtitleLine, margin + 6.5, yy + 10.5);

    const printed = new Date().toLocaleString('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    doc.setFontSize(7.5);
    doc.text(printed, pageW - margin, yy + 4.8, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...palette.accent);
    doc.text(opts.periodLine, pageW - margin, yy + 10.5, { align: 'right' });

    doc.setTextColor(...palette.ink);
    return yy + headerBlockH + 2.5;
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
    doc.text('Product (avg below)', colNameL, hy);

    let x = dayStartX;
    for (let d = 0; d < DAY_HEADERS.length; d++) {
      doc.text(DAY_HEADERS[d], x + dayBoxW / 2, hy, { align: 'center' });
      x += dayBoxW + dayGap;
    }

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

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...palette.ink);
    doc.text(String(idx + 1), colNumCx, by, { align: 'center' });
    doc.text(truncateName(row.displayName), colNameL, y + 3);
    doc.setFontSize(6.5);
    doc.setTextColor(...palette.muted);
    doc.text(truncateSubline(row.priceLabel, colNameMaxW, 6.5), colNameL, y + 6.5);
    doc.setFontSize(9);
    doc.setTextColor(...palette.ink);

    if (barcodeRaw) {
      doc.setTextColor(...palette.muted);
      doc.setFont('courier', 'normal');
      doc.setFontSize(6);
      doc.text(truncateBarcode(barcodeRaw), colNameL, y + 8.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...palette.ink);
    }

    const fieldY = y + (rowH - qtyFieldH) / 2;
    doc.setDrawColor(...palette.muted);
    doc.setLineWidth(0.3);
    let bx = dayStartX;
    for (let d = 0; d < DAY_HEADERS.length; d++) {
      doc.roundedRect(bx, fieldY, dayBoxW, qtyFieldH, 0.45, 0.45, 'S');
      bx += dayBoxW + dayGap;
    }

    y += rowH;
  });

  doc.setDrawColor(...palette.border);
  doc.setLineWidth(0.25);
  doc.line(margin, y, pageW - margin, y);

  y += 3.5;
  const summaryH = 8;
  if (y + summaryH > pageH - margin - footerH) {
    doc.addPage();
    y = drawPageHeader(margin);
  }

  doc.setFillColor(...palette.headerBg);
  doc.setDrawColor(...palette.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentW, summaryH, 0.9, 0.9, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...palette.headerInk);
  doc.text(
    `Total: ${opts.rows.length} product${opts.rows.length === 1 ? '' : 's'}`,
    margin + 3.5,
    y + 5.5
  );

  y += summaryH + 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...palette.muted);
  const noteLines = doc.splitTextToSize(opts.footnote, contentW);
  const noteBlockH = noteLines.length * 3.6 + 0.5;
  if (y + noteBlockH > pageH - margin - footerH) {
    doc.addPage();
    y = drawPageHeader(margin);
  }
  doc.text(noteLines, margin, y + 3.5);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...palette.muted);
    doc.text(`Page ${i} of ${totalPages}`, pageW / 2, pageH - 5.8, { align: 'center' });
  }

  doc.save(opts.saveFileName.endsWith('.pdf') ? opts.saveFileName : `${opts.saveFileName}.pdf`);
}
