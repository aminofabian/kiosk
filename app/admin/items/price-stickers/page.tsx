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
  ChevronDown,
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredItems.map((i) => i.id)));
  };

  const selectNone = () => setSelectedIds(new Set());

  const selectedItems = useMemo(
    () => filteredItems.filter((i) => selectedIds.has(i.id)),
    [filteredItems, selectedIds]
  );

  const printStickers = () => {
    window.print();
  };

  const formatPrice = (p: number) => `KES ${p.toFixed(0)}`;

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-[#0f1a0d]/90 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg">
                  <LayoutGrid className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                    Price Stickers
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Print A4 sheets — cut and stick
                  </p>
                </div>
              </div>
              <Button
                onClick={printStickers}
                disabled={selectedItems.length === 0}
                className="bg-slate-800 hover:bg-slate-900 text-white"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print {selectedItems.length} sticker{selectedItems.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Filters */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={itemTypeFilter === 'retail' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setItemTypeFilter('retail')}
                    className={itemTypeFilter === 'retail' ? 'bg-slate-800' : ''}
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
                        className={itemTypeFilter === t.key ? 'bg-slate-800' : ''}
                      >
                        <span className="mr-1.5">{t.emoji}</span>
                        {t.label}
                      </Button>
                    ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <FolderTree className="w-4 h-4 mr-2" />
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
                    <SelectTrigger className="w-[160px]">
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
                  <SelectTrigger className="w-[160px]">
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
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBarcode}
                    onChange={(e) => setShowBarcode(e.target.checked)}
                    className="rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                  />
                  Show barcode
                </label>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select all
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Item list */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-0">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {filteredItems.length} products · {selectedIds.size} selected
                  </p>
                </div>
                <div className="max-h-[50vh] overflow-y-auto">
                  {loading ? (
                    <div className="p-12 flex justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No products match your filters</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredItems.map((item) => {
                        const displayName = item.variant_name
                          ? `${item.name} – ${item.variant_name}`
                          : item.name;
                        const isSelected = selectedIds.has(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                              isSelected ? 'bg-slate-100 dark:bg-slate-800/50' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleItem(item.id)}
                              className="rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 dark:text-white truncate">
                                {displayName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatPrice(item.current_sell_price)} · {item.category_name}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Print preview */}
            <Card className="border-slate-200 dark:border-slate-800 print:hidden">
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  Preview
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  A4 sheet · {labelLayout.count} labels per page
                </p>
                <div
                  className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/30"
                  style={{
                    aspectRatio: '210/297',
                    maxHeight: '400px',
                  }}
                >
                  <div
                    className="grid h-full w-full"
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
                          className="border border-slate-200 dark:border-slate-700 rounded p-1.5 bg-white dark:bg-slate-800 text-[10px] overflow-hidden flex flex-col justify-center"
                        >
                          {item ? (
                            <>
                              <p className="font-semibold leading-tight break-words">
                                {item.variant_name ? `${item.name} – ${item.variant_name}` : item.name}
                              </p>
                              <p className="text-[#1c6a1e] font-bold">{formatPrice(item.current_sell_price)}</p>
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
