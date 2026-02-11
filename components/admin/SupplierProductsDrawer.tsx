'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
} from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/utils/api-client';

interface Supplier {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  location: string | null;
  notes: string | null;
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
}

export function SupplierProductsDrawer({
  open,
  onOpenChange,
  supplier,
  onCreateBill,
  onSupplierDeleted,
}: SupplierProductsDrawerProps) {
  const [linkedProducts, setLinkedProducts] = useState<LinkedProduct[]>([]);
  const [allItems, setAllItems] = useState<AllItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddProducts, setShowAddProducts] = useState(false);
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
      setShowAddProducts(false);
    }
  }, [open, supplier, fetchLinkedProducts]);

  useEffect(() => {
    if (showAddProducts) {
      fetchAllItems();
    }
  }, [showAddProducts, fetchAllItems]);

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

  const handleDeleteSupplier = async () => {
    if (!supplier) return;
    if (!confirm(`Delete supplier "${supplier.name}"? Linked products and bill history will be unaffected; existing bills will show as "No supplier". This cannot be undone.`)) return;
    setDeletingSupplier(true);
    try {
      const result = await apiDelete(`/api/suppliers/${supplier.id}`);
      if (result.success) {
        onOpenChange(false);
        onSupplierDeleted?.();
      } else {
        alert(result.message || 'Failed to delete supplier');
      }
    } catch (err) {
      console.error('Error deleting supplier:', err);
      alert('Failed to delete supplier');
    } finally {
      setDeletingSupplier(false);
    }
  };

  const linkedItemIds = new Set(linkedProducts.map((p) => p.item_id));

  const filteredAvailableItems = allItems
    .filter((item) => !linkedItemIds.has(item.id))
    .filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const displayName = item.variant_name
        ? `${item.name} - ${item.variant_name}`
        : item.name;
      return displayName.toLowerCase().includes(q);
    });

  const formatPrice = (price: number) =>
    `KES ${Math.round(price).toLocaleString()}`;

  const getDisplayName = (name: string, variantName: string | null) =>
    variantName ? `${name} - ${variantName}` : name;

  if (!supplier) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[520px] !max-w-none h-full max-h-screen z-[52]">
        <DrawerHeader className="border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 relative pr-12">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 h-10 w-10 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border-2 border-slate-300 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-sm hover:shadow-md rounded-lg"
          >
            <X className="h-5 w-5" />
          </Button>
          <DrawerTitle className="flex items-center gap-2 text-slate-900 dark:text-white pr-8">
            <Building2 className="w-5 h-5 text-[#259783]" />
            {supplier.name}
          </DrawerTitle>
          <DrawerDescription className="text-slate-600 dark:text-slate-400">
            Manage linked products for this supplier
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto flex-1 bg-white dark:bg-[#0f1a0d]">
          {/* Supplier Info */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex flex-wrap gap-3 text-sm">
              {supplier.contact_phone && (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{supplier.contact_phone}</span>
                </div>
              )}
              {supplier.contact_email && (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{supplier.contact_email}</span>
                </div>
              )}
              {supplier.location && (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{supplier.location}</span>
                </div>
              )}
            </div>
            {/* Quick actions */}
            <div className="mt-3 flex flex-wrap gap-2">
              {onCreateBill && (
                <Button
                  onClick={() => onCreateBill(supplier.id, supplier.name)}
                  size="sm"
                  className="bg-[#259783] hover:bg-[#1e7a6a] text-white"
                >
                  <Receipt className="w-4 h-4 mr-1.5" />
                  New Bill for {supplier.name}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSupplier}
                disabled={deletingSupplier}
                className="border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-800"
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

          {/* Linked Products Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#259783]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Linked Products
                </h3>
                <Badge
                  variant="outline"
                  className="text-xs bg-[#259783]/10 text-[#259783] border-[#259783]/30"
                >
                  {linkedProducts.length}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddProducts(!showAddProducts)}
                className={`h-8 text-xs ${
                  showAddProducts
                    ? 'bg-[#259783]/10 text-[#259783] border-[#259783]/30'
                    : ''
                }`}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                {showAddProducts ? 'Done Adding' : 'Add Products'}
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[#259783]" />
                <span className="ml-2 text-sm text-slate-500">
                  Loading products...
                </span>
              </div>
            ) : linkedProducts.length === 0 ? (
              <div className="py-8 text-center">
                <Package className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  No products linked yet
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Link products to auto-fill when creating bills
                </p>
                {!showAddProducts && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddProducts(true)}
                    className="mt-3"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Products
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {linkedProducts.map((product) => (
                  <Card
                    key={product.item_id}
                    className="border-l-2 border-l-[#259783] bg-white dark:bg-slate-800/50"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                            {getDisplayName(
                              product.item_name,
                              product.variant_name
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {product.category_name}
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              {product.unit_type}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Sell: {formatPrice(product.current_sell_price)}
                            </span>
                            {product.default_cost_price !== null && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                Cost: {formatPrice(product.default_cost_price)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkProduct(product.item_id)}
                          disabled={removingItemIds.has(product.item_id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                        >
                          {removingItemIds.has(product.item_id) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Add Products Section */}
          {showAddProducts && (
            <div className="p-4 border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Add Products
                </h3>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="pl-9 h-10 border-2 border-slate-200 dark:border-slate-700"
                />
              </div>

              {loadingItems ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-[#259783]" />
                  <span className="ml-2 text-sm text-slate-500">
                    Loading products...
                  </span>
                </div>
              ) : filteredAvailableItems.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? 'No matching products found'
                      : 'All products are already linked'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {filteredAvailableItems.slice(0, 50).map((item) => {
                    const isAdding = addingItemIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30 hover:border-[#259783]/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {getDisplayName(item.name, item.variant_name)}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400">
                              {item.unit_type}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {item.item_type}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatPrice(item.current_sell_price)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLinkProduct(item.id)}
                          disabled={isAdding}
                          className="h-7 px-2.5 text-xs border-[#259783]/30 text-[#259783] hover:bg-[#259783]/10 shrink-0"
                        >
                          {isAdding ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Link
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                  {filteredAvailableItems.length > 50 && (
                    <p className="text-xs text-center text-slate-400 py-2">
                      Showing 50 of {filteredAvailableItems.length} products.
                      Use search to narrow down.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
