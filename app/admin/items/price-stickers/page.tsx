'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
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
  LayoutGrid,
  Scissors,
  Minus,
  Plus,
  Maximize2,
  X,
  RectangleVertical,
  RectangleHorizontal,
} from 'lucide-react';
import type { Item, Category } from '@/lib/db/types';
import { getItemDisplayName } from '@/lib/utils';
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

const LABEL_LAYOUTS = [
  { cols: 4, rows: 6, count: 24, label: '24 labels (4×6)' },
  { cols: 6, rows: 6, count: 36, label: '36 labels (6×6)' },
  { cols: 6, rows: 8, count: 48, label: '48 labels (6×8)' },
  { cols: 3, rows: 7, count: 21, label: '21 labels (3×7)' },
  { cols: 3, rows: 4, count: 12, label: '12 labels (3×4)' },
] as const;

type LabelLayout = (typeof LABEL_LAYOUTS)[number];

/** Tighter row gaps, shorter cell padding, and slightly smaller type as layouts get denser. */
function getLabelSheetMetrics(layout: LabelLayout) {
  const veryTight = layout.count >= 48;
  const tight = layout.rows >= 7 || layout.count >= 36;
  const colGap = '4mm';
  const rowGap = veryTight ? '2mm' : tight ? '2.5mm' : '3mm';
  const pagePadding = veryTight ? '4mm 5mm' : tight ? '4.5mm 5mm' : '5mm';
  const cellPadding = veryTight ? '1mm 1.5mm' : tight ? '1.25mm 2mm' : '1.75mm 2.25mm';
  const titleLineHeight = veryTight ? 1.12 : tight ? 1.15 : 1.2;
  return {
    colGap,
    rowGap,
    pagePadding,
    cellPadding,
    alignTop: tight,
    titlePt: veryTight ? 7.5 : tight ? 8.5 : 10,
    titleLineHeight,
    pricePt: veryTight ? 11 : tight ? 12.5 : 14,
    metaPt: veryTight ? 6.5 : tight ? 7.5 : 8,
    batchPt: veryTight ? 5 : tight ? 5.5 : 6,
    barcodePt: veryTight ? 6 : tight ? 7 : 8,
    stackGapPt: veryTight ? 0.75 : tight ? 1.25 : 2,
    emptyPt: veryTight ? 8 : 10,
    preview: {
      cellPad: veryTight ? 2 : tight ? 3 : 4,
      stackGapPx: veryTight ? 1.5 : tight ? 2 : 3,
      title: veryTight ? 4.5 : tight ? 5 : 6,
      price: veryTight ? 6 : tight ? 7 : 8,
      meta: veryTight ? 3.5 : tight ? 4 : 5,
      batch: veryTight ? 3 : tight ? 3.5 : 4,
      barcode: veryTight ? 3.5 : tight ? 4 : 5,
      titleLh: titleLineHeight,
    },
  };
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
  const [showBarcode, setShowBarcode] = useState(true);
  const [showBatchNumber, setShowBatchNumber] = useState(true);
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

  const formatPrice = (p: number) => `KES ${p.toFixed(0)}`;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="px-4 md:px-8 py-6">
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center shadow-xl shadow-slate-900/20 ring-1 ring-slate-700/50">
                  <LayoutGrid className="w-7 h-7 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Price Stickers
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    A4 label sheets · Cut and stick
                  </p>
                </div>
              </div>
              <Button
                onClick={printStickers}
                disabled={selectedItems.length === 0}
                className="h-12 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-lg shadow-slate-900/25 disabled:opacity-50 disabled:shadow-none transition-all"
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
                        ? 'bg-slate-800 hover:bg-slate-700 text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50'
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
                            ? 'bg-slate-800 hover:bg-slate-700 text-white shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50'
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
                            className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors ${
                              qty > 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                            }`}
                          >
                            <QuantityStepper
                              value={qty}
                              onChange={(n) => setQuantity(item.id, n)}
                              maxPerPage={labelLayout.count}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 dark:text-white truncate">
                                {displayName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {formatPrice(item.current_sell_price)} · {item.category_name}
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
                  <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-slate-500" />
                    Preview
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg">
                      {pageOrientation === 'landscape' ? 'Landscape' : 'Portrait'}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg">
                      {labelLayout.count} per page
                    </span>
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
                        <div
                          key={i}
                          className={`border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex flex-col shadow-sm ${
                            sheetMetrics.alignTop ? 'justify-start' : 'justify-center'
                          }`}
                          style={{ padding: `${pv.cellPad}px` }}
                        >
                          {item ? (
                            <>
                              <p
                                className="font-semibold break-words text-slate-900 dark:text-slate-100"
                                style={{
                                  fontSize: `${pv.title}px`,
                                  lineHeight: pv.titleLh,
                                }}
                              >
                                {getItemDisplayName(item.name, item.variant_name)}
                              </p>
                              <p
                                className="text-[#1c6a1e] font-bold shrink-0"
                                style={{ fontSize: `${pv.price}px`, marginTop: `${pv.stackGapPx}px` }}
                              >
                                {formatPrice(item.current_sell_price)}
                              </p>
                              {getAisleLabel(item) && (
                                <p
                                  className="text-slate-500 shrink-0"
                                  style={{ fontSize: `${pv.meta}px`, marginTop: `${pv.stackGapPx}px` }}
                                >
                                  {getAisleLabel(item)}
                                </p>
                              )}
                              {showBatchNumber && (item as ItemWithCategory).batch_number && (
                                <p
                                  className="text-slate-500"
                                  style={{ fontSize: `${pv.batch}px`, marginTop: `${pv.stackGapPx}px` }}
                                >
                                  Batch number {(item as ItemWithCategory).batch_number}
                                </p>
                              )}
                              {showBarcode && item.barcode && (
                                <p
                                  className="font-mono text-slate-500 break-all"
                                  style={{ fontSize: `${pv.barcode}px`, marginTop: `${pv.stackGapPx}px` }}
                                >
                                  {item.barcode}
                                </p>
                              )}
                            </>
                          ) : (
                            <span
                              className="text-slate-300 dark:text-slate-600"
                              style={{ fontSize: `${pv.title}px` }}
                            >
                              —
                            </span>
                          )}
                        </div>
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
                    <div
                      key={i}
                      className={`border border-slate-400 flex flex-col bg-white overflow-hidden min-w-0 ${
                        sm.alignTop ? 'justify-start' : 'justify-center'
                      }`}
                      style={{
                        minHeight: 0,
                        boxSizing: 'border-box',
                        padding: sm.cellPadding,
                      }}
                    >
                      {item ? (
                        <>
                          <p
                            className="font-semibold text-slate-900 overflow-hidden shrink-0"
                            style={{
                              fontSize: `${sm.titlePt}pt`,
                              lineHeight: sm.titleLineHeight,
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                            }}
                          >
                            {getItemDisplayName(item.name, item.variant_name)}
                          </p>
                          <p
                            className="text-[#1c6a1e] font-bold shrink-0"
                            style={{ fontSize: `${sm.pricePt}pt`, marginTop: `${sm.stackGapPt}pt` }}
                          >
                            {formatPrice(item.current_sell_price)}
                          </p>
                          {getAisleLabel(item) && (
                            <p
                              className="text-slate-500 shrink-0"
                              style={{ fontSize: `${sm.metaPt}pt`, marginTop: `${sm.stackGapPt}pt` }}
                            >
                              {getAisleLabel(item)}
                            </p>
                          )}
                          {showBatchNumber && (item as ItemWithCategory).batch_number && (
                            <p
                              className="text-slate-500 shrink-0"
                              style={{
                                fontSize: `${sm.batchPt}pt`,
                                marginTop: `${sm.stackGapPt}pt`,
                              }}
                            >
                              Batch number {(item as ItemWithCategory).batch_number}
                            </p>
                          )}
                          {showBarcode && item.barcode && (
                            <p
                              className="font-mono text-slate-500 overflow-hidden shrink-0"
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
                        </>
                      ) : (
                        <span className="text-slate-300" style={{ fontSize: `${sm.emptyPt}pt` }}>
                          —
                        </span>
                      )}
                    </div>
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
          <DrawerHeader className="shrink-0 p-4 pr-12 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="absolute right-4 top-4">
                <X className="w-5 h-5" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
            <DrawerTitle>
              Full A4 preview · {pageOrientation === 'landscape' ? 'Landscape' : 'Portrait'}
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
                    <div
                      key={i}
                      className={`border border-slate-300 flex flex-col bg-white overflow-hidden min-w-0 ${
                        sm.alignTop ? 'justify-start' : 'justify-center'
                      }`}
                      style={{
                        minHeight: 0,
                        boxSizing: 'border-box',
                        padding: sm.cellPadding,
                      }}
                    >
                      {item ? (
                        <>
                          <p
                            className="font-semibold text-slate-900 overflow-hidden shrink-0"
                            style={{
                              fontSize: `${sm.titlePt}pt`,
                              lineHeight: sm.titleLineHeight,
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                            }}
                          >
                            {getItemDisplayName(item.name, item.variant_name)}
                          </p>
                          <p
                            className="text-[#1c6a1e] font-bold shrink-0"
                            style={{ fontSize: `${sm.pricePt}pt`, marginTop: `${sm.stackGapPt}pt` }}
                          >
                            {formatPrice(item.current_sell_price)}
                          </p>
                          {getAisleLabel(item) && (
                            <p
                              className="text-slate-500 shrink-0"
                              style={{ fontSize: `${sm.metaPt}pt`, marginTop: `${sm.stackGapPt}pt` }}
                            >
                              {getAisleLabel(item)}
                            </p>
                          )}
                          {showBatchNumber && (item as ItemWithCategory).batch_number && (
                            <p
                              className="text-slate-500 shrink-0"
                              style={{
                                fontSize: `${sm.batchPt}pt`,
                                marginTop: `${sm.stackGapPt}pt`,
                              }}
                            >
                              Batch number {(item as ItemWithCategory).batch_number}
                            </p>
                          )}
                          {showBarcode && item.barcode && (
                            <p
                              className="font-mono text-slate-500 overflow-hidden shrink-0"
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
                        </>
                      ) : (
                        <span className="text-slate-300" style={{ fontSize: `${sm.emptyPt}pt` }}>
                          —
                        </span>
                      )}
                    </div>
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
            }
          `,
        }}
      />
    </AdminLayout>
  );
}
