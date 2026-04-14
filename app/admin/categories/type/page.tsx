'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CalendarDays, Download, Loader2, Tags } from 'lucide-react';
import type { Item } from '@/lib/db/types';
import { getItemDisplayName } from '@/lib/utils';
import { downloadProductWeeklyCountSheetPdf } from '@/lib/pdf/product-weekly-count-sheet';
import type { ProductCountSheetRow } from '@/lib/pdf/product-count-sheet';
import { toast } from 'sonner';

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

function slugFilePart(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'type';
}

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

function mapItemsToPrintableRows(items: Item[]): ProductCountSheetRow[] {
  const parentIdsWithVariants = new Set(
    items.filter((i) => !!i.parent_item_id).map((i) => i.parent_item_id as string)
  );
  return items
    .filter((i) => {
      if (i.active !== 1) return false;
      if (!i.parent_item_id && parentIdsWithVariants.has(i.id)) return false;
      return true;
    })
    .map((i) => {
      const u = UNIT_LABELS[i.unit_type] || i.unit_type;
      return {
        displayName: getItemDisplayName(i.name, i.variant_name),
        barcode: i.barcode,
        priceLabel: `${formatPrice(i.current_sell_price)}/${u}`,
      };
    });
}

export default function CategoryTypePage() {
  const { productTypes, loading: typesLoading } = useItemTypes();
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [weekStartMonday, setWeekStartMonday] = useState<string>(() =>
    getWeekStartMonday(new Date().toISOString().slice(0, 10))
  );
  const weekEndSunday = useMemo(
    () => getWeekEndSunday(getWeekStartMonday(weekStartMonday)),
    [weekStartMonday]
  );

  const handleDownloadTypeWeeklyPdf = async (typeKey: string, typeLabel: string) => {
    const monday = getWeekStartMonday(weekStartMonday);
    const sunday = getWeekEndSunday(monday);
    try {
      setDownloadingType(typeKey);
      const res = await fetch(
        `/api/items?all=true&sellableOnly=true&itemType=${encodeURIComponent(typeKey)}`,
        { cache: 'no-store' }
      );
      const result = await res.json();
      if (!result.success || !Array.isArray(result.data)) {
        toast.error(result.message || 'Could not load items for this type');
        return;
      }

      const rows = mapItemsToPrintableRows(result.data as Item[]);
      if (rows.length === 0) {
        toast.error(`No printable items found for ${typeLabel}`);
        return;
      }

      await downloadProductWeeklyCountSheetPdf({
        headline: `${typeLabel} Products`,
        subtitleLine: 'Weekly sheet — Mon-Sun quantity boxes per product',
        periodLine: `${monday} to ${sunday}`,
        priceColumnHeader: 'Price',
        footnote:
          'Write quantity sold for each weekday in the boxes (Mon through Sun). Price is for reference only.',
        saveFileName: `${slugFilePart(typeKey)}-weekly-sheet-${monday}-to-${sunday}.pdf`,
        rows,
      });
    } catch {
      toast.error('Could not create weekly blank PDF');
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin/categories"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1c6a1e] mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Categories
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Type Weekly Sheets
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Pick a week, then download a weekly blank PDF for any product type.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/70">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="type-week-start">From (Monday)</Label>
                <Input
                  id="type-week-start"
                  type="date"
                  value={weekStartMonday}
                  onChange={(e) => setWeekStartMonday(getWeekStartMonday(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type-week-end">To (Sunday)</Label>
                <Input
                  id="type-week-end"
                  type="date"
                  value={weekEndSunday}
                  readOnly
                  className="bg-slate-50 dark:bg-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {typesLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#1c6a1e]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {productTypes.map((type) => {
              const busy = downloadingType === type.key;
              return (
                <Card key={type.key} className="border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg"
                          style={{ backgroundColor: `${type.color}22` }}
                        >
                          {type.emoji}
                        </span>
                        {type.label}
                      </span>
                      <Tags className="h-4 w-4 text-slate-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      onClick={() => void handleDownloadTypeWeeklyPdf(type.key, type.label)}
                      disabled={!!downloadingType}
                      className="w-full bg-gradient-to-r from-[#1c6a1e] to-[#2a8a30] text-white hover:from-[#195d1b] hover:to-[#247729]"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarDays className="h-4 w-4" />
                      )}
                      <span className="ml-2">{busy ? 'Preparing PDF…' : 'Download weekly blank PDF'}</span>
                      {!busy && <Download className="ml-auto h-4 w-4" />}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
