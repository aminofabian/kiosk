'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  X,
  Search,
  Plus,
  Trash2,
  Loader2,
  Package,
  Building2,
  Phone,
  Mail,
  MapPin,
  Link2,
  Receipt,
  Check,
  Tag,
} from 'lucide-react';
import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/utils/api-client';
import { getItemDisplayName } from '@/lib/utils';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { toast } from 'sonner';

interface Supplier {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  location: string | null;
  notes: string | null;
  supplier_type?: string | null;
}

interface LinkedProduct {
  supplier_product_id: string;
  item_id: string;
  item_name: string;
  variant_name: string | null;
  category_name: string;
  unit_type: string;
  item_type: string;
  current_sell_price: number;
  default_cost_price: number | null;
}

interface AllItem {
  id: string;
  name: string;
  variant_name: string | null;
  category_id: string;
  unit_type: string;
  item_type: string;
  current_sell_price: number;
  parent_item_id: string | null;
}

interface SupplierProductsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onCreateBill?: (supplierId: string, supplierName: string) => void;
  onSupplierDeleted?: () => void;
  onSupplierUpdated?: (supplier: Supplier) => void;
}

export function SupplierProductsDrawer({
  open,
  onOpenChange,
  supplier,
  onCreateBill,
  onSupplierDeleted,
  onSupplierUpdated,
}: SupplierProductsDrawerProps) {
  const { productTypes } = useItemTypes();
  const [linkedProducts, setLinkedProducts] = useState<LinkedProduct[]>([]);
  const [allItems, setAllItems] = useState<AllItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState(false);
  const [settingType, setSettingType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingItemIds, setAddingItemIds] = useState<Set<string>>(new Set());
  const [removingItemIds, setRemovingItemIds] = useState<Set<string>>(new Set());

  const fetchLinkedProducts = useCallback(async () => {
    if (!supplier) return;
    setLoading(true);
    try {
      const result = await apiGet<LinkedProduct[]>(
        `/api/suppliers/${supplier.id}/products`
      );
      if (result.success && result.data) {
        setLinkedProducts(result.data);
      }
    } catch (err) {
      console.error('Error fetching linked products:', err);
    } finally {
      setLoading(false);
    }
  }, [supplier]);

  const fetchAllItems = useCallback(async () => {
    if (allItems.length > 0) return;
    setLoadingItems(true);
    try {
      const result = await apiGet<AllItem[]>('/api/items?all=true');
      if (result.success && result.data) {
        setAllItems(result.data);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoadingItems(false);
    }
  }, [allItems.length]);

  useEffect(() => {
    if (open && supplier) {
      fetchLinkedProducts();
      setSearchQuery('');
      fetchAllItems();
    }
  }, [open, supplier, fetchLinkedProducts, fetchAllItems]);

  const handleLinkProduct = async (itemId: string) => {
    if (!supplier) return;
    setAddingItemIds((prev) => new Set(prev).add(itemId));
    try {
      const result = await apiPost(`/api/suppliers/${supplier.id}/products`, {
        items: [{ itemId }],
      });
      if (result.success) {
        await fetchLinkedProducts();
      }
    } catch (err) {
      console.error('Error linking product:', err);
    } finally {
      setAddingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleUnlinkProduct = async (itemId: string) => {
    if (!supplier) return;
    setRemovingItemIds((prev) => new Set(prev).add(itemId));
    try {
      const result = await apiDelete(
        `/api/suppliers/${supplier.id}/products?itemId=${itemId}`
      );
      if (result.success) {
        setLinkedProducts((prev) => prev.filter((p) => p.item_id !== itemId));
      }
    } catch (err) {
      console.error('Error unlinking product:', err);
    } finally {
      setRemovingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleSetSupplierType = async (typeKey: string) => {
    if (!supplier) return;
    setSettingType(typeKey);
    try {
      const result = await apiPatch<{ success: boolean }>(`/api/suppliers/${supplier.id}`, { supplierType: typeKey });
      if (result.success) {
        const updated = { ...supplier, supplier_type: typeKey };
        onSupplierUpdated?.(updated);
        toast.success('Supplier type updated');
      } else {
        toast.error(result.message || 'Failed to update type');
      }
    } catch (err) {
      console.error('Error updating supplier type:', err);
      toast.error('Failed to update type');
    } finally {
      setSettingType(null);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplier) return;
    toast(`Delete supplier "${supplier.name}"? Linked products and bill history will be unaffected; existing bills will show as "No supplier". This cannot be undone.`, {
      action: {
        label: 'Delete',
        onClick: async () => {
          setDeletingSupplier(true);
          try {
            const result = await apiDelete(`/api/suppliers/${supplier.id}`);
            if (result.success) {
              onOpenChange(false);
              onSupplierDeleted?.();
              toast.success('Supplier deleted');
            } else {
              toast.error(result.message || 'Failed to delete supplier');
            }
          } catch (err) {
            console.error('Error deleting supplier:', err);
            toast.error('Failed to delete supplier');
          } finally {
            setDeletingSupplier(false);
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const linkedItemIds = new Set(linkedProducts.map((p) => p.item_id));

  const filteredAvailableItems = allItems
    .filter((item) => !linkedItemIds.has(item.id))
    .filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const displayName = getItemDisplayName(item.name, item.variant_name);
      return displayName.toLowerCase().includes(q);
    });

  const formatPrice = (price: number) =>
    `KES ${Math.round(price).toLocaleString()}`;

  const getDisplayName = (name: string, variantName: string | null) =>
    getItemDisplayName(name, variantName);

  if (!supplier) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[520px] md:!w-[900px] lg:!w-[960px] !max-w-none h-full max-h-screen z-[52] shadow-xl border-l border-slate-200/80 dark:border-slate-700/50">
        <DrawerHeader className="relative shrink-0 pb-4 bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-[#0f1a0d] border-b border-slate-200/60 dark:border-slate-800">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 h-9 w-9 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-500 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-700 shadow-sm border border-slate-200/60 dark:border-slate-700 transition-all hover:scale-105"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-start gap-3 pr-10">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 text-[#1c6a1e]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
                {supplier.name}
              </DrawerTitle>
              <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Manage which products this supplier provides
              </DrawerDescription>
            </div>
          </div>
          {productTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-700/60">
              <Tag className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Supplier type:</span>
              {productTypes.map((t) => {
                const isCurrent = supplier.supplier_type === t.key;
                const isUpdating = settingType === t.key;
                return (
                  <Button
                    key={t.key}
                    type="button"
                    variant={isCurrent ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs rounded-full transition-all"
                    style={isCurrent ? { backgroundColor: t.color, borderColor: t.color } : undefined}
                    disabled={!!settingType}
                    onClick={() => handleSetSupplierType(t.key)}
                  >
                    {isUpdating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    <span className="mr-1">{t.emoji}</span>
                    {t.label}
                  </Button>
                );
              })}
            </div>
          )}
        </DrawerHeader>

        <div className="flex flex-col flex-1 min-h-0 bg-slate-50/30 dark:bg-[#0f1a0d]">
          {/* Supplier Info */}
          <div className="p-4 shrink-0 border-b border-slate-200/60 dark:border-slate-800">
            <div className="flex flex-wrap gap-2 mb-3">
              {supplier.contact_phone && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-sm text-slate-600 dark:text-slate-300 shadow-sm">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{supplier.contact_phone}</span>
                </div>
              )}
              {supplier.contact_email && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-sm text-slate-600 dark:text-slate-300 shadow-sm">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{supplier.contact_email}</span>
                </div>
              )}
              {supplier.location && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-sm text-slate-600 dark:text-slate-300 shadow-sm">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{supplier.location}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {onCreateBill && (
                <Button
                  onClick={() => onCreateBill(supplier.id, supplier.name)}
                  size="sm"
                  className="rounded-lg bg-[#1c6a1e] hover:bg-[#165a18] text-white shadow-sm font-medium"
                >
                  <Receipt className="w-4 h-4 mr-1.5" />
                  New Bill
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSupplier}
                disabled={deletingSupplier}
                className="rounded-lg border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900/50 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20"
              >
                {deletingSupplier ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1.5" />
                )}
                Delete supplier
              </Button>
            </div>
          </div>

          {/* Side-by-side: Linked Products | Add Products */}
          <div className="flex flex-1 min-h-0 md:flex-row flex-col">
            {/* Linked Products Column */}
            <div className="flex flex-col flex-1 min-w-0 border-b md:border-b-0 md:border-r border-slate-200/60 dark:border-slate-800">
              <div className="p-4 shrink-0 bg-white/60 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20">
                      <Link2 className="w-4 h-4 text-[#1c6a1e]" />
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      Linked
                    </h3>
                  </div>
                  <Badge className="rounded-full bg-[#1c6a1e]/15 dark:bg-[#1c6a1e]/25 text-[#1c6a1e] border-0 font-medium px-2.5">
                    {linkedProducts.length}
                  </Badge>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Loading products...
                    </span>
                  </div>
                ) : linkedProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/60 mb-4">
                      <Package className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      No products linked yet
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
                      Add products from the catalog on the right →
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedProducts.map((product) => (
                      <div
                        key={product.item_id}
                        className="group flex items-center gap-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 p-3.5 shadow-sm hover:shadow-md hover:border-[#1c6a1e]/30 dark:hover:border-[#1c6a1e]/40 transition-all duration-200"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 text-[#1c6a1e]">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                            {getDisplayName(product.item_name, product.variant_name)}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                              {product.category_name}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {product.unit_type}
                            </span>
                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                              {formatPrice(product.current_sell_price)}
                            </span>
                            {product.default_cost_price !== null && (
                              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                Cost {formatPrice(product.default_cost_price)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkProduct(product.item_id)}
                          disabled={removingItemIds.has(product.item_id)}
                          className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          {removingItemIds.has(product.item_id) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add Products Column */}
            <div className="flex flex-col flex-1 min-w-0 min-h-[280px] md:min-h-0 bg-white/40 dark:bg-slate-900/30">
              <div className="p-4 shrink-0 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/80 dark:bg-slate-700/60">
                    <Plus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Add from catalog
                  </h3>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="pl-9 h-10 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm focus-visible:ring-[#1c6a1e]/50"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {loadingItems ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Loading catalog...
                    </span>
                  </div>
                ) : filteredAvailableItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/60 mb-4">
                      <Search className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {searchQuery ? 'No matches' : 'All linked'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {searchQuery ? 'Try a different search' : 'Every product is already linked to this supplier'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAvailableItems.slice(0, 50).map((item) => {
                      const isAdding = addingItemIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className="group flex items-center gap-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 p-3 shadow-sm hover:shadow-md hover:border-[#1c6a1e]/30 dark:hover:border-[#1c6a1e]/40 transition-all duration-200"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                              {getDisplayName(item.name, item.variant_name)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {item.unit_type}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">•</span>
                              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                                {formatPrice(item.current_sell_price)}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleLinkProduct(item.id)}
                            disabled={isAdding}
                            className="h-8 rounded-lg bg-[#1c6a1e] hover:bg-[#165a18] text-white text-xs font-medium px-3 shrink-0 shadow-sm"
                          >
                            {isAdding ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                                Link
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                    {filteredAvailableItems.length > 50 && (
                      <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-3">
                        Showing 50 of {filteredAvailableItems.length} — search to narrow
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
