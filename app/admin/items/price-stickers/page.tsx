'use client';

import { useEffect, useState, useMemo, useRef, type ReactNode } from 'react';
import Image from 'next/image';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Printer,
  Package,
  Loader2,
  Search,
  Store,
  Scissors,
  Minus,
  Plus,
  Maximize2,
  X,
  RectangleVertical,
  RectangleHorizontal,
  Circle,
  Globe,
  Phone,
} from 'lucide-react';
import type { Item, Category } from '@/lib/db/types';
import { getItemDisplayName, cn } from '@/lib/utils';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { CategoryList } from '@/components/pos/CategoryList';
import { getShopType } from '@/lib/utils/shop-type';

interface ItemWithCategory extends Item {
  category_name?: string;
  parent_name?: string;
  aisle?: string | null;
  aisle_number?: string | null;
  batch_number?: string | null;
}

function getAisleLabel(item: ItemWithCategory): string {
  const parts = [item.aisle_number, item.aisle].filter(Boolean);
  return parts.length ? `Aisle ${parts.join(' ')}` : '';
}

const LABEL_LAYOUTS = [
  { cols: 1, rows: 2, count: 2, label: '2 labels (1×2) - Large' },
  { cols: 4, rows: 6, count: 24, label: '24 labels (4×6)' },
  { cols: 6, rows: 6, count: 36, label: '36 labels (6×6)' },
  { cols: 6, rows: 8, count: 48, label: '48 labels (6×8)' },
  { cols: 8, rows: 12, count: 96, label: '96 labels (8×12)' },
  { cols: 3, rows: 7, count: 21, label: '21 labels (3×7)' },
  { cols: 3, rows: 4, count: 12, label: '12 labels (3×4)' },
] as const;

type LabelLayout = (typeof LABEL_LAYOUTS)[number];

type PrintFormat = 'a4' | 'thermal';

/** 43×43 mm die-cut thermal roll — 2 across, 2 mm gaps, 1 mm side margins (90 mm roll). */
const THERMAL_STICKER_LAYOUT = {
  cols: 2,
  rows: 1,
  count: 2,
  label: 'Thermal roll · 43×43 mm (2 per row)',
  stickerMm: 43,
  colGapMm: 2,
  rowGapMm: 2,
  marginLeftRightMm: 1,
  rollWidthMm: 90,
  rowHeightMm: 43,
} as const;

type ActiveLayout =
  | { cols: number; rows: number; count: number; label: string }
  | typeof THERMAL_STICKER_LAYOUT;

/**
 * Keep sticker cells roughly square by matching grid aspect to page orientation.
 * Layouts are authored for portrait; landscape swaps cols ↔ rows.
 */
function orientLabelLayout(
  layout: LabelLayout,
  orientation: 'portrait' | 'landscape',
): { cols: number; rows: number; count: number; label: string } {
  const { cols, rows, count, label } = layout;
  if (cols === rows) return { cols, rows, count, label };
  if (orientation === 'landscape' && rows > cols) {
    return { cols: rows, rows: cols, count, label };
  }
  if (orientation === 'portrait' && cols > rows) {
    return { cols: rows, rows: cols, count, label };
  }
  return { cols, rows, count, label };
}

/** Tighter row gaps, shorter cell padding, and slightly smaller type as layouts get denser. */
function getLabelSheetMetrics(layout: { cols: number; rows: number; count: number }) {
  const huge = layout.count <= 2;
  const ultraTight = layout.count >= 96;
  const veryTight = layout.count >= 48;
  const tight = layout.rows >= 7 || layout.count >= 36;
  const colGap = ultraTight ? '1.5mm' : '4mm';
  const rowGap = huge
    ? '5mm'
    : ultraTight
      ? '1.25mm'
      : veryTight
        ? '2mm'
        : tight
          ? '2.5mm'
          : '3mm';
  const pagePadding = huge
    ? '7mm 8mm'
    : ultraTight
      ? '3mm 3.5mm'
      : veryTight
        ? '4mm 5mm'
        : tight
          ? '4.5mm 5mm'
          : '5mm';
  const cellPadding = huge
    ? '3mm 4mm'
    : ultraTight
      ? '0.6mm 0.8mm'
      : veryTight
        ? '1mm 1.5mm'
        : tight
          ? '1.25mm 2mm'
          : '1.75mm 2.25mm';
  const titleLineHeight = huge ? 1.18 : ultraTight ? 1.1 : veryTight ? 1.12 : tight ? 1.15 : 1.2;
  /** Cap logo height; width is 100% of cell — sized for at-a-glance readability on real labels. */
  const logoMaxHeightMm = huge ? 42 : ultraTight ? 11 : veryTight ? 18 : tight ? 22.5 : 27;
  return {
    colGap,
    rowGap,
    pagePadding,
    cellPadding,
    alignTop: tight && !huge,
    logoMaxHeightMm,
    titlePt: huge ? 16 : ultraTight ? 5.5 : veryTight ? 7.5 : tight ? 8.5 : 10,
    titleLineHeight,
    pricePt: huge ? 24 : ultraTight ? 8 : veryTight ? 11 : tight ? 12.5 : 14,
    metaPt: huge ? 11 : ultraTight ? 4.5 : veryTight ? 6.5 : tight ? 7.5 : 8,
    batchPt: huge ? 8 : ultraTight ? 3.5 : veryTight ? 5 : tight ? 5.5 : 6,
    barcodePt: huge ? 10 : ultraTight ? 4 : veryTight ? 6 : tight ? 7 : 8,
    stackGapPt: huge ? 2.8 : ultraTight ? 0.4 : veryTight ? 0.75 : tight ? 1.25 : 2,
    emptyPt: huge ? 16 : ultraTight ? 5 : veryTight ? 8 : 10,
    preview: {
      cellPad: huge ? 10 : ultraTight ? 1 : veryTight ? 2 : tight ? 3 : 4,
      stackGapPx: huge ? 8 : ultraTight ? 1 : veryTight ? 1.5 : tight ? 2 : 3,
      logoMaxPx: huge ? 180 : ultraTight ? 40 : veryTight ? 66 : tight ? 84 : 102,
      title: huge ? 12 : ultraTight ? 3 : veryTight ? 4.5 : tight ? 5 : 6,
      price: huge ? 16 : ultraTight ? 4 : veryTight ? 6 : tight ? 7 : 8,
      meta: huge ? 8.5 : ultraTight ? 2.5 : veryTight ? 3.5 : tight ? 4 : 5,
      batch: huge ? 7 : ultraTight ? 2 : veryTight ? 3 : tight ? 3.5 : 4,
      barcode: huge ? 8 : ultraTight ? 2.5 : veryTight ? 3.5 : tight ? 4 : 5,
      titleLh: titleLineHeight,
    },
  };
}

/** Compact type for 43 mm thermal stickers (two per 90 mm row). */
function getThermalSheetMetrics() {
  return {
    colGap: '2mm',
    rowGap: '2mm',
    pagePadding: '0 1mm',
    cellPadding: '1.25mm 1.5mm',
    alignTop: true,
    logoMaxHeightMm: 14,
    titlePt: 7,
    titleLineHeight: 1.12,
    pricePt: 10,
    metaPt: 5.5,
    batchPt: 4.5,
    barcodePt: 5,
    stackGapPt: 0.65,
    emptyPt: 7,
    preview: {
      cellPad: 2,
      stackGapPx: 1.5,
      logoMaxPx: 48,
      title: 4.5,
      price: 6,
      meta: 3,
      batch: 2.5,
      barcode: 3,
      titleLh: 1.12,
    },
  };
}

type SheetMetrics = ReturnType<typeof getLabelSheetMetrics>;

function getStickerGridStyle(
  layout: ActiveLayout,
  metrics: SheetMetrics,
  options: { thermal: boolean; mode: 'preview' | 'print' },
) {
  const stickerMm = 'stickerMm' in layout ? layout.stickerMm : undefined;
  const rowHeightMm = 'rowHeightMm' in layout ? layout.rowHeightMm : undefined;
  const colTrack =
    options.thermal && options.mode === 'print' && stickerMm != null
      ? `${stickerMm}mm`
      : 'minmax(0, 1fr)';
  const rowTrack =
    options.thermal && options.mode === 'print' && rowHeightMm != null
      ? `${rowHeightMm}mm`
      : 'minmax(0, 1fr)';
  return {
    gridTemplateColumns: `repeat(${layout.cols}, ${colTrack})`,
    gridTemplateRows: `repeat(${layout.rows}, ${rowTrack})`,
    columnGap: metrics.colGap,
    rowGap: metrics.rowGap,
    boxSizing: 'border-box' as const,
  };
}

/** Sticker brand asset + contact lines */
const UB_LOGO = '/images/logo.png' as const;
const WEBSITE_DISPLAY = 'urbanbasket.co.ke' as const;
const WEBSITE_HREF = 'https://urbanbasket.co.ke' as const;
/** Local format on sticker; tel: uses Kenya country code (drop leading 0). */
const PHONE_DISPLAY = '0113277767' as const;
const PHONE_DISPLAY_SPACED = '0113 277 767' as const;
const PHONE_HREF = 'tel:+254113277767' as const;
/** Clean label face — white field, dashed cut guides, sharp corners. */
const UB_STICKER_SCREEN =
  'border border-dashed border-slate-400/80 bg-white dark:border-slate-500 dark:bg-card';
const UB_STICKER_PRINT =
  'border border-dashed border-neutral-500 bg-white print:border-neutral-600';

/**
 * Renders a label cell: rectangle (default) or a true circle (inscribed in the grid cell).
 * Square diameter = min(cell width, cell height) using container query units.
 */
function LabelSheetCell({
  round,
  mode,
  sheetMetrics,
  children,
}: {
  round: boolean;
  mode: 'preview' | 'print';
  sheetMetrics: SheetMetrics;
  children: ReactNode;
}) {
  const pv = sheetMetrics.preview;
  if (round) {
    return (
      <div className="grid h-full w-full min-h-0 min-w-0 [container-type:size] place-items-center p-0.5">
        <div
          className={cn(
            'flex min-h-0 w-full min-w-0 flex-col justify-start overflow-hidden rounded-full border border-dashed',
            mode === 'preview'
              ? 'border-slate-400/80 bg-white dark:border-slate-500 dark:bg-card'
              : 'border-neutral-500 bg-white print:border-neutral-600'
          )}
          style={
            mode === 'preview'
              ? {
                  width: 'min(100%, 100cqh)',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  aspectRatio: '1 / 1',
                  boxSizing: 'border-box',
                  padding: `${pv.cellPad}px`,
                }
              : {
                  width: 'min(100%, 100cqh)',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  aspectRatio: '1 / 1',
                  boxSizing: 'border-box',
                  minHeight: 0,
                  padding: sheetMetrics.cellPadding,
                }
          }
        >
          {children}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 flex-col justify-start overflow-hidden rounded-none',
        mode === 'preview' ? UB_STICKER_SCREEN : UB_STICKER_PRINT
      )}
      style={
        mode === 'preview'
          ? { padding: `${pv.cellPad}px` }
          : {
              minHeight: 0,
              boxSizing: 'border-box',
              padding: sheetMetrics.cellPadding,
            }
      }
    >
      {children}
    </div>
  );
}

function formatKes(p: number) {
  return `KES ${p.toFixed(0)}`;
}

function formatKesAmount(p: number) {
  const n = Number(p);
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('en-KE', {
    maximumFractionDigits: 0,
  }).format(Math.round(v));
}

/** Clean price line — currency + amount only, no promo boxes. */
function StickerPriceCallout({
  price,
  sm,
  mode,
  marginTopPreviewPx,
  marginTopPrintPt,
}: {
  price: number | null | undefined;
  sm: SheetMetrics;
  mode: 'preview' | 'print';
  marginTopPreviewPx: number;
  marginTopPrintPt: number;
}) {
  const n = Number(price);
  const safePrice = Number.isFinite(n) ? n : 0;
  const amount = formatKesAmount(safePrice);
  const fullLabel = formatKes(safePrice);

  if (mode === 'preview') {
    const p = sm.preview;
    const kesSize = Math.max(7, p.price * 0.48);
    const numSize = Math.max(12, p.price * 1.35);
    return (
      <div
        className="flex w-full shrink-0 flex-wrap items-baseline justify-center gap-x-1 border-t border-slate-200/90 pt-1 dark:border-slate-700"
        style={{ marginTop: marginTopPreviewPx }}
        aria-label={fullLabel}
        role="group"
      >
        <span
          className="shrink-0 font-semibold tracking-wide text-slate-500 dark:text-slate-400"
          style={{ fontSize: `${kesSize}px` }}
        >
          KES
        </span>
        <span
          className="shrink-0 font-bold tabular-nums leading-none tracking-tight text-slate-900 dark:text-white"
          style={{ fontSize: `${numSize}px` }}
        >
          {amount}
        </span>
      </div>
    );
  }

  const kesPt = sm.pricePt * 0.5;
  const numPt = sm.pricePt * 1.35;
  return (
    <div
      className="flex w-full shrink-0 flex-wrap items-baseline justify-center border-t border-neutral-300 print:border-neutral-400"
      style={{
        marginTop: marginTopPrintPt,
        paddingTop: `${Math.max(1.5, sm.stackGapPt)}pt`,
        columnGap: `${sm.stackGapPt}pt`,
      }}
      aria-label={fullLabel}
      role="group"
    >
      <span
        className="shrink-0 font-semibold tracking-wide text-neutral-600 print:text-neutral-700"
        style={{ fontSize: `${kesPt}pt` }}
      >
        KES
      </span>
      <span
        className="shrink-0 font-bold tabular-nums leading-none tracking-tight text-black print:text-black"
        style={{ fontSize: `${numPt}pt` }}
      >
        {amount}
      </span>
    </div>
  );
}

/** Minimal contact lines under the price. */
function StickerContactFooter({
  sm,
  mode,
  showWebsiteLink,
  showPhoneNumber,
}: {
  sm: SheetMetrics;
  mode: 'preview' | 'print';
  showWebsiteLink: boolean;
  showPhoneNumber: boolean;
}) {
  if (!showWebsiteLink && !showPhoneNumber) return null;

  if (mode === 'preview') {
    const pv = sm.preview;
    const valuePx = Math.max(7, pv.meta * 0.9);
    return (
      <div
        className="flex w-full min-w-0 shrink-0 flex-col items-center text-center text-slate-500 dark:text-slate-400"
        style={{
          marginTop: `${Math.max(pv.stackGapPx, 3)}px`,
          gap: `${Math.max(1, Math.round(pv.stackGapPx * 0.4))}px`,
        }}
        role="group"
        aria-label="Store contact details"
      >
        {showWebsiteLink && (
          <a
            href={WEBSITE_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 max-w-full truncate font-medium tracking-tight hover:text-slate-700 dark:hover:text-slate-300"
            style={{ fontSize: `${valuePx}px`, lineHeight: 1.25 }}
          >
            {WEBSITE_DISPLAY}
          </a>
        )}
        {showPhoneNumber && (
          <a
            href={PHONE_HREF}
            className="min-w-0 font-medium tabular-nums tracking-tight hover:text-slate-700 dark:hover:text-slate-300"
            style={{ fontSize: `${valuePx}px`, lineHeight: 1.25 }}
          >
            {PHONE_DISPLAY_SPACED}
          </a>
        )}
      </div>
    );
  }

  const valuePt = Math.max(5, sm.batchPt * 0.95);
  return (
    <div
      className="flex w-full min-w-0 shrink-0 flex-col items-center text-center text-neutral-600 print:text-neutral-700"
      style={{
        marginTop: `${sm.stackGapPt}pt`,
        gap: `${sm.stackGapPt * 0.35}pt`,
      }}
      role="group"
      aria-label="Store contact details"
    >
      {showWebsiteLink && (
        <a
          href={WEBSITE_HREF}
          className="min-w-0 max-w-full font-medium tracking-tight [overflow-wrap:anywhere] print:text-neutral-700"
          style={{
            fontSize: `${valuePt}pt`,
            lineHeight: 1.2,
            wordBreak: 'break-all',
          }}
        >
          {WEBSITE_DISPLAY}
        </a>
      )}
      {showPhoneNumber && (
        <a
          href={PHONE_HREF}
          className="min-w-0 font-medium tabular-nums tracking-tight print:text-neutral-700"
          style={{ fontSize: `${valuePt}pt`, lineHeight: 1.2 }}
        >
          {PHONE_DISPLAY_SPACED}
        </a>
      )}
    </div>
  );
}

function StickerLabelBlock({
  item,
  sm,
  mode,
  showBarcode,
  showBatchNumber,
  showWebsiteLink,
  showPhoneNumber,
  round = false,
}: {
  item: ItemWithCategory;
  sm: SheetMetrics;
  mode: 'preview' | 'print';
  showBarcode: boolean;
  showBatchNumber: boolean;
  showWebsiteLink: boolean;
  showPhoneNumber: boolean;
  round?: boolean;
}) {
  const displayName = getItemDisplayName(item.name, item.variant_name);

  const priceVal = item.current_sell_price;
  const compactLayout = sm.preview.title <= 5 || sm.titlePt <= 8.5;
  const logoBand = round ? '26%' : compactLayout ? '28%' : '30%';

  if (mode === 'preview') {
    const pv = sm.preview;
    const nameLines = round ? 2 : compactLayout ? 2 : 3;
    const nameMaxPx = nameLines * pv.title * pv.titleLh;
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
        <div
          className="flex w-full shrink-0 items-center justify-center"
          style={{
            height: logoBand,
            marginBottom: `${pv.stackGapPx}px`,
            maxHeight: `${pv.logoMaxPx}px`,
            minHeight: 0,
          }}
        >
          <img
            src={UB_LOGO}
            alt="palmart"
            className="pointer-events-none block h-full max-h-full w-full max-w-full select-none object-contain object-center"
            draggable={false}
          />
        </div>
        <div
          className="w-full shrink-0 overflow-hidden"
          style={{ maxHeight: `${nameMaxPx}px` }}
        >
          <p
            className="w-full min-w-0 break-words text-center font-medium text-slate-800 dark:text-slate-100"
            style={{
              fontSize: `${pv.title}px`,
              lineHeight: pv.titleLh,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: nameLines,
              overflow: 'hidden',
            }}
          >
            {displayName}
          </p>
        </div>
        <div className="flex w-full min-w-0 shrink-0 flex-col">
          <StickerPriceCallout
            price={priceVal}
            sm={sm}
            mode="preview"
            marginTopPreviewPx={pv.stackGapPx}
            marginTopPrintPt={0}
          />
          {showBatchNumber && (item as ItemWithCategory).batch_number && (
            <p
              className="w-full min-w-0 break-words text-center font-normal text-slate-500 dark:text-slate-400"
              style={{ fontSize: `${pv.batch}px`, marginTop: `${pv.stackGapPx}px` }}
            >
              Batch {(item as ItemWithCategory).batch_number}
            </p>
          )}
          {showBarcode && item.barcode && (
            <p
              className="w-full min-w-0 break-all text-center font-mono text-slate-500 dark:text-slate-400"
              style={{ fontSize: `${pv.barcode}px`, marginTop: `${pv.stackGapPx}px` }}
            >
              {item.barcode}
            </p>
          )}
          <StickerContactFooter
            sm={sm}
            mode="preview"
            showWebsiteLink={showWebsiteLink}
            showPhoneNumber={showPhoneNumber}
          />
        </div>
      </div>
    );
  }

  const nameLinesPrint = round ? 2 : compactLayout ? 2 : 3;
  const nameMaxPt = nameLinesPrint * sm.titlePt * sm.titleLineHeight;
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div
        className="flex w-full shrink-0 items-center justify-center"
        style={{
          height: logoBand,
          marginBottom: `${sm.stackGapPt}pt`,
          maxHeight: `${sm.logoMaxHeightMm}mm`,
          minHeight: 0,
        }}
      >
        <img
          src={UB_LOGO}
          alt="palmart"
          className="block h-full max-h-full w-full max-w-full object-contain object-center"
        />
      </div>
      <div
        className="w-full shrink-0 overflow-hidden"
        style={{ maxHeight: `${nameMaxPt}pt` }}
      >
        <p
          className="w-full min-w-0 break-words text-center font-medium text-black [overflow-wrap:anywhere] print:text-black"
          style={{
            fontSize: `${sm.titlePt}pt`,
            lineHeight: sm.titleLineHeight,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: nameLinesPrint,
            overflow: 'hidden',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          {displayName}
        </p>
      </div>
      <div className="flex w-full min-w-0 shrink-0 flex-col">
        <StickerPriceCallout
          price={priceVal}
          sm={sm}
          mode="print"
          marginTopPreviewPx={0}
          marginTopPrintPt={sm.stackGapPt}
        />
        {showBatchNumber && (item as ItemWithCategory).batch_number && (
          <p
            className="w-full min-w-0 break-words text-center text-neutral-600 print:text-neutral-700"
            style={{ fontSize: `${sm.batchPt}pt`, marginTop: `${sm.stackGapPt}pt` }}
          >
            Batch {(item as ItemWithCategory).batch_number}
          </p>
        )}
        {showBarcode && item.barcode && (
          <p
            className="w-full min-w-0 break-all text-center font-mono text-neutral-600 print:text-neutral-700"
            style={{
              fontSize: `${sm.barcodePt}pt`,
              marginTop: `${sm.stackGapPt}pt`,
              wordBreak: 'break-all',
              overflowWrap: 'break-word',
            }}
          >
            {item.barcode}
          </p>
        )}
        <StickerContactFooter
          sm={sm}
          mode="print"
          showWebsiteLink={showWebsiteLink}
          showPhoneNumber={showPhoneNumber}
        />
      </div>
    </div>
  );
}

function QuantityStepper({
  value,
  onChange,
  maxPerPage,
}: {
  value: number;
  onChange: (n: number) => void;
  maxPerPage: number;
}) {
  const set = (n: number) => onChange(Math.max(0, n));

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="flex items-center rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => set(value - 1)}
          disabled={value <= 0}
          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all"
          aria-label="Decrease"
        >
          <Minus className="w-4 h-4" strokeWidth={2.5} />
        </button>
        <input
          type="number"
          min={0}
          value={value || ''}
          onChange={(e) => set(parseInt(e.target.value, 10) || 0)}
          className="w-11 h-8 text-center text-sm font-semibold bg-transparent border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => set(value + 1)}
          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all"
          aria-label="Increase"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => set(1)}
          className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-colors"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => set(maxPerPage)}
          className="h-8 px-2.5 rounded-lg text-xs font-semibold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
          title={`Full page (${maxPerPage} labels)`}
        >
          {maxPerPage}
        </button>
      </div>
    </div>
  );
}

const PAGE_PORTRAIT_MM = { width: 210, height: 297 } as const;
const PAGE_LANDSCAPE_MM = { width: 297, height: 210 } as const;
/** ~96dpi px for scaling the expanded preview to the viewport */
const PAGE_PORTRAIT_PX = { width: 794, height: 1123 } as const;
const PAGE_LANDSCAPE_PX = { width: 1123, height: 794 } as const;
const THERMAL_PAGE_PX = {
  width: Math.round((THERMAL_STICKER_LAYOUT.rollWidthMm / 25.4) * 96),
  height: Math.round((THERMAL_STICKER_LAYOUT.rowHeightMm / 25.4) * 96),
} as const;

export default function PriceStickersPage() {
  const { productTypes, itemTypeKeys } = useItemTypes();
  const [shopType, setShopType] = useState(() => getShopType());
  const [items, setItems] = useState<ItemWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('retail');
  const [aisleFilter, setAisleFilter] = useState<string>('all');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [printFormat, setPrintFormat] = useState<PrintFormat>('a4');
  const [labelLayout, setLabelLayout] = useState<LabelLayout>(LABEL_LAYOUTS[0]);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showBatchNumber, setShowBatchNumber] = useState(false);
  const [showWebsiteLink, setShowWebsiteLink] = useState(false);
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  const [roundStickers, setRoundStickers] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [a4Scale, setA4Scale] = useState(1);
  const a4ContainerRef = useRef<HTMLDivElement>(null);
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const isThermal = printFormat === 'thermal';
  const activeLayout: ActiveLayout = useMemo(() => {
    if (isThermal) return THERMAL_STICKER_LAYOUT;
    return orientLabelLayout(labelLayout, pageOrientation);
  }, [isThermal, labelLayout, pageOrientation]);

  const sheetMetrics = useMemo(
    () => (isThermal ? getThermalSheetMetrics() : getLabelSheetMetrics(activeLayout)),
    [isThermal, activeLayout],
  );

  const pageSize = useMemo(() => {
    if (isThermal) {
      return {
        width: THERMAL_STICKER_LAYOUT.rollWidthMm,
        height: THERMAL_STICKER_LAYOUT.rowHeightMm,
        aspectRatio: `${THERMAL_STICKER_LAYOUT.rollWidthMm}/${THERMAL_STICKER_LAYOUT.rowHeightMm}` as const,
        px: THERMAL_PAGE_PX,
        pageSizeCss: `${THERMAL_STICKER_LAYOUT.rollWidthMm}mm ${THERMAL_STICKER_LAYOUT.rowHeightMm}mm` as const,
      };
    }
    if (pageOrientation === 'landscape') {
      return {
        ...PAGE_LANDSCAPE_MM,
        aspectRatio: `${PAGE_LANDSCAPE_MM.width}/${PAGE_LANDSCAPE_MM.height}` as const,
        px: PAGE_LANDSCAPE_PX,
        pageSizeCss: 'A4 landscape' as const,
      };
    }
    return {
      ...PAGE_PORTRAIT_MM,
      aspectRatio: `${PAGE_PORTRAIT_MM.width}/${PAGE_PORTRAIT_MM.height}` as const,
      px: PAGE_PORTRAIT_PX,
      pageSizeCss: 'A4 portrait' as const,
    };
  }, [isThermal, pageOrientation]);

  const previewGridStyle = useMemo(
    () => getStickerGridStyle(activeLayout, sheetMetrics, { thermal: isThermal, mode: 'preview' }),
    [activeLayout, sheetMetrics, isThermal],
  );

  const printGridStyle = useMemo(
    () => getStickerGridStyle(activeLayout, sheetMetrics, { thermal: isThermal, mode: 'print' }),
    [activeLayout, sheetMetrics, isThermal],
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, categoriesRes] = await Promise.all([
        fetch(
          `/api/items?all=true&sellableOnly=true&itemType=${encodeURIComponent(itemTypeFilter)}`,
          { cache: 'no-store' }
        ),
        fetch('/api/categories', { cache: 'no-store' }),
      ]);

      const itemsResult = await itemsRes.json();
      const categoriesResult = await categoriesRes.json();

      if (categoriesResult.success) setCategories(categoriesResult.data);

      if (itemsResult.success) {
        const allItems: ItemWithCategory[] = itemsResult.data.map((item: Item) => {
          const category = categoriesResult.success
            ? categoriesResult.data.find((c: Category) => c.id === item.category_id)
            : null;
          return { ...item, category_name: category?.name };
        });
        setItems(allItems);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [itemTypeFilter]);

  useEffect(() => {
    if (itemTypeKeys.length > 0) {
      setShopType(getShopType(itemTypeKeys));
    }
  }, [itemTypeKeys]);

  // Scale A4 to fit viewport when expanded
  useEffect(() => {
    if (!previewExpanded) return;
    const updateScale = () => {
      const el = a4ContainerRef.current;
      if (!el) return;
      const { clientWidth, clientHeight } = el;
      const { width: a4WidthPx, height: a4HeightPx } = pageSize.px;
      const scale = Math.min(clientWidth / a4WidthPx, clientHeight / a4HeightPx, 1) || 1;
      setA4Scale(scale);
    };
    const ro = new ResizeObserver(updateScale);
    const t = setTimeout(() => {
      if (a4ContainerRef.current) {
        ro.observe(a4ContainerRef.current);
        updateScale();
      }
    }, 50);
    window.addEventListener('resize', updateScale);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [previewExpanded, pageSize.px]);

  const aisles = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      const aisle = (i as Item & { aisle?: string | null }).aisle;
      if (aisle?.trim()) set.add(aisle.trim());
    });
    return [...set].sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const name = getItemDisplayName(item.name, item.variant_name);
        if (
          !name.toLowerCase().includes(q) &&
          !item.category_name?.toLowerCase().includes(q) &&
          !(item as Item & { aisle?: string }).aisle?.toLowerCase().includes(q)
        )
          return false;
      }
      if (selectedCategoryId !== null && item.category_id !== selectedCategoryId) return false;
      if (aisleFilter !== 'all') {
        const aisle = (item as Item & { aisle?: string }).aisle?.trim();
        if (aisle !== aisleFilter) return false;
      }
      return true;
    });
  }, [items, searchQuery, selectedCategoryId, aisleFilter]);

  const setQuantity = (id: string, qty: number) => {
    const n = Math.max(0, Math.floor(qty));
    setQuantities((prev) => (n === 0 ? { ...prev, [id]: 0 } : { ...prev, [id]: n }));
  };

  const selectAll = () => {
    setQuantities((prev) => {
      const next = { ...prev };
      filteredItems.forEach((i) => (next[i.id] = 1));
      return next;
    });
  };

  const selectNone = () => setQuantities({});

  const fillPage = () => {
    setQuantities((prev) => {
      const next = { ...prev };
      filteredItems.forEach((i) => {
        if ((prev[i.id] ?? 0) > 0) next[i.id] = activeLayout.count;
      });
      return next;
    });
  };

  /** All queued stickers for print/preview — uses full catalog so category/aisle filters don’t drop selections. */
  const selectedItems = useMemo(() => {
    const out: ItemWithCategory[] = [];
    items.forEach((item) => {
      const qty = quantities[item.id] ?? 0;
      for (let i = 0; i < qty; i++) out.push(item);
    });
    return out;
  }, [items, quantities]);

  const printStickers = () => {
    window.print();
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-primary/[0.04] via-background to-muted/30 dark:from-primary/5 dark:via-background dark:to-card/40">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md shadow-sm">
          <div className="px-4 md:px-8 py-6">
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-4 md:gap-5">
                <div className="relative h-16 w-16 md:h-[4.5rem] md:w-[4.5rem] shrink-0 rounded-2xl overflow-hidden bg-card ring-2 ring-primary/30 shadow-md">
                  <Image
                    src={UB_LOGO}
                    alt="palmart"
                    fill
                    className="object-contain p-1.5"
                    sizes="(max-width: 768px) 64px, 72px"
                    priority
                    unoptimized
                  />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    Price stickers
                  </h1>
                  <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                    {isThermal
                      ? 'Thermal roll · 43×43 mm · 2 per row'
                      : 'A4 label sheets · Cut and stick'}
                  </p>
                </div>
              </div>
              <Button
                onClick={printStickers}
                disabled={selectedItems.length === 0}
                className="h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none"
              >
                <Printer className="w-5 h-5 mr-2" strokeWidth={2} />
                Print {selectedItems.length} sticker{selectedItems.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 space-y-6">
          {!searchQuery.trim() && (
            <div className="-mx-4 md:-mx-8 border-y border-slate-200/80 dark:border-slate-800/80 overflow-hidden rounded-none">
              <CategoryList
                onSelectCategory={setSelectedCategoryId}
                selectedCategoryId={selectedCategoryId ?? undefined}
                shopType={shopType}
                categories={categories}
              />
            </div>
          )}

          {/* Filters */}
          <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
            <CardContent className="p-5 space-y-5">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30 focus-visible:ring-slate-400"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={itemTypeFilter === 'retail' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setItemTypeFilter('retail')}
                    className={`h-9 rounded-lg font-medium transition-all ${
                      itemTypeFilter === 'retail'
                        ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                        : 'border border-border hover:bg-muted/80 dark:hover:bg-muted/50'
                    }`}
                  >
                    <Store className="w-4 h-4 mr-1.5" />
                    Retail
                  </Button>
                  {productTypes
                    .filter((t) => t.key !== 'retail')
                    .map((t) => (
                      <Button
                        key={t.key}
                        variant={itemTypeFilter === t.key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setItemTypeFilter(t.key)}
                        className={`h-9 rounded-lg font-medium transition-all ${
                          itemTypeFilter === t.key
                            ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                            : 'border border-border hover:bg-muted/80 dark:hover:bg-muted/50'
                        }`}
                      >
                        <span className="mr-1.5">{t.emoji}</span>
                        {t.label}
                      </Button>
                    ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 items-center pt-1">
                {aisles.length > 0 && (
                  <Select value={aisleFilter} onValueChange={setAisleFilter}>
                    <SelectTrigger className="w-[160px] h-9 rounded-lg border-slate-200/80 dark:border-slate-700/80">
                      <SelectValue placeholder="Aisle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All aisles</SelectItem>
                      {aisles.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select
                  value={printFormat}
                  onValueChange={(v) => setPrintFormat(v as PrintFormat)}
                >
                  <SelectTrigger className="w-[min(100%,14rem)] h-9 rounded-lg border-slate-200/80 dark:border-slate-700/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4 label sheets</SelectItem>
                    <SelectItem value="thermal">Thermal roll (43×43 mm)</SelectItem>
                  </SelectContent>
                </Select>
                {!isThermal && (
                  <Select
                    value={labelLayout.label}
                    onValueChange={(v) => {
                      const layout = LABEL_LAYOUTS.find((l) => l.label === v);
                      if (layout) setLabelLayout(layout);
                    }}
                  >
                    <SelectTrigger className="w-[160px] h-9 rounded-lg border-slate-200/80 dark:border-slate-700/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LABEL_LAYOUTS.map((l) => (
                        <SelectItem key={l.label} value={l.label}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!isThermal && (
                  <Select
                    value={pageOrientation}
                    onValueChange={(v) => setPageOrientation(v as 'portrait' | 'landscape')}
                  >
                    <SelectTrigger className="w-[158px] h-9 rounded-lg border-slate-200/80 dark:border-slate-700/80">
                      {pageOrientation === 'landscape' ? (
                        <RectangleHorizontal className="w-4 h-4 mr-2 text-slate-500 shrink-0" />
                      ) : (
                        <RectangleVertical className="w-4 h-4 mr-2 text-slate-500 shrink-0" />
                      )}
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait (210×297 mm)</SelectItem>
                      <SelectItem value="landscape">Landscape (297×210 mm)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {isThermal && (
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-lg">
                    90 mm roll · 2 mm gaps · 1 mm side margins
                  </span>
                )}
                <label className="flex items-center gap-2.5 text-sm cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={showBarcode}
                    onChange={(e) => setShowBarcode(e.target.checked)}
                    className="rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                  />
                  Show barcode
                </label>
                <label className="flex items-center gap-2.5 text-sm cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={showBatchNumber}
                    onChange={(e) => setShowBatchNumber(e.target.checked)}
                    className="rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                  />
                  Show batch
                </label>
                {!isThermal && (
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={roundStickers}
                      onChange={(e) => setRoundStickers(e.target.checked)}
                      className="rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                    />
                    <Circle className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
                    Round labels
                  </label>
                )}
                <div
                  className="w-full min-w-0 sm:w-auto sm:max-w-[min(100%,24rem)] rounded-lg border border-slate-200/90 bg-white p-3 dark:border-slate-700 dark:bg-card"
                  role="group"
                  aria-label="Contact details to show on price stickers"
                >
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Contact on labels
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md p-1.5 -m-1.5 transition-colors',
                        'hover:bg-slate-50 dark:hover:bg-slate-900/40',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-300 has-[:focus-visible]:ring-offset-2',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={showWebsiteLink}
                        onChange={(e) => setShowWebsiteLink(e.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border border-slate-300 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Globe
                            className="h-4 w-4 shrink-0 text-slate-500"
                            strokeWidth={2}
                            aria-hidden
                          />
                          Website
                        </span>
                        <span
                          className="mt-0.5 block pl-6 text-xs text-slate-500 tabular-nums"
                          title={WEBSITE_HREF}
                        >
                          {WEBSITE_DISPLAY}
                        </span>
                      </span>
                    </label>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md p-1.5 -m-1.5 transition-colors',
                        'hover:bg-slate-50 dark:hover:bg-slate-900/40',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-300 has-[:focus-visible]:ring-offset-2',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={showPhoneNumber}
                        onChange={(e) => setShowPhoneNumber(e.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border border-slate-300 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Phone
                            className="h-4 w-4 shrink-0 text-slate-500"
                            strokeWidth={2}
                            aria-hidden
                          />
                          Phone
                        </span>
                        <span
                          className="mt-0.5 block pl-6 text-xs text-slate-500 tabular-nums"
                          title={PHONE_HREF}
                        >
                          {PHONE_DISPLAY}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    className="h-9 rounded-lg border-slate-200 dark:border-slate-700 font-medium"
                  >
                    Select all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fillPage}
                    className="h-9 rounded-lg border-slate-200 dark:border-slate-700 font-medium"
                  >
                    Fill page
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectNone}
                    className="h-9 rounded-lg border-slate-200 dark:border-slate-700 font-medium text-slate-600 dark:text-slate-400"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Item list */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {filteredItems.length} products · <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedItems.length}</span> sticker{selectedItems.length !== 1 ? 's' : ''} to print
                  </p>
                </div>
                <div className="max-h-[50vh] overflow-y-auto">
                  {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                      </div>
                      <p className="text-sm text-slate-500">Loading products...</p>
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="p-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="font-medium text-slate-600 dark:text-slate-400">No products match your filters</p>
                      <p className="text-sm text-slate-500 mt-1">Try adjusting category or search</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100/80 dark:divide-slate-800/80">
                      {filteredItems.map((item) => {
                        const displayName = getItemDisplayName(item.name, item.variant_name);
                        const qty = quantities[item.id] ?? 0;
                        const aisleLabel = getAisleLabel(item);
                        return (
                          <div
                            key={item.id}
                            className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50 ${
                              qty > 0 ? 'border-l-2 border-l-primary bg-primary/8 dark:bg-primary/15' : ''
                            }`}
                          >
                            <QuantityStepper
                              value={qty}
                              onChange={(n) => setQuantity(item.id, n)}
                              maxPerPage={activeLayout.count}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="whitespace-normal break-words text-pretty font-medium text-slate-900 dark:text-white">
                                {displayName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {formatKes(item.current_sell_price)} · {item.category_name}
                                {aisleLabel && <span className="ml-1">· {aisleLabel}</span>}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Print preview */}
            <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden print:hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <Scissors className="h-4 w-4 text-primary" />
                    Preview
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg">
                      {isThermal
                        ? '90×43 mm row'
                        : pageOrientation === 'landscape'
                          ? 'Landscape'
                          : 'Portrait'}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg">
                      {activeLayout.count} per {isThermal ? 'row' : 'page'}
                      {!isThermal && (
                        <span className="text-slate-400">
                          {' '}
                          · {activeLayout.cols}×{activeLayout.rows}
                        </span>
                      )}
                    </span>
                    {!isThermal && roundStickers && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                        <Circle className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                        Round
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewExpanded(true)}
                      className="h-9 rounded-lg border-slate-200 dark:border-slate-700"
                    >
                      <Maximize2 className="w-4 h-4 mr-1.5" />
                      {isThermal ? 'Expand preview' : 'Expand to A4'}
                    </Button>
                  </div>
                </div>
                <div
                  className="border-2 border-dashed border-slate-200 dark:border-slate-700/80 p-4 bg-slate-50/50 dark:bg-slate-900/20"
                  style={{
                    aspectRatio: pageSize.aspectRatio,
                    maxHeight: isThermal ? '220px' : pageOrientation === 'landscape' ? '320px' : '420px',
                  }}
                >
                  <div
                    className="grid h-full w-full overflow-hidden"
                    style={previewGridStyle}
                  >
                    {Array.from({ length: activeLayout.count }).map((_, i) => {
                      const item = selectedItems[i];
                      const pv = sheetMetrics.preview;
                      return (
                        <LabelSheetCell
                          key={i}
                          round={!isThermal && roundStickers}
                          mode="preview"
                          sheetMetrics={sheetMetrics}
                        >
                          {item ? (
                            <StickerLabelBlock
                              item={item}
                              sm={sheetMetrics}
                              mode="preview"
                              showBarcode={showBarcode}
                              showBatchNumber={showBatchNumber}
                              showWebsiteLink={showWebsiteLink}
                              showPhoneNumber={showPhoneNumber}
                              round={!isThermal && roundStickers}
                            />
                          ) : !isThermal && roundStickers ? (
                            <div className="flex h-full min-h-0 w-full items-center justify-center">
                              <span
                                className="text-slate-300 dark:text-slate-600"
                                style={{ fontSize: `${pv.title}px` }}
                              >
                                —
                              </span>
                            </div>
                          ) : (
                            <span
                              className="text-slate-300 dark:text-slate-600"
                              style={{ fontSize: `${pv.title}px` }}
                            >
                              —
                            </span>
                          )}
                        </LabelSheetCell>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Printable area - hidden on screen, shown when printing */}
        <div id="price-stickers-print" className="hidden print:block">
          {Array.from({
            length: Math.ceil(selectedItems.length / activeLayout.count) || 1,
          }).map((_, pageIndex) => (
            <div
              key={pageIndex}
              className="page-break-after"
              style={{
                width: `${pageSize.width}mm`,
                maxWidth: `${pageSize.width}mm`,
                height: `${pageSize.height}mm`,
                padding: sheetMetrics.pagePadding,
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <div className="grid w-full h-full overflow-hidden" style={printGridStyle}>
                {Array.from({ length: activeLayout.count }).map((_, i) => {
                  const item = selectedItems[pageIndex * activeLayout.count + i];
                  const sm = sheetMetrics;
                  const round = !isThermal && roundStickers;
                  return (
                    <LabelSheetCell key={i} round={round} mode="print" sheetMetrics={sm}>
                      {item ? (
                        <StickerLabelBlock
                          item={item}
                          sm={sm}
                          mode="print"
                          showBarcode={showBarcode}
                          showBatchNumber={showBatchNumber}
                          showWebsiteLink={showWebsiteLink}
                          showPhoneNumber={showPhoneNumber}
                          round={round}
                        />
                      ) : round ? (
                        <div className="flex h-full min-h-0 w-full items-center justify-center">
                          <span className="text-slate-300" style={{ fontSize: `${sm.emptyPt}pt` }}>
                            —
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300" style={{ fontSize: `${sm.emptyPt}pt` }}>
                          —
                        </span>
                      )}
                    </LabelSheetCell>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full A4 preview drawer - slides in from right */}
      <Drawer open={previewExpanded} onOpenChange={setPreviewExpanded} direction="right">
        <DrawerContent className="!w-full sm:!w-[min(95vw,900px)] !max-w-none h-full max-h-screen flex flex-col border-l">
          <DrawerHeader className="shrink-0 border-b border-border bg-background p-4 pr-12">
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="absolute right-4 top-4">
                <X className="w-5 h-5" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
            <DrawerTitle className="text-foreground">
              {isThermal
                ? 'Thermal roll preview · 43×43 mm · 2 per row'
                : `Full A4 preview · ${pageOrientation === 'landscape' ? 'Landscape' : 'Portrait'}`}
            </DrawerTitle>
          </DrawerHeader>
          <div
            ref={a4ContainerRef}
            className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden"
          >
            <div
              className="border-2 border-slate-200 dark:border-slate-700 bg-white shadow-2xl origin-center"
              style={{
                width: `${pageSize.width}mm`,
                height: `${pageSize.height}mm`,
                padding: sheetMetrics.pagePadding,
                boxSizing: 'border-box',
                transform: `scale(${a4Scale})`,
              }}
            >
              <div
                className="grid w-full h-full overflow-hidden"
                style={printGridStyle}
              >
                {Array.from({ length: activeLayout.count }).map((_, i) => {
                  const item = selectedItems[i];
                  const sm = sheetMetrics;
                  const round = !isThermal && roundStickers;
                  return (
                    <LabelSheetCell key={i} round={round} mode="print" sheetMetrics={sm}>
                      {item ? (
                        <StickerLabelBlock
                          item={item}
                          sm={sm}
                          mode="print"
                          showBarcode={showBarcode}
                          showBatchNumber={showBatchNumber}
                          showWebsiteLink={showWebsiteLink}
                          showPhoneNumber={showPhoneNumber}
                          round={round}
                        />
                      ) : round ? (
                        <div className="flex h-full min-h-0 w-full items-center justify-center">
                          <span className="text-slate-300" style={{ fontSize: `${sm.emptyPt}pt` }}>
                            —
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300" style={{ fontSize: `${sm.emptyPt}pt` }}>
                          —
                        </span>
                      )}
                    </LabelSheetCell>
                  );
                })}
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Override @page for A4 when printing from this page */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${pageSize.pageSizeCss};
                margin: 0;
              }
              #price-stickers-print img {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          `,
        }}
      />
    </AdminLayout>
  );
}
