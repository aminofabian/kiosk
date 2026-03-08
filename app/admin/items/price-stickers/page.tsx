'use client';

import { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Printer,
  Package,
  Loader2,
  Search,
  FolderTree,
  Store,
  LayoutGrid,
  Scissors,
  Minus,
  Plus,
} from 'lucide-react';
import type { Item, Category } from '@/lib/db/types';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ItemWithCategory extends Item {
  category_name?: string;
  parent_name?: string;
  aisle?: string | null;
  aisle_number?: string | null;
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

const LABELS_PER_PAGE = 24; // 4 columns x 6 rows on A4
const LABEL_LAYOUTS = [
  { cols: 4, rows: 6, count: 24, label: '24 labels (4×6)' },
  { cols: 3, rows: 7, count: 21, label: '21 labels (3×7)' },
  { cols: 3, rows: 4, count: 12, label: '12 labels (3×4)' },
];

export default function PriceStickersPage() {
  const { productTypes } = useItemTypes();
  const [items, setItems] = useState<ItemWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('retail');
  const [aisleFilter, setAisleFilter] = useState<string>('all');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [labelLayout, setLabelLayout] = useState(LABEL_LAYOUTS[0]);
  const [showBarcode, setShowBarcode] = useState(true);

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
        const name = item.variant_name ? `${item.name} – ${item.variant_name}` : item.name;
        if (
          !name.toLowerCase().includes(q) &&
          !item.category_name?.toLowerCase().includes(q) &&
          !(item as Item & { aisle?: string }).aisle?.toLowerCase().includes(q)
        )
          return false;
      }
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
      if (aisleFilter !== 'all') {
        const aisle = (item as Item & { aisle?: string }).aisle?.trim();
        if (aisle !== aisleFilter) return false;
      }
      return true;
    });
  }, [items, searchQuery, selectedCategory, aisleFilter]);

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

  const selectedItems = useMemo(() => {
    const out: ItemWithCategory[] = [];
    filteredItems.forEach((item) => {
      const qty = quantities[item.id] ?? 0;
      for (let i = 0; i < qty; i++) out.push(item);
    });
    return out;
  }, [filteredItems, quantities]);

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
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px] h-9 rounded-lg border-slate-200/80 dark:border-slate-700/80">
                    <FolderTree className="w-4 h-4 mr-2 text-slate-500" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <label className="flex items-center gap-2.5 text-sm cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={showBarcode}
                    onChange={(e) => setShowBarcode(e.target.checked)}
                    className="rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                  />
                  Show barcode
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
                        const displayName = item.variant_name
                          ? `${item.name} – ${item.variant_name}`
                          : item.name;
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
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg">
                    {labelLayout.count} per page
                  </span>
                </div>
                <div
                  className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700/80 p-4 bg-slate-50/50 dark:bg-slate-900/20"
                  style={{
                    aspectRatio: '210/297',
                    maxHeight: '420px',
                  }}
                >
                  <div
                    className="grid h-full w-full rounded-lg overflow-hidden"
                    style={{
                      gridTemplateColumns: `repeat(${labelLayout.cols}, 1fr)`,
                      gridTemplateRows: `repeat(${labelLayout.rows}, 1fr)`,
                      gap: '4mm',
                    }}
                  >
                    {Array.from({ length: labelLayout.count }).map((_, i) => {
                      const item = selectedItems[i];
                      return (
                        <div
                          key={i}
                          className="border border-slate-200 dark:border-slate-700 rounded-md p-2 bg-white dark:bg-slate-900 text-[10px] overflow-hidden flex flex-col justify-center shadow-sm"
                        >
                          {item ? (
                            <>
                              <p className="font-semibold leading-tight break-words">
                                {item.variant_name ? `${item.name} – ${item.variant_name}` : item.name}
                              </p>
                              <p className="text-[#1c6a1e] font-bold">{formatPrice(item.current_sell_price)}</p>
                              {getAisleLabel(item) && (
                                <p className="text-[8px] text-slate-500 mt-0.5">{getAisleLabel(item)}</p>
                              )}
                              {showBarcode && item.barcode && (
                                <p className="font-mono text-[8px] text-slate-500 break-all">
                                  {item.barcode}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
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
                width: '210mm',
                maxWidth: '210mm',
                height: '297mm',
                padding: '5mm',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <div
                className="grid w-full h-full overflow-hidden"
                style={{
                  gridTemplateColumns: `repeat(${labelLayout.cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${labelLayout.rows}, minmax(0, 1fr))`,
                  gap: '4mm',
                  boxSizing: 'border-box',
                }}
              >
                {Array.from({ length: labelLayout.count }).map((_, i) => {
                  const item = selectedItems[pageIndex * labelLayout.count + i];
                  return (
                    <div
                      key={i}
                      className="border border-slate-400 rounded-sm p-1.5 flex flex-col justify-center bg-white overflow-hidden min-w-0"
                      style={{ minHeight: 0, boxSizing: 'border-box' }}
                    >
                      {item ? (
                        <>
                          <p
                            className="font-semibold leading-tight text-slate-900 overflow-hidden"
                            style={{ fontSize: '9pt', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                          >
                            {item.variant_name ? `${item.name} – ${item.variant_name}` : item.name}
                          </p>
                          <p
                            className="text-[#1c6a1e] font-bold mt-0.5 shrink-0"
                            style={{ fontSize: '12pt' }}
                          >
                            {formatPrice(item.current_sell_price)}
                          </p>
                          {getAisleLabel(item) && (
                            <p
                              className="text-slate-500 mt-0.5 shrink-0"
                              style={{ fontSize: '7pt' }}
                            >
                              {getAisleLabel(item)}
                            </p>
                          )}
                          {showBarcode && item.barcode && (
                            <p
                              className="font-mono text-slate-500 mt-0.5 overflow-hidden"
                              style={{ fontSize: '7pt', wordBreak: 'break-all', overflowWrap: 'break-word' }}
                            >
                              {item.barcode}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-300" style={{ fontSize: '9pt' }}>
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

      {/* Override @page for A4 when printing from this page */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4;
                margin: 0;
              }
            }
          `,
        }}
      />
    </AdminLayout>
  );
}
