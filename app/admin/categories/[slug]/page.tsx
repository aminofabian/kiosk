'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CalendarDays, FileDown, Loader2, Package } from 'lucide-react';
import type { Item } from '@/lib/db/types';
import { getItemDisplayName } from '@/lib/utils';
import { findCategoryBySlug, slugifyCategoryName } from '@/lib/utils/category-slug';
import { downloadProductCountSheetPdf } from '@/lib/pdf/product-count-sheet';
import { downloadProductWeeklyCountSheetPdf } from '@/lib/pdf/product-weekly-count-sheet';
import type { CategoryWithCount } from '@/components/admin/CategoryList';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const UNIT_LABELS: Record<string, string> = {
  kg: 'kg',
  g: 'g',
  piece: 'pcs',
  bunch: 'bunches',
  tray: 'trays',
  litre: 'L',
  ml: 'ml',
};

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function getWeekStartMonday(dateYmd: string): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(12, 0, 0, 0);
  const day = dt.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diffToMonday);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function getWeekEndSunday(mondayYmd: string): string {
  const [y, m, d] = mondayYmd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(12, 0, 0, 0);
  dt.setDate(dt.getDate() + 6);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export default function CategorySlugPage() {
  const params = useParams();
  const slugParam = (params?.slug as string) ?? '';
  const slug = useMemo(() => {
    try {
      return decodeURIComponent(slugParam);
    } catch {
      return slugParam;
    }
  }, [slugParam]);

  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfWeeklyRangeLoading, setPdfWeeklyRangeLoading] = useState(false);
  const [weeklyRangeDialogOpen, setWeeklyRangeDialogOpen] = useState(false);
  const [weekStartMonday, setWeekStartMonday] = useState<string>(() =>
    getWeekStartMonday(new Date().toISOString().slice(0, 10))
  );

  const category = useMemo(
    () => (categories.length ? findCategoryBySlug(categories, slug) : null),
    [categories, slug]
  );

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/categories?all=true&withCounts=true', { cache: 'no-store' });
      const result = await res.json();
      if (result.success) {
        setCategories(result.data);
      } else {
        setError(result.message || 'Failed to load categories');
      }
    } catch {
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (!category?.id) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setItemsLoading(true);
        const res = await fetch(`/api/items?categoryId=${encodeURIComponent(category.id)}&sellableOnly=true`, {
          cache: 'no-store',
        });
        const result = await res.json();
        if (cancelled) return;
        if (result.success && Array.isArray(result.data)) {
          setItems(result.data as Item[]);
        } else {
          setItems([]);
          toast.error(result.message || 'Could not load items');
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          toast.error('Could not load items');
        }
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category?.id]);

  const countSheetRows = useMemo(() => {
    const parentIdsWithVariants = new Set(
      items.filter((i) => !!i.parent_item_id).map((i) => i.parent_item_id as string)
    );
    const printableItems = items.filter((i) => {
      // Exclude grouping parent rows when they have child variants.
      if (!i.parent_item_id && parentIdsWithVariants.has(i.id)) return false;
      return true;
    });

    return printableItems.map((i) => {
      const u = UNIT_LABELS[i.unit_type] || i.unit_type;
      return {
        displayName: getItemDisplayName(i.name, i.variant_name),
        barcode: i.barcode,
        priceLabel: `${formatPrice(i.current_sell_price)}/${u}`,
      };
    });
  }, [items]);

  const handleDownloadPdf = async () => {
    if (!category || countSheetRows.length === 0) return;
    try {
      setPdfLoading(true);
      const safeName = slugifyCategoryName(category.name);
      await downloadProductCountSheetPdf({
        headline: category.name,
        subtitleLine: 'Category count sheet — sell price · write quantity by hand',
        periodLine: 'All active products in this category',
        priceColumnHeader: 'Price',
        footnote:
          'Sell price is the current shelf price. Enter counted or requested quantity in the blank Qty box on each row.',
        saveFileName: `${safeName}-count-sheet.pdf`,
        rows: countSheetRows,
      });
    } catch {
      toast.error('Could not create PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const weekEndSunday = getWeekEndSunday(getWeekStartMonday(weekStartMonday));
  const handleDownloadWeeklyRangePdf = async () => {
    if (!category || countSheetRows.length === 0) return;
    const monday = getWeekStartMonday(weekStartMonday);
    const sunday = getWeekEndSunday(monday);
    try {
      setPdfWeeklyRangeLoading(true);
      const safeName = slugifyCategoryName(category.name);
      await downloadProductWeeklyCountSheetPdf({
        headline: category.name,
        subtitleLine: 'Weekly sheet — Mon-Sun quantity boxes per product',
        periodLine: `${monday} to ${sunday}`,
        priceColumnHeader: 'Price',
        footnote:
          'Write quantity sold for each weekday in the boxes (Mon through Sun). Price is for reference only.',
        saveFileName: `${safeName}-weekly-sheet-${monday}-to-${sunday}.pdf`,
        rows: countSheetRows,
      });
    } catch {
      toast.error('Could not create weekly range PDF');
    } finally {
      setPdfWeeklyRangeLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 sm:p-8 flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-[#1c6a1e]" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6 sm:p-8">
          <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          <Button asChild variant="outline" className="mt-4 rounded-none">
            <Link href="/admin/categories">Back to categories</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  if (!category) {
    return (
      <AdminLayout>
        <div className="p-6 sm:p-8 max-w-lg">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Category not found</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            No category matches the link <span className="font-mono text-sm">{slug}</span>. It may
            have been renamed or removed.
          </p>
          <Button asChild variant="outline" className="mt-6 rounded-none">
            <Link href="/admin/categories">Back to categories</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Link
              href="/admin/categories"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1c6a1e] mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Categories
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {category.name}
            </h1>
            <p className="mt-1.5 text-slate-600 dark:text-slate-400 text-sm">
              Active products in this category · printable count sheet (blank quantities)
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-slate-200/80 bg-white/80 p-2 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/70">
            <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-slate-300 bg-white dark:bg-slate-950"
              onClick={handleDownloadPdf}
              disabled={countSheetRows.length === 0 || pdfLoading || itemsLoading || pdfWeeklyRangeLoading}
            >
              {pdfLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              <span className="ml-2">Download PDF</span>
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl border-0 bg-gradient-to-r from-[#1c6a1e] to-[#2a8a30] text-white shadow-lg shadow-[#1c6a1e]/30 hover:from-[#195d1b] hover:to-[#247729]"
              onClick={() => setWeeklyRangeDialogOpen(true)}
              disabled={countSheetRows.length === 0 || itemsLoading || pdfLoading || pdfWeeklyRangeLoading}
            >
              {pdfWeeklyRangeLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarDays className="h-4 w-4" />
              )}
              <span className="ml-2">Weekly blank</span>
            </Button>
            </div>
            <p className="px-1.5 pt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Mon-Sun picker with ready-to-print weekly boxes.
            </p>
          </div>
        </div>

        <Card className="rounded-none border border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-[#1c6a1e]" />
              Products ({itemsLoading ? '…' : items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {itemsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-14 text-slate-500 dark:text-slate-400 text-sm">
                No active products in this category.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left font-semibold text-slate-600 dark:text-slate-400 px-4 py-2.5">
                        Product
                      </th>
                      <th className="text-left font-semibold text-slate-600 dark:text-slate-400 px-4 py-2.5 w-36">
                        Barcode
                      </th>
                      <th className="text-right font-semibold text-slate-600 dark:text-slate-400 px-4 py-2.5">
                        Price
                      </th>
                      <th className="text-right font-semibold text-slate-600 dark:text-slate-400 px-4 py-2.5">
                        Stock
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`border-b border-slate-100 dark:border-slate-800 ${
                          idx % 2 === 1 ? 'bg-slate-50/40 dark:bg-slate-900/30' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                          {getItemDisplayName(item.name, item.variant_name)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {item.barcode?.trim() || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatPrice(item.current_sell_price)}
                          <span className="text-slate-400 text-xs ml-1">
                            /{UNIT_LABELS[item.unit_type] || item.unit_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {item.current_stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={weeklyRangeDialogOpen} onOpenChange={setWeeklyRangeDialogOpen}>
          <DialogContent className="sm:max-w-md border-slate-200/80 bg-gradient-to-b from-white to-slate-50 dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] text-white">
                  <CalendarDays className="h-4 w-4" />
                </span>
                Weekly blank (Mon-Sun)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Pick a week. Start aligns to Monday and end is Sunday.
              </p>
              <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="category-week-range-monday">From (Monday)</Label>
                  <Input
                    id="category-week-range-monday"
                    type="date"
                    value={weekStartMonday}
                    onChange={(e) => setWeekStartMonday(getWeekStartMonday(e.target.value))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category-week-range-sunday">To (Sunday)</Label>
                  <Input
                    id="category-week-range-sunday"
                    type="date"
                    value={weekEndSunday}
                    readOnly
                    className="rounded-lg bg-slate-50 dark:bg-slate-900"
                  />
                </div>
              </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => setWeeklyRangeDialogOpen(false)}
                  disabled={pdfWeeklyRangeLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-lg bg-gradient-to-r from-[#1c6a1e] to-[#2a8a30] text-white hover:from-[#195d1b] hover:to-[#247729]"
                  onClick={async () => {
                    await handleDownloadWeeklyRangePdf();
                    setWeeklyRangeDialogOpen(false);
                  }}
                  disabled={countSheetRows.length === 0 || itemsLoading || pdfLoading || pdfWeeklyRangeLoading}
                >
                  {pdfWeeklyRangeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download weekly PDF'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
