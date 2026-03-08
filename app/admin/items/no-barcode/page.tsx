'use client';

import { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  ScanBarcode,
  Package,
  Loader2,
  Search,
  Edit,
  ChevronRight,
  Sparkles,
  Layers,
  FolderTree,
  Store,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { Item, Category } from '@/lib/db/types';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { toast } from 'sonner';
import Link from 'next/link';

interface ItemWithCategory extends Item {
  category_name?: string;
  isParent?: boolean;
  variantCount?: number;
  variants?: ItemWithCategory[];
}

export default function ItemsWithoutBarcodePage() {
  const { productTypes } = useItemTypes();
  const [items, setItems] = useState<ItemWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('retail');
  const [barcodeDrawerOpen, setBarcodeDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemWithCategory | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [savingBarcode, setSavingBarcode] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [itemsRes, categoriesRes] = await Promise.all([
        fetch(
          `/api/items?all=true&noBarcode=true&itemType=${encodeURIComponent(itemTypeFilter)}`,
          { cache: 'no-store' }
        ),
        fetch('/api/categories', { cache: 'no-store' }),
      ]);

      const itemsResult = await itemsRes.json();
      const categoriesResult = await categoriesRes.json();

      if (categoriesResult.success) {
        setCategories(categoriesResult.data);
      }

      if (itemsResult.success) {
        const allItems: ItemWithCategory[] = itemsResult.data.map((item: Item) => {
          const category = categoriesResult.success
            ? categoriesResult.data.find((c: Category) => c.id === item.category_id)
            : null;
          return {
            ...item,
            category_name: category?.name,
          };
        });

        const parentItems: ItemWithCategory[] = [];
        const variantsByParent = new Map<string, ItemWithCategory[]>();

        for (const item of allItems) {
          if (item.parent_item_id) {
            const variants = variantsByParent.get(item.parent_item_id) || [];
            variants.push(item);
            variantsByParent.set(item.parent_item_id, variants);
          } else {
            parentItems.push(item);
          }
        }

        const processedItems: ItemWithCategory[] = [];
        for (const item of parentItems) {
          const variants = variantsByParent.get(item.id);
          if (variants && variants.length > 0) {
            processedItems.push({
              ...item,
              isParent: true,
              variantCount: variants.length,
              variants: variants.sort((a, b) =>
                (a.variant_name || '').localeCompare(b.variant_name || '')
              ),
            });
          } else {
            processedItems.push(item);
          }
        }

        setItems(processedItems);
      } else {
        setError(itemsResult.message || 'Failed to load items');
      }
    } catch (err) {
      setError('Failed to load items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [itemTypeFilter]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.name.toLowerCase().includes(q) ||
          item.category_name?.toLowerCase().includes(q) ||
          item.variant_name?.toLowerCase().includes(q) ||
          item.variants?.some(
            (v) =>
              v.name.toLowerCase().includes(q) ||
              v.variant_name?.toLowerCase().includes(q)
          );
        if (!matches) return false;
      }
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [items, searchQuery, selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const catId = item.category_id;
      const catName = categories.find((c) => c.id === catId)?.name || 'Uncategorized';
      counts[catName] = (counts[catName] || 0) + 1;
      if (item.variants) {
        for (const v of item.variants) {
          const vCatName = categories.find((c) => c.id === v.category_id)?.name || 'Uncategorized';
          counts[vCatName] = (counts[vCatName] || 0) + 1;
        }
      }
    }
    return counts;
  }, [items, categories]);

  const totalCount = useMemo(() => {
    let n = 0;
    for (const item of items) {
      if (item.isParent && item.variants) {
        n += item.variants.length;
      } else {
        n += 1;
      }
    }
    return n;
  }, [items]);

  const toggleParentExpanded = (id: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openBarcodeDrawer = (item: ItemWithCategory) => {
    if (item.isParent) return;
    setEditingItem(item);
    setBarcodeInput('');
    setBarcodeDrawerOpen(true);
  };

  const handleSaveBarcode = async () => {
    if (!editingItem || !barcodeInput.trim()) return;
    setSavingBarcode(true);
    try {
      const res = await fetch(`/api/items/${editingItem.id}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      const item = result.data;
      const putRes = await fetch(`/api/items/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          categoryId: item.category_id,
          unitType: item.unit_type,
          buyPrice: item.buy_price,
          sellPrice: item.current_sell_price,
          minStockLevel: item.min_stock_level,
          variantName: item.variant_name,
          barcode: barcodeInput.trim(),
          expiryDate: item.expiry_date,
          bundleQuantity: item.bundle_quantity,
          bundlePrice: item.bundle_price,
          bundleName: item.bundle_name,
          packagingUnitName: item.packaging_unit_name,
          packagingUnitQty: item.packaging_unit_qty,
          itemType: item.item_type,
        }),
      });

      const putResult = await putRes.json();
      if (putResult.success) {
        toast.success('Barcode added', {
          description: `${editingItem.name}${editingItem.variant_name ? ` – ${editingItem.variant_name}` : ''}`,
        });
        setBarcodeDrawerOpen(false);
        setEditingItem(null);
        fetchData();
      } else {
        toast.error(putResult.message || 'Failed to add barcode');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add barcode');
    } finally {
      setSavingBarcode(false);
    }
  };

  const formatPrice = (p: number) => `KES ${p.toFixed(0)}`;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-amber-50/50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Hero Header */}
        <div className="relative overflow-hidden border-b border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 dark:from-amber-900/20 dark:via-orange-900/10 dark:to-amber-900/20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative px-4 md:px-6 py-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/25 ring-4 ring-amber-400/20">
                  <ScanBarcode className="w-7 h-7 text-white" strokeWidth={2} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                      Barcode Audit
                    </h1>
                    <Sparkles className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base">
                    Items missing barcodes — get scan-ready for faster checkout
                  </p>
                </div>
              </div>
              <Link href="/admin/items">
                <Button
                  variant="outline"
                  className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  <Package className="w-4 h-4 mr-2" />
                  All Items
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats & Filters */}
        <div className="px-4 md:px-6 py-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                </div>
                <p className="text-slate-500 font-medium">Scanning catalog...</p>
              </div>
            </div>
          ) : error ? (
            <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
                <p className="text-red-700 dark:text-red-400 font-semibold">{error}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-amber-200/60 dark:border-amber-900/40 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-bl-full" />
                  <CardContent className="p-5 relative">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                        <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {totalCount}
                        </p>
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                          Need Barcodes
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <FolderTree className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {Object.keys(categoryCounts).length}
                        </p>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Categories
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm col-span-1 sm:col-span-2 lg:col-span-2">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                      Top categories
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(categoryCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([name, count]) => (
                          <Badge
                            key={name}
                            variant="secondary"
                            className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-medium"
                          >
                            {name} · {count}
                          </Badge>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search items..."
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
                        className={
                          itemTypeFilter === 'retail'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : ''
                        }
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
                            className={
                              itemTypeFilter === t.key
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : ''
                            }
                          >
                            <span className="mr-1.5">{t.emoji}</span>
                            {t.label}
                          </Button>
                        ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedCategory === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory('all')}
                      className={
                        selectedCategory === 'all'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : ''
                      }
                    >
                      All
                    </Button>
                    {categories.map((cat) => (
                      <Button
                        key={cat.id}
                        variant={selectedCategory === cat.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={
                          selectedCategory === cat.id
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : ''
                        }
                      >
                        {cat.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Item List */}
              <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                <CardContent className="p-0">
                  {filteredItems.length === 0 ? (
                    <div className="p-16 text-center">
                      <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400 mb-4" />
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        All clear!
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 mb-4">
                        {itemTypeFilter === 'retail'
                          ? 'All retail items have barcodes. Great job!'
                          : `All ${productTypes.find((t) => t.key === itemTypeFilter)?.label || itemTypeFilter} items have barcodes.`}
                      </p>
                      <Link href="/admin/items">
                        <Button variant="outline">View all items</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[60vh] overflow-y-auto">
                      {filteredItems.map((item) => {
                        const isExpanded = expandedParents.has(item.id);
                        return (
                          <div key={item.id}>
                            {item.isParent ? (
                              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                                <button
                                  type="button"
                                  onClick={() => toggleParentExpanded(item.id)}
                                  className="w-full flex items-center gap-3 text-left"
                                >
                                  <ChevronRight
                                    className={`w-5 h-5 text-slate-400 transition-transform ${
                                      isExpanded ? 'rotate-90' : ''
                                    }`}
                                  />
                                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                                    <Layers className="w-5 h-5 text-purple-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                      {item.name}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                      {item.variantCount} variants need barcodes
                                    </p>
                                  </div>
                                  <Badge variant="secondary" className="shrink-0">
                                    {item.category_name}
                                  </Badge>
                                </button>
                                {isExpanded && item.variants && (
                                  <div className="mt-3 ml-12 space-y-2 pl-4 border-l-2 border-purple-200 dark:border-purple-800">
                                    {item.variants.map((v) => (
                                      <ItemRow
                                        key={v.id}
                                        item={v}
                                        categories={categories}
                                        onAddBarcode={openBarcodeDrawer}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <ItemRow
                                item={item}
                                categories={categories}
                                onAddBarcode={openBarcodeDrawer}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Barcode Drawer */}
        <Drawer
          open={barcodeDrawerOpen}
          onOpenChange={(o) => {
            setBarcodeDrawerOpen(o);
            if (!o) setEditingItem(null);
          }}
          direction="right"
        >
          <DrawerContent className="!w-full sm:!w-[400px] !max-w-none">
            <DrawerHeader className="border-b bg-amber-50/50 dark:bg-amber-950/20">
              <DrawerTitle className="flex items-center gap-2">
                <ScanBarcode className="w-5 h-5 text-amber-600" />
                Add Barcode
              </DrawerTitle>
              <DrawerDescription>
                {editingItem
                  ? `${editingItem.name}${editingItem.variant_name ? ` – ${editingItem.variant_name}` : ''}`
                  : 'Enter or scan barcode'}
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                  Barcode
                </label>
                <Input
                  placeholder="Scan or type barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveBarcode()}
                  className="text-lg font-mono"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setBarcodeDrawerOpen(false)}
                  disabled={savingBarcode}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                  onClick={handleSaveBarcode}
                  disabled={savingBarcode || !barcodeInput.trim()}
                >
                  {savingBarcode ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </AdminLayout>
  );
}

function ItemRow({
  item,
  categories,
  onAddBarcode,
}: {
  item: ItemWithCategory;
  categories: Category[];
  onAddBarcode: (item: ItemWithCategory) => void;
}) {
  const catName = categories.find((c) => c.id === item.category_id)?.name;
  const formatPrice = (p: number) => `KES ${p.toFixed(0)}`;

  return (
    <div className="flex items-center gap-3 p-4 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-colors group">
      <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
        <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white truncate">
          {item.variant_name ? `${item.name} – ${item.variant_name}` : item.name}
        </p>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{formatPrice(item.current_sell_price)}</span>
          <span>·</span>
          <span>{catName || 'Uncategorized'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <Link href={`/admin/items/${item.id}/edit`}>
          <Button variant="ghost" size="sm">
            <Edit className="w-4 h-4" />
          </Button>
        </Link>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white"
          onClick={() => onAddBarcode(item)}
        >
          <ScanBarcode className="w-4 h-4 mr-1.5" />
          Add Barcode
        </Button>
      </div>
    </div>
  );
}
