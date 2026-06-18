'use client';

import { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  ScanBarcode,
  Package,
  Loader2,
  Search,
  Edit,
  Store,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
} from 'lucide-react';
import type { Item, Category } from '@/lib/db/types';
import { getItemDisplayName } from '@/lib/utils';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { toast } from 'sonner';
import Link from 'next/link';

interface ItemWithCategory extends Item {
  category_name?: string;
  parent_name?: string;
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
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const cacheBust = `&_t=${Date.now()}`;
      const [itemsRes, categoriesRes] = await Promise.all([
        fetch(
          `/api/items?all=true&noBarcode=true&itemType=${encodeURIComponent(itemTypeFilter)}${cacheBust}`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }
        ),
        fetch(`/api/categories?_t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const itemsResult = await itemsRes.json();
      const categoriesResult = await categoriesRes.json();

      if (categoriesResult.success) {
        setCategories(categoriesResult.data);
      }

      if (itemsResult.success) {
        const allItems: ItemWithCategory[] = itemsResult.data.map((item: Item & { parent_name?: string }) => {
          const category = categoriesResult.success
            ? categoriesResult.data.find((c: Category) => c.id === item.category_id)
            : null;
          return {
            ...item,
            category_name: category?.name,
            parent_name: item.parent_name,
          };
        });

        // API returns only variants + standalone (no parents). Group variants by parent.
        const variantsByParent = new Map<string, ItemWithCategory[]>();
        const standaloneItems: ItemWithCategory[] = [];

        for (const item of allItems) {
          if (item.parent_item_id) {
            const variants = variantsByParent.get(item.parent_item_id) || [];
            variants.push(item);
            variantsByParent.set(item.parent_item_id, variants);
          } else {
            standaloneItems.push(item);
          }
        }

        const processedItems: ItemWithCategory[] = [];
        // Add parent labels (from variant groups) — parent is only a label, never an item
        const parentEntries = [...variantsByParent.entries()].sort((a, b) => {
          const nameA = (a[1][0].parent_name || a[1][0].name || '').toLowerCase();
          const nameB = (b[1][0].parent_name || b[1][0].name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        for (const [parentId, variants] of parentEntries) {
          const first = variants[0];
          processedItems.push({
            id: parentId,
            name: first.parent_name || first.name,
            category_id: first.category_id,
            category_name: first.category_name,
            isParent: true,
            variantCount: variants.length,
            variants: variants.sort((a, b) =>
              (a.variant_name || '').localeCompare(b.variant_name || '')
            ),
          } as ItemWithCategory);
        }
        // Add standalone items (sorted by name)
        standaloneItems.sort((a, b) => a.name.localeCompare(b.name));
        processedItems.push(...standaloneItems);

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
      if (selectedCategory !== 'all') {
        if (item.isParent && item.variants) {
          const hasMatch = item.variants.some((v) => v.category_id === selectedCategory);
          if (!hasMatch) return false;
        } else if (item.category_id !== selectedCategory) {
          return false;
        }
      }
      return true;
    });
  }, [items, searchQuery, selectedCategory]);

  const filteredCount = useMemo(() => {
    let n = 0;
    for (const item of filteredItems) {
      if (item.isParent && item.variants) {
        n += item.variants.length;
      } else {
        n += 1;
      }
    }
    return n;
  }, [filteredItems]);

  const tableRows = useMemo(() => {
    const rows: {
      id: string;
      item: ItemWithCategory;
      productLabel: string;
      variantLabel?: string;
      categoryName: string;
    }[] = [];

    for (const entry of filteredItems) {
      if (entry.isParent && entry.variants) {
        const q = searchQuery.toLowerCase().trim();
        const variants = q
          ? entry.variants.filter(
              (v) =>
                v.name.toLowerCase().includes(q) ||
                v.variant_name?.toLowerCase().includes(q) ||
                entry.name.toLowerCase().includes(q)
            )
          : entry.variants;

        for (const v of variants) {
          const catName =
            categories.find((c) => c.id === v.category_id)?.name || 'Uncategorized';
          rows.push({
            id: v.id,
            item: v,
            productLabel: entry.name,
            variantLabel: v.variant_name || getItemDisplayName(v.name, v.variant_name),
            categoryName: catName,
          });
        }
      } else if (!entry.isParent) {
        const catName =
          categories.find((c) => c.id === entry.category_id)?.name || 'Uncategorized';
        rows.push({
          id: entry.id,
          item: entry,
          productLabel: entry.name,
          variantLabel: entry.variant_name || undefined,
          categoryName: catName,
        });
      }
    }

    return rows;
  }, [filteredItems, categories, searchQuery]);

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

  const openBarcodeDrawer = (item: ItemWithCategory) => {
    if (item.isParent) return;
    setEditingItem(item);
    setBarcodeInput('');
    setBarcodeDrawerOpen(true);
  };

  const handleDeleteItem = (item: ItemWithCategory) => {
    const itemName = getItemDisplayName(item.name, item.variant_name);
    toast(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`, {
      action: {
        label: 'Delete',
        onClick: async () => {
          setDeletingItemId(item.id);
          try {
            const response = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.success) {
              await fetchData();
              toast.success('Item deleted');
            } else {
              toast.error(result.message || 'Failed to delete item');
            }
          } catch (err) {
            console.error('Error deleting item:', err);
            toast.error('Failed to delete item. Please try again.');
          } finally {
            setDeletingItemId(null);
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleSaveBarcode = async () => {
    if (!editingItem || !barcodeInput.trim()) return;
    setSavingBarcode(true);
    try {
      const res = await fetch(`/api/items/${editingItem.id}/barcode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: barcodeInput.trim() }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success('Barcode added', {
          description: getItemDisplayName(editingItem.name, editingItem.variant_name),
        });
        setBarcodeDrawerOpen(false);
        setEditingItem(null);
        await fetchData();
      } else {
        toast.error(result.message || 'Failed to add barcode');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add barcode');
    } finally {
      setSavingBarcode(false);
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' || selectedCategory !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const formatPrice = (p: number) => `KES ${p.toFixed(0)}`;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="px-4 md:px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                <ScanBarcode className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  Barcode Audit
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {!loading && !error && (
                    <>
                      {hasActiveFilters ? (
                        <span>
                          Showing {filteredCount} of {totalCount} items
                        </span>
                      ) : (
                        <span>{totalCount} items need barcodes</span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <Link href="/admin/items">
              <Button variant="outline" size="sm" className="shrink-0">
                <Package className="w-4 h-4 mr-2" />
                All Items
              </Button>
            </Link>
          </div>
        </div>

        <div className="px-4 md:px-6 py-4 space-y-4">
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
              {/* Toolbar */}
              <div className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800/80 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by name, variant, or category..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-9 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus-visible:ring-amber-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-11 w-full sm:w-[180px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={itemTypeFilter === 'retail' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setItemTypeFilter('retail')}
                    className={
                      itemTypeFilter === 'retail'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-white dark:bg-slate-900'
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
                            : 'bg-white dark:bg-slate-900'
                        }
                      >
                        <span className="mr-1.5">{t.emoji}</span>
                        {t.label}
                      </Button>
                    ))}
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-slate-500 hover:text-slate-700 ml-auto"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>

              {/* Item Table */}
              <Card className="border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <CardContent className="p-0">
                  {tableRows.length === 0 ? (
                    <div className="p-12 text-center">
                      {hasActiveFilters ? (
                        <>
                          <Search className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                            No matches
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Try a different search term or category
                          </p>
                          <Button variant="outline" size="sm" onClick={clearFilters}>
                            Clear filters
                          </Button>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                            All clear!
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            {itemTypeFilter === 'retail'
                              ? 'All retail items have barcodes.'
                              : `All ${productTypes.find((t) => t.key === itemTypeFilter)?.label || itemTypeFilter} items have barcodes.`}
                          </p>
                          <Link href="/admin/items">
                            <Button variant="outline" size="sm">View all items</Button>
                          </Link>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-[1]">
                          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Product
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                              Variant
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                              Category
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Price
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[160px]">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {tableRows.map((row) => (
                            <tr
                              key={row.id}
                              className="hover:bg-amber-50/40 dark:hover:bg-amber-950/10 transition-colors"
                            >
                              <td className="py-3 px-4">
                                <p className="font-medium text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
                                  {row.productLabel}
                                </p>
                                {row.variantLabel && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate sm:hidden mt-0.5">
                                    {row.variantLabel}
                                  </p>
                                )}
                                <p className="text-xs text-slate-400 truncate md:hidden mt-0.5">
                                  {row.categoryName}
                                </p>
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-300 hidden sm:table-cell">
                                {row.variantLabel ? (
                                  <span className="truncate block max-w-[160px]">{row.variantLabel}</span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">
                                <span className="truncate block max-w-[140px]">{row.categoryName}</span>
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                {formatPrice(row.item.current_sell_price)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-end gap-1">
                                  <Link href={`/admin/items/${row.item.id}/edit`}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-400 hover:text-slate-600"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </Link>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    onClick={() => handleDeleteItem(row.item)}
                                    disabled={deletingItemId === row.item.id}
                                  >
                                    {deletingItemId === row.item.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
                                    onClick={() => openBarcodeDrawer(row.item)}
                                  >
                                    <ScanBarcode className="w-4 h-4 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Add</span>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                  ? getItemDisplayName(editingItem.name, editingItem.variant_name)
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
