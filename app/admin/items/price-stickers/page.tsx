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
  { cols: 3, rows: 7, count: 21, label: '21 labels (3×7)' },
  { cols: 3, rows: 4, count: 12, label: '12 labels (3×4)' },
] as const;

type LabelLayout = (typeof LABEL_LAYOUTS)[number];

/** Tighter row gaps, shorter cell padding, and slightly smaller type as layouts get denser. */
function getLabelSheetMetrics(layout: LabelLayout) {
  const huge = layout.count <= 2;
  const veryTight = layout.count >= 48;
  const tight = layout.rows >= 7 || layout.count >= 36;
  const colGap = '4mm';
  const rowGap = huge ? '5mm' : veryTight ? '2mm' : tight ? '2.5mm' : '3mm';
  const pagePadding = huge ? '7mm 8mm' : veryTight ? '4mm 5mm' : tight ? '4.5mm 5mm' : '5mm';
  const cellPadding = huge ? '3mm 4mm' : veryTight ? '1mm 1.5mm' : tight ? '1.25mm 2mm' : '1.75mm 2.25mm';
  const titleLineHeight = huge ? 1.18 : veryTight ? 1.12 : tight ? 1.15 : 1.2;
  /** Cap logo height; width is 100% of cell — sized for at-a-glance readability on real labels. */
  const logoMaxHeightMm = huge ? 42 : veryTight ? 18 : tight ? 22.5 : 27;
  return {
    colGap,
    rowGap,
    pagePadding,
    cellPadding,
    alignTop: tight && !huge,
    logoMaxHeightMm,
    titlePt: huge ? 16 : veryTight ? 7.5 : tight ? 8.5 : 10,
    titleLineHeight,
    pricePt: huge ? 24 : veryTight ? 11 : tight ? 12.5 : 14,
    metaPt: huge ? 11 : veryTight ? 6.5 : tight ? 7.5 : 8,
    batchPt: huge ? 8 : veryTight ? 5 : tight ? 5.5 : 6,
    barcodePt: huge ? 10 : veryTight ? 6 : tight ? 7 : 8,
    stackGapPt: huge ? 2.8 : veryTight ? 0.75 : tight ? 1.25 : 2,
    emptyPt: huge ? 16 : veryTight ? 8 : 10,
    preview: {
      cellPad: huge ? 10 : veryTight ? 2 : tight ? 3 : 4,
      stackGapPx: huge ? 8 : veryTight ? 1.5 : tight ? 2 : 3,
      logoMaxPx: huge ? 180 : veryTight ? 66 : tight ? 84 : 102,
      title: huge ? 12 : veryTight ? 4.5 : tight ? 5 : 6,
      price: huge ? 16 : veryTight ? 6 : tight ? 7 : 8,
      meta: huge ? 8.5 : veryTight ? 3.5 : tight ? 4 : 5,
      batch: huge ? 7 : veryTight ? 3 : tight ? 3.5 : 4,
      barcode: huge ? 8 : veryTight ? 3.5 : tight ? 4 : 5,
      titleLh: titleLineHeight,
    },
  };
}

/** Urban Basket Mini Mart — shared asset + on-brand sticker styling */
const UB_LOGO = '/images/ub.png' as const;
const WEBSITE_DISPLAY = 'urbanbasket.co.ke' as const;
const WEBSITE_HREF = 'https://urbanbasket.co.ke' as const;
/** Local format on sticker; tel: uses Kenya country code (drop leading 0). */
const PHONE_DISPLAY = '0113277767' as const;
const PHONE_DISPLAY_SPACED = '0113 277 767' as const;
const PHONE_HREF = 'tel:+254113277767' as const;
const UB_STICKER_SCREEN =
  'border-2 border-primary/12 dark:border-primary/20 bg-gradient-to-b from-primary/[0.04] via-card to-card dark:from-primary/10 dark:via-card dark:to-card shadow-sm';
const UB_STICKER_PRINT =
  'border border-primary/30 bg-gradient-to-b from-primary/[0.05] to-card';

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
  sheetMetrics: ReturnType<typeof getLabelSheetMetrics>;
  children: ReactNode;
}) {
  const pv = sheetMetrics.preview;
  if (round) {
    return (
      <div className="grid h-full w-full min-h-0 min-w-0 [container-type:size] place-items-center p-0.5">
        <div
          className={cn(
            'flex min-h-0 w-full min-w-0 flex-col justify-start overflow-hidden rounded-full',
            mode === 'preview' ? UB_STICKER_SCREEN : UB_STICKER_PRINT
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
        'flex h-full min-h-0 w-full min-w-0 flex-col justify-start overflow-hidden rounded-sm',
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

function stackPad(t: number) {
  return Math.max(0.35, t * 0.45);
}

/** Grocery “shelf buster” price — scannable, print-friendly, on-brand */
function StickerPriceCallout({
  price,
  sm,
  mode,
  marginTopPreviewPx,
  marginTopPrintPt,
  round = false,
}: {
  price: number | null | undefined;
  sm: ReturnType<typeof getLabelSheetMetrics>;
  mode: 'preview' | 'print';
  marginTopPreviewPx: number;
  marginTopPrintPt: number;
  round?: boolean;
}) {
  const n = Number(price);
  const safePrice = Number.isFinite(n) ? n : 0;
  const amount = formatKesAmount(safePrice);
  const label = 'Each';
  const fullLabel = formatKes(safePrice);

  if (mode === 'preview') {
    const p = sm.preview;
    if (round) {
      const eachSize = Math.max(6, p.price * 0.32);
      const kesSize = Math.max(7, p.price * 0.45);
      const numSize = Math.max(10, p.price * 1.2);
      return (
        <div
          className="w-full max-w-full shrink-0"
          style={{ marginTop: marginTopPreviewPx }}
          aria-label={fullLabel}
          role="group"
        >
          <div className="border border-primary/25 bg-gradient-to-b from-primary/[0.08] to-primary/[0.02] px-2 py-1.5 shadow-[inset_0_1px_0_0_hsl(0_0%_100%_/_0.5)] [box-shadow:0_1px_3px_hsl(0_0%_0%_/_0.06)] dark:border-primary/30 dark:from-primary/15 dark:to-primary/5 [border-radius:9999px]">
            <p
              className="text-center font-extrabold uppercase leading-tight text-primary"
              style={{ fontSize: `${eachSize}px`, letterSpacing: '0.12em' }}
            >
              {label}
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline justify-center gap-1">
              <span className="shrink-0 font-bold text-primary" style={{ fontSize: `${kesSize}px` }}>
                KES
              </span>
              <span
                className="shrink-0 font-black tabular-nums leading-none text-primary"
                style={{ fontSize: `${numSize}px` }}
              >
                {amount}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div
        className="w-full shrink-0 overflow-hidden rounded-md border border-primary/25 bg-card/90 shadow-sm dark:bg-card/80"
        style={{ marginTop: marginTopPreviewPx }}
        aria-label={fullLabel}
        role="group"
      >
        <div
          className="bg-primary py-[3px] text-center font-extrabold uppercase tracking-[0.22em] text-primary-foreground"
          style={{ fontSize: `${Math.max(7, p.price * 0.38)}px` }}
        >
          {label}
        </div>
        <div className="flex flex-wrap items-baseline justify-center gap-0.5 bg-primary/[0.04] px-1 py-1 dark:bg-primary/10">
          <span
            className="shrink-0 font-bold text-primary"
            style={{ fontSize: `${Math.max(8, p.price * 0.5)}px` }}
          >
            KES
          </span>
          <span
            className="shrink-0 font-black tabular-nums leading-none tracking-tight text-primary drop-shadow-[0_1px_0_hsl(0_0%_100%_/_0.15)]"
            style={{ fontSize: `${Math.max(11, p.price * 1.38)}px` }}
          >
            {amount}
          </span>
        </div>
      </div>
    );
  }

  const ribbonPt = sm.pricePt * 0.4;
  const kesPt = sm.pricePt * 0.55;
  const numPt = sm.pricePt * 1.4;
  const padY = sm.stackGapPt * 0.5;
  const eachSmallPt = sm.pricePt * 0.32;

  if (round) {
    return (
      <div
        className="w-full max-w-full shrink-0 [border-radius:9999px] border border-primary/30 bg-gradient-to-b from-primary/10 to-primary/[0.04] print:border-primary/35 print:from-primary/12 print:to-primary/5"
        style={{
          marginTop: marginTopPrintPt,
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.05)',
          paddingTop: `${stackPad(sm.stackGapPt) * 1.1}pt`,
          paddingBottom: `${stackPad(sm.stackGapPt) * 1.1}pt`,
          paddingLeft: '2.5pt',
          paddingRight: '2.5pt',
        }}
        aria-label={fullLabel}
        role="group"
      >
        <p
          className="text-center font-extrabold uppercase leading-tight [letter-spacing:0.15em] text-primary print:text-primary"
          style={{ fontSize: `${eachSmallPt}pt` }}
        >
          {label}
        </p>
        <div
          className="mt-0.5 flex flex-wrap items-baseline justify-center"
          style={{ gap: `${sm.stackGapPt * 0.9}pt` }}
        >
          <span
            className="shrink-0 font-bold text-primary print:text-primary"
            style={{ fontSize: `${kesPt}pt` }}
          >
            KES
          </span>
          <span
            className="shrink-0 font-black tabular-nums text-primary print:text-primary"
            style={{ fontSize: `${numPt * 0.95}pt` }}
          >
            {amount}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full shrink-0 overflow-hidden rounded-sm border-2 border-primary print:rounded-sm print:border-primary"
      style={{ marginTop: marginTopPrintPt }}
      aria-label={fullLabel}
      role="group"
    >
      <div
        className="border-b-2 border-primary bg-primary text-center font-extrabold uppercase [letter-spacing:0.18em] text-primary-foreground print:border-primary print:bg-white print:text-primary"
        style={{
          fontSize: `${ribbonPt}pt`,
          paddingTop: `${padY}pt`,
          paddingBottom: `${padY}pt`,
        }}
      >
        {label}
      </div>
      <div
        className="flex flex-wrap items-baseline justify-center bg-primary/[0.04] print:bg-white"
        style={{
          paddingLeft: '1.5pt',
          paddingRight: '1.5pt',
          paddingTop: `${stackPad(sm.stackGapPt)}pt`,
          paddingBottom: `${stackPad(sm.stackGapPt)}pt`,
          columnGap: `${sm.stackGapPt}pt`,
          rowGap: '0.25pt',
        }}
      >
        <span
          className="shrink-0 font-bold text-primary print:text-primary"
          style={{ fontSize: `${kesPt}pt` }}
        >
          KES
        </span>
        <span
          className="shrink-0 font-black tabular-nums leading-none text-primary print:text-primary"
          style={{ fontSize: `${numPt}pt` }}
        >
          {amount}
        </span>
      </div>
    </div>
  );
}

/**
 * Urban Basket contact card: icon chip + value rows with a subtle branded
 * flourish. Designed to read cleanly on both rectangular and round stickers,
 * in screen preview and on the printed sheet.
 */
function StickerContactFooter({
  sm,
  mode,
  showWebsiteLink,
  showPhoneNumber,
  round,
}: {
  sm: ReturnType<typeof getLabelSheetMetrics>;
  mode: 'preview' | 'print';
  showWebsiteLink: boolean;
  showPhoneNumber: boolean;
  round: boolean;
}) {
  if (!showWebsiteLink && !showPhoneNumber) return null;
  const bothShown = showWebsiteLink && showPhoneNumber;

  if (mode === 'preview') {
    const pv = sm.preview;
    const scale = round ? 0.82 : 1;
    const valuePx = Math.max(8, pv.meta * 0.95 * scale);
    const chipPx = Math.max(11, Math.round(valuePx * 1.55));
    const iconInnerPx = Math.max(5, Math.round(chipPx * 0.58));
    const gapPx = Math.max(3, Math.round(valuePx * 0.42));
    const padYPx = Math.max(4, Math.round(pv.stackGapPx * (round ? 0.5 : 0.62)));
    const padXPx = round
      ? Math.max(10, Math.round(pv.stackGapPx * 1.6))
      : Math.max(6, Math.round(pv.stackGapPx * 0.8));
    const rowGapPx = Math.max(2, Math.round(pv.stackGapPx * 0.5));
    const radiusClass = round ? 'rounded-full' : 'rounded-[7px]';

    const row = (kind: 'web' | 'phone') => {
      const Icon = kind === 'web' ? Globe : Phone;
      const href = kind === 'web' ? WEBSITE_HREF : PHONE_HREF;
      const value = kind === 'web' ? WEBSITE_DISPLAY : PHONE_DISPLAY_SPACED;
      const valueCls =
        kind === 'web'
          ? 'min-w-0 truncate font-extrabold tracking-tight text-primary [overflow-wrap:anywhere] underline-offset-2 hover:underline'
          : 'min-w-0 font-extrabold tabular-nums tracking-tight text-primary';
      return (
        <div
          className="flex min-w-0 max-w-full items-center justify-center"
          style={{ gap: `${gapPx}px` }}
        >
          <span
            aria-hidden
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-inset ring-white/25 [box-shadow:0_1px_0_0_hsl(0_0%_100%_/_0.35)_inset,0_1px_1.5px_0_hsl(var(--primary)/0.25)]"
            style={{ width: `${chipPx}px`, height: `${chipPx}px` }}
          >
            <Icon
              style={{ width: `${iconInnerPx}px`, height: `${iconInnerPx}px` }}
              strokeWidth={2.6}
            />
          </span>
          <a
            href={href}
            {...(kind === 'web' ? { target: '_blank', rel: 'noopener noreferrer' } : null)}
            className={valueCls}
            style={{ fontSize: `${valuePx}px`, lineHeight: 1.2 }}
          >
            {value}
          </a>
        </div>
      );
    };

    return (
      <div
        className={cn(
          'relative w-full min-w-0 shrink-0 overflow-hidden border border-primary/30 text-primary',
          'bg-gradient-to-b from-primary/[0.11] via-primary/[0.06] to-primary/[0.09] dark:border-primary/40 dark:from-primary/20 dark:via-primary/10 dark:to-primary/15',
          '[box-shadow:inset_0_0.5px_0_0_hsl(0_0%_100%_/_0.55),0_1px_0_0_hsl(var(--primary)/0.15)]',
          radiusClass,
        )}
        style={{
          marginTop: `${Math.max(pv.stackGapPx, 4)}px`,
          padding: `${padYPx}px ${padXPx}px`,
        }}
        role="group"
        aria-label="Store contact details"
      >
        {!round && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 mx-auto block h-[2px] w-6 max-w-full rounded-b-full bg-primary/45"
          />
        )}
        <div
          className="flex min-w-0 flex-col items-center"
          style={{ gap: `${rowGapPx}px` }}
        >
          {showWebsiteLink && row('web')}
          {bothShown && (
            <span
              aria-hidden
              className="h-px w-10 max-w-[70%] bg-gradient-to-r from-transparent via-primary/45 to-transparent"
            />
          )}
          {showPhoneNumber && row('phone')}
        </div>
      </div>
    );
  }

  const scale = round ? 0.82 : 1;
  const valuePt = Math.max(5.5, sm.batchPt * 1.0 * scale);
  const chipPt = Math.max(7, valuePt * 1.5);
  const iconInnerPt = chipPt * 0.58;
  const gapPt = valuePt * 0.38;
  const padYPt = sm.stackGapPt * (round ? 0.5 : 0.65);
  const padXPt = sm.stackGapPt * (round ? 1.5 : 0.95);
  const rowGapPt = sm.stackGapPt * 0.5;
  const radiusClass = round ? 'rounded-[9999px]' : 'rounded-[3pt]';

  const rowPrint = (kind: 'web' | 'phone') => {
    const Icon = kind === 'web' ? Globe : Phone;
    const href = kind === 'web' ? WEBSITE_HREF : PHONE_HREF;
    const value = kind === 'web' ? WEBSITE_DISPLAY : PHONE_DISPLAY_SPACED;
    const valueCls =
      kind === 'web'
        ? 'min-w-0 font-extrabold tracking-tight text-primary [overflow-wrap:anywhere] print:text-primary'
        : 'min-w-0 font-extrabold tabular-nums tracking-tight text-primary print:text-primary';
    return (
      <div
        className="flex min-w-0 max-w-full items-center justify-center"
        style={{ gap: `${gapPt}pt` }}
      >
        <span
          aria-hidden
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground print:bg-primary print:text-primary-foreground"
          style={{ width: `${chipPt}pt`, height: `${chipPt}pt` }}
        >
          <Icon
            style={{ width: `${iconInnerPt}pt`, height: `${iconInnerPt}pt` }}
            strokeWidth={2.8}
          />
        </span>
        <a
          href={href}
          className={valueCls}
          style={{
            fontSize: `${valuePt}pt`,
            lineHeight: 1.15,
            ...(kind === 'web' ? { wordBreak: 'break-all' as const } : null),
          }}
        >
          {value}
        </a>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'relative w-full min-w-0 shrink-0 overflow-hidden border border-primary/35 bg-primary/[0.08] text-primary print:border-primary/40 print:bg-primary/[0.1]',
        radiusClass,
      )}
      style={{
        marginTop: `${sm.stackGapPt}pt`,
        padding: `${padYPt}pt ${padXPt}pt`,
      }}
      role="group"
      aria-label="Store contact details"
    >
      {!round && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto block h-[0.8pt] w-[14pt] max-w-full bg-primary/50 print:bg-primary/50"
        />
      )}
      <div
        className="flex min-w-0 flex-col items-center"
        style={{ gap: `${rowGapPt}pt` }}
      >
        {showWebsiteLink && rowPrint('web')}
        {bothShown && (
          <span
            aria-hidden
            className="h-[0.5pt] w-[28pt] max-w-[75%] bg-primary/45 print:bg-primary/45"
          />
        )}
        {showPhoneNumber && rowPrint('phone')}
      </div>
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
  sm: ReturnType<typeof getLabelSheetMetrics>;
  mode: 'preview' | 'print';
  showBarcode: boolean;
  showBatchNumber: boolean;
  showWebsiteLink: boolean;
  showPhoneNumber: boolean;
  round?: boolean;
}) {
  const displayName = getItemDisplayName(item.name, item.variant_name);

  const priceVal = item.current_sell_price;
  const logoBand = round ? '28%' : '33%';

  if (mode === 'preview') {
    const pv = sm.preview;
    const nameLines = round ? 2 : 3;
    const nameMaxPx = nameLines * pv.title * pv.titleLh;
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
        {/* Logo — fixed proportion band */}
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
            alt="Urban Basket"
            className="pointer-events-none block h-full max-h-full w-full max-w-full select-none object-contain object-center"
            draggable={false}
          />
        </div>
        {/* Name — hard height cap so it can never push price out of view */}
        <div
          className="w-full shrink-0 overflow-hidden"
          style={{ maxHeight: `${nameMaxPx}px` }}
        >
          <p
            className="w-full min-w-0 break-words font-semibold text-foreground"
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
        {/* Price, meta, contact — always rendered after name, clipped at sticker edge */}
        <div className="flex w-full min-w-0 shrink-0 flex-col">
          <StickerPriceCallout
            price={priceVal}
            sm={sm}
            mode="preview"
            marginTopPreviewPx={pv.stackGapPx}
            marginTopPrintPt={0}
            round={round}
          />
          {showBatchNumber && (item as ItemWithCategory).batch_number && (
            <p
              className="w-full min-w-0 break-words font-normal text-muted-foreground"
              style={{ fontSize: `${pv.batch}px`, marginTop: `${pv.stackGapPx}px` }}
            >
              Batch number {(item as ItemWithCategory).batch_number}
            </p>
          )}
          {showBarcode && item.barcode && (
            <p
              className="w-full min-w-0 break-all font-mono text-muted-foreground"
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
            round={round}
          />
        </div>
      </div>
    );
  }

  const nameLinesPrint = round ? 2 : 3;
  const nameMaxPt = nameLinesPrint * sm.titlePt * sm.titleLineHeight;
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      {/* Logo */}
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
          alt="Urban Basket"
          className="block h-full max-h-full w-full max-w-full object-contain object-center"
        />
      </div>
      {/* Name — explicitly capped so price is never pushed out */}
      <div
        className="w-full shrink-0 overflow-hidden"
        style={{ maxHeight: `${nameMaxPt}pt` }}
      >
        <p
          className="w-full min-w-0 break-words font-semibold text-foreground [overflow-wrap:anywhere]"
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
      {/* Price, meta, contact */}
      <div className="flex w-full min-w-0 shrink-0 flex-col">
        <StickerPriceCallout
          price={priceVal}
          sm={sm}
          mode="print"
          marginTopPreviewPx={0}
          marginTopPrintPt={sm.stackGapPt}
          round={round}
        />
        {showBatchNumber && (item as ItemWithCategory).batch_number && (
          <p
            className="w-full min-w-0 break-words text-muted-foreground"
            style={{ fontSize: `${sm.batchPt}pt`, marginTop: `${sm.stackGapPt}pt` }}
          >
            Batch number {(item as ItemWithCategory).batch_number}
          </p>
        )}
        {showBarcode && item.barcode && (
          <p
            className="w-full min-w-0 break-all font-mono text-muted-foreground"
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
          round={round}
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

  const sheetMetrics = useMemo(() => getLabelSheetMetrics(labelLayout), [labelLayout]);

  const pageSize = useMemo(() => {
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
  }, [pageOrientation]);

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
        if ((prev[i.id] ?? 0) > 0) next[i.id] = labelLayout.count;
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
                    alt="Urban Basket Mini Mart"
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
                  <p className="mt-0.5 text-sm font-medium text-primary">
                    Urban Basket · A4 label sheets · Cut and stick
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
                <div
                  className="w-full min-w-0 sm:w-auto sm:max-w-[min(100%,24rem)] rounded-xl border border-primary/20 bg-primary/[0.04] p-3 shadow-sm dark:border-primary/30 dark:bg-primary/[0.08]"
                  role="group"
                  aria-label="Contact details to show on price stickers"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary/80 dark:text-primary/70">
                    Contact on labels
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-1.5 -m-1.5 transition-colors',
                        'hover:border-border hover:bg-background/80 dark:hover:bg-background/20',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={showWebsiteLink}
                        onChange={(e) => setShowWebsiteLink(e.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-2 border-input text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Globe
                            className="h-4 w-4 shrink-0 text-primary"
                            strokeWidth={2.2}
                            aria-hidden
                          />
                          Website
                        </span>
                        <span
                          className="mt-0.5 block pl-6 text-xs font-medium text-primary tabular-nums"
                          title={WEBSITE_HREF}
                        >
                          {WEBSITE_DISPLAY}
                        </span>
                      </span>
                    </label>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-1.5 -m-1.5 transition-colors',
                        'hover:border-border hover:bg-background/80 dark:hover:bg-background/20',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={showPhoneNumber}
                        onChange={(e) => setShowPhoneNumber(e.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-2 border-input text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Phone
                            className="h-4 w-4 shrink-0 text-primary"
                            strokeWidth={2.2}
                            aria-hidden
                          />
                          Phone
                        </span>
                        <span
                          className="mt-0.5 block pl-6 text-xs font-medium text-primary tabular-nums"
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
                              maxPerPage={labelLayout.count}
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
                      {pageOrientation === 'landscape' ? 'Landscape' : 'Portrait'}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg">
                      {labelLayout.count} per page
                    </span>
                    {roundStickers && (
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
                      Expand to A4
                    </Button>
                  </div>
                </div>
                <div
                  className="border-2 border-dashed border-slate-200 dark:border-slate-700/80 p-4 bg-slate-50/50 dark:bg-slate-900/20"
                  style={{
                    aspectRatio: pageSize.aspectRatio,
                    maxHeight: pageOrientation === 'landscape' ? '320px' : '420px',
                  }}
                >
                  <div
                    className="grid h-full w-full overflow-hidden"
                    style={{
                      gridTemplateColumns: `repeat(${labelLayout.cols}, 1fr)`,
                      gridTemplateRows: `repeat(${labelLayout.rows}, 1fr)`,
                      columnGap: sheetMetrics.colGap,
                      rowGap: sheetMetrics.rowGap,
                    }}
                  >
                    {Array.from({ length: labelLayout.count }).map((_, i) => {
                      const item = selectedItems[i];
                      const pv = sheetMetrics.preview;
                      return (
                        <LabelSheetCell
                          key={i}
                          round={roundStickers}
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
                              round={roundStickers}
                            />
                          ) : roundStickers ? (
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
            length: Math.ceil(selectedItems.length / labelLayout.count) || 1,
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
              <div
                className="grid w-full h-full overflow-hidden"
                style={{
                  gridTemplateColumns: `repeat(${labelLayout.cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${labelLayout.rows}, minmax(0, 1fr))`,
                  columnGap: sheetMetrics.colGap,
                  rowGap: sheetMetrics.rowGap,
                  boxSizing: 'border-box',
                }}
              >
                {Array.from({ length: labelLayout.count }).map((_, i) => {
                  const item = selectedItems[pageIndex * labelLayout.count + i];
                  const sm = sheetMetrics;
                  return (
                    <LabelSheetCell key={i} round={roundStickers} mode="print" sheetMetrics={sm}>
                      {item ? (
                        <StickerLabelBlock
                          item={item}
                          sm={sm}
                          mode="print"
                          showBarcode={showBarcode}
                          showBatchNumber={showBatchNumber}
                          showWebsiteLink={showWebsiteLink}
                          showPhoneNumber={showPhoneNumber}
                          round={roundStickers}
                        />
                      ) : roundStickers ? (
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
              Full A4 preview · Urban Basket · {pageOrientation === 'landscape' ? 'Landscape' : 'Portrait'}
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
                style={{
                  gridTemplateColumns: `repeat(${labelLayout.cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${labelLayout.rows}, minmax(0, 1fr))`,
                  columnGap: sheetMetrics.colGap,
                  rowGap: sheetMetrics.rowGap,
                  boxSizing: 'border-box',
                }}
              >
                {Array.from({ length: labelLayout.count }).map((_, i) => {
                  const item = selectedItems[i];
                  const sm = sheetMetrics;
                  return (
                    <LabelSheetCell key={i} round={roundStickers} mode="print" sheetMetrics={sm}>
                      {item ? (
                        <StickerLabelBlock
                          item={item}
                          sm={sm}
                          mode="print"
                          showBarcode={showBarcode}
                          showBatchNumber={showBatchNumber}
                          showWebsiteLink={showWebsiteLink}
                          showPhoneNumber={showPhoneNumber}
                          round={roundStickers}
                        />
                      ) : roundStickers ? (
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
