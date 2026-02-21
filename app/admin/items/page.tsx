'use client';

import { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit, Loader2, Plus, Search, Package, X, ChevronRight, FolderTree, Layers, ChevronDown, TrendingUp, TrendingDown, Trash2, Store, ShoppingBag } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ItemForm } from '@/components/admin/ItemForm';
import { CategoryForm } from '@/components/admin/CategoryForm';
import type { Item, Category } from '@/lib/db/types';
import type { UnitType, AdjustmentReason, ItemType } from '@/lib/constants';
import { ADJUSTMENT_REASONS } from '@/lib/constants';
import { getItemShopType } from '@/lib/utils/shop-type';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { toast } from 'sonner';

const REASON_LABELS: Record<AdjustmentReason, string> = {
  restock: 'Restock / New Delivery',
  spoilage: 'Spoilage',
  theft: 'Theft',
  counting_error: 'Counting Error',
  damage: 'Damage',
  other: 'Other',
};

interface ItemWithCategory extends Item {
  category_name?: string;
  buy_price?: number | null;
  variants?: ItemWithCategory[];
  isParent?: boolean;
  variantCount?: number;
}

export function ItemsManager() {
  const { user } = useCurrentUser();
  const isCashier = user?.role === 'cashier';
  const [items, setItems] = useState<ItemWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [shopTypeFilter, setShopTypeFilter] = useState<'all' | string>('all');
  const { productTypes } = useItemTypes();
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock'>('name');
  const [selectedItem, setSelectedItem] = useState<ItemWithCategory | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemWithCategory | null>(null);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [addingVariantToParent, setAddingVariantToParent] = useState<string | null>(null);
  
  // Stock adjustment state
  const [stockDrawerOpen, setStockDrawerOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<ItemWithCategory | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<AdjustmentReason>('restock');
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [togglingTypeId, setTogglingTypeId] = useState<string | null>(null);

  const fetchItems = async (background = false) => {
    try {
      if (!background) setLoading(true);
      const includeInactive = showDeletedItems ? '&includeInactive=true' : '';
      const [itemsRes, categoriesRes] = await Promise.all([
        fetch(`/api/items?all=true${includeInactive}`, { cache: 'no-store' }),
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

        // Group items: separate parents and variants
        const parentItems: ItemWithCategory[] = [];
        const standaloneItems: ItemWithCategory[] = [];
        const variantsByParent = new Map<string, ItemWithCategory[]>();

        for (const item of allItems) {
          if (item.parent_item_id) {
            // This is a variant
            const variants = variantsByParent.get(item.parent_item_id) || [];
            variants.push(item);
            variantsByParent.set(item.parent_item_id, variants);
          } else {
            // Check if it's a parent (has variants)
            parentItems.push(item);
          }
        }

        // Mark parents and attach variants
        const processedItems: ItemWithCategory[] = [];
        for (const item of parentItems) {
          const variants = variantsByParent.get(item.id);
          if (variants && variants.length > 0) {
            // This is a parent with variants
            processedItems.push({
              ...item,
              isParent: true,
              variantCount: variants.length,
              variants: variants.sort((a, b) => 
                (a.variant_name || '').localeCompare(b.variant_name || '')
              ),
            });
          } else {
            // Standalone item (no variants)
            standaloneItems.push(item);
          }
        }

        // Combine: parents first, then standalone
        const finalItems = [...processedItems, ...standaloneItems];
        setItems(finalItems);
        return finalItems;
      } else {
        setError(itemsResult.message || 'Failed to load items');
        return [];
      }
    } catch (err) {
      setError('Failed to load items');
      console.error('Error fetching items:', err);
      return [];
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [showDeletedItems]);

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const formatStock = (stock: number, unitType: UnitType) => {
    if (stock <= 0) return 'Out of stock';
    return `${stock.toFixed(2)} ${unitType}`;
  };

  const isLowStock = (item: ItemWithCategory) => {
    if (!item.min_stock_level) return false;
    return item.current_stock <= item.min_stock_level;
  };

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase().trim();
          const matchesQuery = 
            item.name.toLowerCase().includes(query) ||
            item.category_name?.toLowerCase().includes(query) ||
            item.variant_name?.toLowerCase().includes(query) ||
            (item.barcode && item.barcode.toLowerCase().includes(query)) ||
            // Also check variants for parent items
            item.variants?.some(v => 
              v.name.toLowerCase().includes(query) || 
              v.variant_name?.toLowerCase().includes(query) ||
              (v.barcode && v.barcode.toLowerCase().includes(query))
            );
          if (!matchesQuery) {
            return false;
          }
        }

        if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
          return false;
        }

        // Filter by shop type (use item.item_type from database)
        if (shopTypeFilter !== 'all') {
          const mainItemMatches = getItemShopType(item) === shopTypeFilter;
          if (!mainItemMatches) {
            // For parent items, check if any variant matches
            if (item.variants && item.variants.length > 0) {
              const hasMatchingVariant = item.variants.some(v => getItemShopType(v) === shopTypeFilter);
              if (!hasMatchingVariant) return false;
            } else {
              return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Keep parents at top when sorting
        if (a.isParent && !b.isParent) return -1;
        if (!a.isParent && b.isParent) return 1;
        
        if (sortBy === 'price') {
          return b.current_sell_price - a.current_sell_price;
        }
        if (sortBy === 'stock') {
          return a.current_stock - b.current_stock;
        }
        return a.name.localeCompare(b.name);
      });
  }, [items, searchQuery, selectedCategory, shopTypeFilter, sortBy, categories]);

  const toggleParentExpanded = (parentId: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const handleItemClick = (item: ItemWithCategory) => {
    setSelectedItem(item);
  };

  const handleEditClick = async () => {
    if (selectedItem) {
      // Fetch full item details including buy_price
      try {
        const response = await fetch(`/api/items/${selectedItem.id}`);
        const result = await response.json();
        if (result.success) {
          setEditingItem({
            ...selectedItem,
            buy_price: result.data.buy_price,
          });
        } else {
          setEditingItem(selectedItem);
        }
      } catch {
        setEditingItem(selectedItem);
      }
      setDrawerOpen(true);
    }
  };

  const handleAdjustStockClick = () => {
    if (selectedItem) {
      setAdjustingItem(selectedItem);
      setAdjustmentType('increase');
      setAdjustmentQuantity('');
      setAdjustmentReason('restock');
      setAdjustmentNotes('');
      setAdjustmentError(null);
      setStockDrawerOpen(true);
    }
  };

  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    const qty = parseFloat(adjustmentQuantity);
    if (isNaN(qty) || qty <= 0) {
      setAdjustmentError('Please enter a valid quantity greater than 0');
      return;
    }

    if (adjustmentType === 'decrease' && qty > adjustingItem.current_stock) {
      setAdjustmentError(`Cannot decrease by more than current stock (${adjustingItem.current_stock.toFixed(2)})`);
      return;
    }

    setIsAdjusting(true);
    setAdjustmentError(null);

    try {
      const response = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: adjustingItem.id,
          adjustmentType,
          quantity: qty,
          reason: adjustmentReason,
          notes: adjustmentNotes || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Check if approval is required (cashier)
        if (result.data?.requiresApproval) {
          toast.info('Stock adjustment request submitted. Waiting for admin approval.');
          setStockDrawerOpen(false);
          setAdjustingItem(null);
          await fetchItems(); // Refresh items list
          return;
        }

        // Update local state with new stock
        const newStock = adjustmentType === 'increase' 
          ? adjustingItem.current_stock + qty 
          : adjustingItem.current_stock - qty;

        const updatedItem = { ...adjustingItem, current_stock: newStock };

        // Update items list
        setItems(prevItems => prevItems.map(item => {
          if (item.id === adjustingItem.id) {
            return { ...item, current_stock: newStock };
          }
          if (item.variants) {
            const updatedVariants = item.variants.map(v => 
              v.id === adjustingItem.id ? { ...v, current_stock: newStock } : v
            );
            return { ...item, variants: updatedVariants };
          }
          return item;
        }));

        // Update selected item if it's the one being adjusted
        if (selectedItem?.id === adjustingItem.id) {
          setSelectedItem(updatedItem);
        }

        setStockDrawerOpen(false);
        setAdjustingItem(null);
      } else {
        setAdjustmentError(result.message || 'Failed to adjust stock');
      }
    } catch (err) {
      console.error('Stock adjustment error:', err);
      setAdjustmentError('An error occurred. Please try again.');
    } finally {
      setIsAdjusting(false);
    }
  };

  const calculatedNewStock = adjustingItem && adjustmentQuantity 
    ? (adjustmentType === 'increase' 
        ? adjustingItem.current_stock + (parseFloat(adjustmentQuantity) || 0)
        : Math.max(0, adjustingItem.current_stock - (parseFloat(adjustmentQuantity) || 0)))
    : null;

  const handleDeleteClick = () => {
    if (!selectedItem) return;

    const itemName = selectedItem.variant_name
      ? `${selectedItem.name} - ${selectedItem.variant_name}`
      : selectedItem.name;

    const hasVariants = selectedItem.isParent && selectedItem.variantCount && selectedItem.variantCount > 0;
    const confirmMessage = hasVariants
      ? `Are you sure you want to delete "${itemName}" and all its ${selectedItem.variantCount} variant(s)? This action cannot be undone.`
      : `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;

    toast(confirmMessage, {
      action: {
        label: 'Delete',
        onClick: async () => {
          setIsDeleting(true);
          try {
            const response = await fetch(`/api/items/${selectedItem.id}`, {
              method: 'DELETE',
            });

            const result = await response.json();

            if (result.success) {
              setSelectedItem(null);
              if (selectedItem.isParent) {
                setExpandedParents((prev) => {
                  const next = new Set(prev);
                  next.delete(selectedItem.id);
                  return next;
                });
              }
              await fetchItems();
              toast.success('Item deleted');
            } else {
              toast.error(result.message || 'Failed to delete item');
            }
          } catch (err) {
            console.error('Error deleting item:', err);
            toast.error('Failed to delete item. Please try again.');
          } finally {
            setIsDeleting(false);
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleToggleItemType = async (item: ItemWithCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentType = item.item_type || productTypes[0]?.key || 'retail';
    const keys = productTypes.map((t) => t.key);
    const currentIdx = keys.indexOf(currentType);
    const newType = keys[(currentIdx + 1) % keys.length] || keys[0] || 'retail';
    setTogglingTypeId(item.id);
    try {
      const res = await fetch(`/api/items/${item.id}/type`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: newType }),
      });
      const result = await res.json();
      if (result.success) {
        setItems((prev) =>
          prev.map((i) => {
            if (i.id === item.id) return { ...i, item_type: newType } as ItemWithCategory;
            if (i.variants) {
              const variants = i.variants.map((v) =>
                v.id === item.id ? ({ ...v, item_type: newType } as ItemWithCategory) : v
              );
              return { ...i, variants } as ItemWithCategory;
            }
            return i;
          })
        );
        if (selectedItem?.id === item.id) setSelectedItem({ ...selectedItem, item_type: newType });
        if (editingItem?.id === item.id) setEditingItem({ ...editingItem, item_type: newType });
        const tc = productTypes.find((t) => t.key === newType);
        toast.success(`Switched to ${tc ? `${tc.emoji} ${tc.label}` : newType}`);
      } else {
        toast.error(result.message || 'Failed to update type');
      }
    } catch (err) {
      console.error('Error toggling item type:', err);
      toast.error('Failed to update type');
    } finally {
      setTogglingTypeId(null);
    }
  };

  const handleDeleteItemFromList = (item: ItemWithCategory, e: React.MouseEvent) => {
    e.stopPropagation();

    const itemName = item.variant_name ? `${item.name} - ${item.variant_name}` : item.name;
    const hasVariants = item.isParent && item.variantCount && item.variantCount > 0;
    const confirmMessage = hasVariants
      ? `Are you sure you want to delete "${itemName}" and all its ${item.variantCount} variant(s)? This action cannot be undone.`
      : `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;

    toast(confirmMessage, {
      action: {
        label: 'Delete',
        onClick: async () => {
          setDeletingItemId(item.id);
          try {
            const response = await fetch(`/api/items/${item.id}`, {
              method: 'DELETE',
            });

            const result = await response.json();

            if (result.success) {
              if (selectedItem?.id === item.id) {
                setSelectedItem(null);
              }
              if (item.isParent) {
                setExpandedParents((prev) => {
                  const next = new Set(prev);
                  next.delete(item.id);
                  return next;
                });
              }
              await fetchItems();
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

  return (
    <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f1a0d]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Items</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Manage your product catalog</p>
                </div>
              </div>
              <Button
                className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white font-semibold shadow-lg shadow-[#1c6a1e]/20"
                onClick={() => {
                  setEditingItem(null);
                  setSelectedItem(null);
                  setDrawerOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">New Item</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 pb-24 md:pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mx-auto">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Loading items...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Sidebar - Search and Item List */}
              <div className="lg:col-span-1 space-y-4">
                <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
                  <CardContent className="p-4 space-y-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search by name, barcode..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus-visible:ring-[#1c6a1e]"
                      />
                    </div>

                    {/* Shop Type Filter */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant={shopTypeFilter === 'all' ? 'default' : 'outline'}
                        className={`h-10 flex-1 min-w-0 ${
                          shopTypeFilter === 'all'
                            ? 'bg-[#1c6a1e] hover:bg-[#2a8a30] text-white'
                            : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => setShopTypeFilter('all')}
                      >
                        All Items
                      </Button>
                      {productTypes.map((type) => (
                        <Button
                          key={type.key}
                          type="button"
                          variant={shopTypeFilter === type.key ? 'default' : 'outline'}
                          className={`h-10 flex-1 min-w-0 ${
                            shopTypeFilter === type.key
                              ? 'bg-[#1c6a1e] hover:bg-[#2a8a30] text-white'
                              : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          onClick={() => setShopTypeFilter(type.key)}
                        >
                          <span className="mr-1.5" aria-hidden>{type.emoji}</span>
                          {type.label}
                        </Button>
                      ))}
                    </div>

                    {/* Show deleted items */}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={showDeletedItems}
                          onChange={(e) => setShowDeletedItems(e.target.checked)}
                          className="rounded border-slate-300 text-[#1c6a1e] focus:ring-[#1c6a1e]"
                        />
                        Show deleted items
                      </label>
                    </div>

                    {/* Filters Row */}
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex gap-2 flex-1 min-w-0">
                        <Select
                          value={selectedCategory}
                          onValueChange={setSelectedCategory}
                        >
                          <SelectTrigger className="h-10 flex-1 bg-slate-50 dark:bg-slate-800/50 min-w-[120px]">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 shrink-0 bg-[#1c6a1e]/10 hover:bg-[#1c6a1e]/20 border-[#1c6a1e] text-[#1c6a1e] font-medium"
                          onClick={() => {
                            setEditingCategory(null);
                            setCategoryDrawerOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Add Category</span>
                          <span className="sm:hidden">Add</span>
                        </Button>
                      </div>

                      <Select
                        value={sortBy}
                        onValueChange={(v) => setSortBy(v as 'name' | 'price' | 'stock')}
                      >
                        <SelectTrigger className="h-10 w-28 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="price">Price</SelectItem>
                          <SelectItem value="stock">Stock</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    {/* Items List */}
                    <div className="space-y-2 max-h-[500px] md:max-h-[600px] overflow-y-auto -mx-1 px-1">
                      {filteredItems.length === 0 ? (
                        <div className="text-center py-8">
                          <Package className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm text-slate-500">No items found</p>
                          {(searchQuery || selectedCategory !== 'all' || shopTypeFilter !== 'all') && (
                            <p className="text-xs text-slate-400 mt-2">
                              Try &quot;All Items&quot;, &quot;All Categories&quot;, or search by barcode (e.g. 6161100100107)
                            </p>
                          )}
                        </div>
                      ) : (
                        filteredItems.map((item) => {
                          const isLow = isLowStock(item);
                          const isSelected = selectedItem?.id === item.id;
                          const isExpanded = expandedParents.has(item.id);
                          
                          return (
                            <div key={item.id}>
                              {/* Parent or Standalone Item */}
                              <div
                                className={`w-full rounded-xl transition-all border-l-4 ${
                                  item.isParent
                                    ? `p-4 ${isSelected ? 'bg-purple-100/80 dark:bg-purple-900/30 ring-2 ring-purple-500' : 'bg-purple-50/80 dark:bg-purple-900/20 hover:bg-purple-100/80 dark:hover:bg-purple-900/30 border-l-purple-500'}`
                                    : `p-3 ${isSelected ? 'bg-[#1c6a1e]/10 ring-2 ring-[#1c6a1e]' : 'bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50'} border-l-transparent`
                                } ${isLow && !item.isParent ? '!border-l-orange-500' : ''}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.isParent) {
                                        toggleParentExpanded(item.id);
                                      }
                                      handleItemClick(item);
                                    }}
                                    className="flex items-start gap-2 flex-1 min-w-0 text-left"
                                  >
                                    {item.isParent && (
                                      <ChevronDown 
                                        className={`w-5 h-5 mt-0.5 text-purple-600 dark:text-purple-400 shrink-0 transition-transform ${
                                          isExpanded ? '' : '-rotate-90'
                                        }`} 
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      {item.isParent && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                          Parent
                                        </span>
                                      )}
                                      <div className={`flex items-center gap-2 ${item.isParent ? 'mt-0.5' : ''}`}>
                                        <p className={`truncate ${item.isParent ? 'text-base font-bold text-purple-900 dark:text-purple-100' : 'font-semibold text-sm text-slate-900 dark:text-white'}`}>
                                          {item.name}
                                        </p>
                                        {item.isParent && (
                                          <Badge className="bg-purple-200 text-purple-800 dark:bg-purple-800/50 dark:text-purple-200 text-xs shrink-0 font-semibold">
                                            <Layers className="w-3.5 h-3.5 mr-1" />
                                            {item.variantCount}
                                          </Badge>
                                        )}
                                      </div>
                                      {!item.isParent && (
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-xs font-medium text-[#1c6a1e]">
                                            {formatPrice(item.current_sell_price)}
                                          </span>
                                          <span className="text-xs text-slate-400">•</span>
                                          <span className={`text-xs ${item.current_stock <= 0 ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-slate-500'}`}>
                                            {formatStock(item.current_stock, item.unit_type)}
                                          </span>
                                        </div>
                                      )}
                                      {item.category_name && (
                                        <p className={`text-xs text-slate-400 ${item.isParent ? 'mt-0.5' : 'mt-1'}`}>
                                          {item.category_name}
                                        </p>
                                      )}
                                    </div>
                                  </button>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {item.active === 0 && (
                                      <Badge variant="outline" className="text-xs border-red-300 text-red-600 dark:border-red-800 dark:text-red-400">
                                        Deleted
                                      </Badge>
                                    )}
                                    {isLow && !item.isParent && (
                                      <Badge variant="destructive" className="text-xs bg-orange-500">
                                        Low
                                      </Badge>
                                    )}
                                    {isSelected && (
                                      <ChevronRight className="w-4 h-4 text-[#1c6a1e]" />
                                    )}
                                    {!isCashier && (
                                      <>
                                        {(() => {
                                          const tc = productTypes.find((t) => t.key === (item.item_type || productTypes[0]?.key));
                                          return (
                                            <button
                                              type="button"
                                              onClick={(e) => handleToggleItemType(item, e)}
                                              disabled={togglingTypeId === item.id}
                                              className="p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
                                              title={tc ? `${tc.label} — click to cycle type` : 'Click to cycle type'}
                                            >
                                              {togglingTypeId === item.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <span className="text-sm">{tc?.emoji ?? '📦'}</span>
                                              )}
                                            </button>
                                          );
                                        })()}
                                        <button
                                          type="button"
                                          onClick={(e) => handleDeleteItemFromList(item, e)}
                                          disabled={deletingItemId === item.id}
                                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          title="Delete item"
                                        >
                                          {deletingItemId === item.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-4 w-4" />
                                          )}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Variants (if expanded) */}
                              {item.isParent && isExpanded && item.variants && (
                                <div className="ml-8 mt-2 space-y-1.5 border-l-2 border-blue-300 dark:border-blue-700 pl-4">
                                  {item.variants.map((variant) => {
                                    const variantIsLow = isLowStock(variant);
                                    const variantIsSelected = selectedItem?.id === variant.id;
                                    const variantIsDeleting = deletingItemId === variant.id;
                                    return (
                                      <div
                                        key={variant.id}
                                        className={`w-full py-2 px-3 rounded-lg transition-all border-l-2 border-blue-200 dark:border-blue-800/50 ${
                                          variantIsSelected
                                            ? 'bg-blue-100/80 dark:bg-blue-900/30 ring-2 ring-blue-500'
                                            : 'bg-blue-50/50 dark:bg-slate-800/25 hover:bg-blue-100/50 dark:hover:bg-blue-900/20'
                                        } ${variantIsLow ? '!border-l-orange-500' : ''}`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleItemClick(variant)}
                                            className="flex-1 min-w-0 text-left"
                                          >
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                              Variant
                                            </span>
                                            <p className="font-normal text-sm truncate text-slate-600 dark:text-slate-400 mt-0.5">
                                              {variant.variant_name || variant.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                              <span className="text-xs font-medium text-[#1c6a1e]">
                                                {formatPrice(variant.current_sell_price)}
                                              </span>
                                              <span className="text-xs text-slate-400">•</span>
                                              <span className={`text-xs ${variant.current_stock <= 0 ? 'text-red-500' : variantIsLow ? 'text-orange-500' : 'text-slate-500'}`}>
                                                {formatStock(variant.current_stock, variant.unit_type)}
                                              </span>
                                              <span className="text-xs text-slate-400">•</span>
                                              <span className="text-xs text-slate-400 lowercase">{variant.unit_type}</span>
                                            </div>
                                          </button>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {variant.active === 0 && (
                                              <Badge variant="outline" className="text-xs border-red-300 text-red-600 dark:border-red-800 dark:text-red-400">
                                                Deleted
                                              </Badge>
                                            )}
                                            {variantIsLow && (
                                              <Badge variant="destructive" className="text-xs bg-orange-500">
                                                Low
                                              </Badge>
                                            )}
                                            {!isCashier && (
                                              <>
                                                {(() => {
                                                  const tc = productTypes.find((t) => t.key === (variant.item_type || productTypes[0]?.key));
                                                  return (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => handleToggleItemType(variant, e)}
                                                      disabled={togglingTypeId === variant.id}
                                                      className="p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
                                                      title={tc ? `${tc.label} — click to cycle type` : 'Click to cycle type'}
                                                    >
                                                      {togglingTypeId === variant.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                      ) : (
                                                        <span className="text-sm">{tc?.emoji ?? '📦'}</span>
                                                      )}
                                                    </button>
                                                  );
                                                })()}
                                                <button
                                                  type="button"
                                                  onClick={(e) => handleDeleteItemFromList(variant, e)}
                                                  disabled={variantIsDeleting}
                                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                  title="Delete variant"
                                                >
                                                  {variantIsDeleting ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                  ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                  )}
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {/* Add variant button - only show if not cashier */}
                                  {!isCashier && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddingVariantToParent(item.id);
                                        setEditingItem(null);
                                        setDrawerOpen(true);
                                      }}
                                      className="w-full text-left py-2.5 px-3 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all ml-0"
                                    >
                                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                                        <Plus className="w-4 h-4" />
                                        <span>Add variant</span>
                                      </div>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Side - Item Details */}
              <div className="lg:col-span-2 space-y-4">
                {selectedItem ? (
                  <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
                    <CardContent className="p-0">
                      {/* Detail Header */}
                      <div className={`flex items-center justify-between p-5 border-b ${
                        selectedItem.isParent
                          ? 'border-l-4 border-l-purple-500 bg-purple-50/50 dark:bg-purple-900/10 border-slate-100 dark:border-slate-800'
                          : selectedItem.variant_name
                            ? 'border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10 border-slate-100 dark:border-slate-800'
                            : 'border-slate-100 dark:border-slate-800'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            selectedItem.isParent 
                              ? 'bg-purple-100 dark:bg-purple-900/40' 
                              : selectedItem.variant_name
                                ? 'bg-blue-100 dark:bg-blue-900/40'
                                : 'bg-emerald-50 dark:bg-emerald-900/20'
                          }`}>
                            {selectedItem.isParent ? (
                              <Layers className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            ) : selectedItem.variant_name ? (
                              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Package className="w-6 h-6 text-emerald-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {selectedItem.isParent && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                  Parent item
                                </span>
                              )}
                              {selectedItem.variant_name && (() => {
                                const parentItem = items.find(i => i.id === selectedItem.parent_item_id);
                                return (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    Variant
                                    {parentItem && (
                                      <span className="normal-case font-normal text-slate-500 dark:text-slate-400 ml-1">
                                        of {parentItem.name}
                                      </span>
                                    )}
                                  </span>
                                );
                              })()}
                            </div>
                            <h2 className={`font-bold text-slate-900 dark:text-white truncate ${
                              selectedItem.isParent ? 'text-2xl mt-0.5' : selectedItem.variant_name ? 'text-xl mt-0.5' : 'text-xl'
                            }`}>
                              {selectedItem.variant_name ? (selectedItem.variant_name || selectedItem.name) : selectedItem.name}
                            </h2>
                            <p className="text-sm text-slate-500 mt-0.5">{selectedItem.category_name || 'Uncategorized'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedItem(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Detail Content */}
                      <div className="p-5 space-y-6">
                        {selectedItem.isParent ? (
                          // Parent item view
                          <>
                            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-4 border border-purple-100 dark:border-purple-800/30">
                              <p className="text-sm text-purple-700 dark:text-purple-300">
                                This is a <strong>parent item</strong> with <strong>{selectedItem.variantCount} variant(s)</strong>. 
                                Parent items are containers that group variants together. Only variants can be sold.
                              </p>
                            </div>

                            {selectedItem.variants && selectedItem.variants.length > 0 && (
                              <div className="space-y-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Variants</h3>
                                <div className="space-y-2">
                                  {selectedItem.variants.map((variant) => (
                                    <div 
                                      key={variant.id}
                                      className="flex items-center justify-between py-3 px-4 rounded-lg border-l-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                      <div>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Variant</span>
                                        <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                                          {variant.variant_name}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                          {formatPrice(variant.current_sell_price)} • {formatStock(variant.current_stock, variant.unit_type)}
                                        </p>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleItemClick(variant)}
                                        className="text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                      >
                                        <ChevronRight className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-3 pt-2">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedItem(null)}
                                className="flex-1"
                              >
                                Close
                              </Button>
                              {!isCashier && (
                                <>
                                  <Button
                                    onClick={() => {
                                      setAddingVariantToParent(selectedItem.id);
                                      setEditingItem(null);
                                      setDrawerOpen(true);
                                    }}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Variant
                                  </Button>
                                  <Button
                                    onClick={handleEditClick}
                                    className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    onClick={handleDeleteClick}
                                    disabled={isDeleting}
                                    variant="destructive"
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          // Regular item or variant view
                          <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Selling Price</p>
                                <p className="text-xl font-bold text-[#1c6a1e]">
                                  {formatPrice(selectedItem.current_sell_price)}
                                </p>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current Stock</p>
                                <p className={`text-xl font-bold ${
                                  selectedItem.current_stock <= 0
                                    ? 'text-red-500'
                                    : isLowStock(selectedItem)
                                    ? 'text-orange-500'
                                    : 'text-slate-900 dark:text-white'
                                }`}>
                                  {formatStock(selectedItem.current_stock, selectedItem.unit_type)}
                                </p>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Unit Type</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                  {selectedItem.unit_type}
                                </p>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Status</p>
                                {selectedItem.current_stock <= 0 ? (
                                  <Badge variant="destructive" className="mt-1">Out of Stock</Badge>
                                ) : isLowStock(selectedItem) ? (
                                  <Badge className="bg-orange-500 hover:bg-orange-600 mt-1">Low Stock</Badge>
                                ) : (
                                  <Badge className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white mt-1">In Stock</Badge>
                                )}
                              </div>
                            </div>

                            {selectedItem.min_stock_level !== null && (
                              <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-4 border border-orange-100 dark:border-orange-800/30">
                                <p className="text-sm text-orange-700 dark:text-orange-400">
                                  <strong>Minimum Stock Level:</strong> {selectedItem.min_stock_level.toFixed(2)} {selectedItem.unit_type}
                                </p>
                              </div>
                            )}

                            <div className="flex gap-3 pt-2 flex-wrap">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedItem(null)}
                                className="flex-1 min-w-[100px]"
                              >
                                Close
                              </Button>
                              <Button
                                variant="outline"
                                onClick={handleAdjustStockClick}
                                className="flex-1 min-w-[100px] border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              >
                                <TrendingUp className="h-4 w-4 mr-2" />
                                Adjust Stock
                              </Button>
                              {!isCashier && (
                                <>
                                  <Button
                                    onClick={handleEditClick}
                                    className="flex-1 min-w-[100px] bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Item
                                  </Button>
                                  <Button
                                    onClick={handleDeleteClick}
                                    disabled={isDeleting}
                                    variant="destructive"
                                    className="flex-1 min-w-[100px] bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    {isDeleting ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Deleting...
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                        <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 font-semibold mb-2">No item selected</p>
                      <p className="text-sm text-slate-400">
                        Select an item from the list to view details
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Item Form Drawer */}
        <Drawer open={drawerOpen} onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setAddingVariantToParent(null);
          }
        }} direction="right">
          <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen">
            <DrawerHeader className="border-b bg-gradient-to-r from-purple-500/10 to-[#1c6a1e]/10">
              <DrawerTitle className="flex items-center gap-2">
                {addingVariantToParent ? (
                  <>
                    <Layers className="w-5 h-5 text-blue-500" />
                    Add Variant
                  </>
                ) : (
                  <>
                    <Package className="w-5 h-5 text-purple-500" />
                    {editingItem ? `Edit: ${editingItem.name}` : 'Add New Item'}
                  </>
                )}
              </DrawerTitle>
              <DrawerDescription>
                {addingVariantToParent
                  ? 'Add a new variant to this product'
                  : editingItem
                  ? 'Update item details below'
                  : 'Fill in the details to add a new item'}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-6 pb-6 flex-1 bg-slate-50/50 dark:bg-slate-900/50">
              <ItemForm
                itemId={editingItem?.id}
                parentItemId={addingVariantToParent || undefined}
                defaultMode={editingItem?.isParent ? 'parent' : 'standalone'}
                initialData={editingItem ? {
                  name: editingItem.name,
                  category_id: editingItem.category_id,
                  unit_type: editingItem.unit_type,
                  current_stock: editingItem.current_stock,
                  current_sell_price: editingItem.current_sell_price,
                  min_stock_level: editingItem.min_stock_level,
                  buy_price: editingItem.buy_price,
                  variant_name: editingItem.variant_name,
                  parent_item_id: editingItem.parent_item_id,
                  barcode: editingItem.barcode,
                  expiry_date: editingItem.expiry_date,
                  bundle_quantity: editingItem.bundle_quantity,
                  bundle_price: editingItem.bundle_price,
                  bundle_name: editingItem.bundle_name,
                  packaging_unit_name: editingItem.packaging_unit_name,
                  packaging_unit_qty: editingItem.packaging_unit_qty,
                  item_type: editingItem.item_type,
                } : undefined}
                onSuccess={async (updatedItem) => {
                  setDrawerOpen(false);
                  const editedItemId = editingItem?.id;
                  const parentId = addingVariantToParent;

                  // If we have updated item data from the API response, use it directly
                  if (updatedItem && editedItemId) {
                    const category = categories.find(c => c.id === updatedItem.category_id);
                    const itemWithCategory: ItemWithCategory = {
                      ...updatedItem,
                      category_name: category?.name,
                    };

                    setItems(prevItems => {
                      return prevItems.map(item => {
                        if (item.id === editedItemId) {
                          return { ...item, ...itemWithCategory };
                        }
                        if (item.variants) {
                          const updatedVariants = item.variants.map(v =>
                            v.id === editedItemId ? { ...v, ...itemWithCategory } : v
                          );
                          return { ...item, variants: updatedVariants };
                        }
                        return item;
                      });
                    });

                    if (selectedItem?.id === editedItemId) {
                      setSelectedItem(itemWithCategory);
                    }

                    setEditingItem(null);
                    setAddingVariantToParent(null);
                    toast.success('Item updated successfully', {
                      description: updatedItem.variant_name ? `${updatedItem.name} – ${updatedItem.variant_name}` : updatedItem.name,
                    });
                  } else {
                    setEditingItem(null);
                    setAddingVariantToParent(null);
                    toast.success(parentId ? 'Variant added successfully' : 'Item added successfully');

                    // Refresh list in background (no loading overlay)
                    const updatedItems = await fetchItems(true);
                    if (parentId) {
                      setExpandedParents(prev => new Set([...prev, parentId]));
                      const parent = updatedItems.find((i) => i.id === parentId);
                      if (parent) {
                        setSelectedItem(parent);
                      }
                    }
                  }
                }}
                onCancel={() => {
                  setDrawerOpen(false);
                  setEditingItem(null);
                  setAddingVariantToParent(null);
                }}
              />
            </div>
          </DrawerContent>
        </Drawer>

        {/* Category Form Drawer */}
        <Drawer open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[500px] md:!w-[600px] !max-w-none h-full max-h-screen">
            <DrawerHeader className="border-b bg-gradient-to-r from-blue-500/10 to-[#1c6a1e]/10">
              <DrawerTitle className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-blue-500" />
                {editingCategory ? `Edit: ${editingCategory.name}` : 'Add Categories'}
              </DrawerTitle>
              <DrawerDescription>
                {editingCategory
                  ? 'Update category details below'
                  : 'Select multiple categories or add custom ones'}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-6 pb-6 flex-1 bg-slate-50/50 dark:bg-slate-900/50">
              <CategoryForm
                category={editingCategory}
                existingCategories={categories}
                onClose={() => {
                  setCategoryDrawerOpen(false);
                  setEditingCategory(null);
                }}
                onSuccess={async () => {
                  setCategoryDrawerOpen(false);
                  setEditingCategory(null);
                  // Refresh categories
                  const categoriesRes = await fetch('/api/categories');
                  const categoriesResult = await categoriesRes.json();
                  if (categoriesResult.success) {
                    setCategories(categoriesResult.data);
                  }
                }}
              />
            </div>
          </DrawerContent>
        </Drawer>

        {/* Stock Adjustment Drawer */}
        <Drawer open={stockDrawerOpen} onOpenChange={setStockDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[450px] !max-w-none h-full max-h-screen">
            <DrawerHeader className="border-b bg-gradient-to-r from-blue-500/10 to-emerald-500/10">
              <DrawerTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Adjust Stock
              </DrawerTitle>
              <DrawerDescription>
                {adjustingItem ? `Adjust stock for ${adjustingItem.name}` : 'Select an item to adjust'}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto p-6 flex-1 bg-slate-50/50 dark:bg-slate-900/50">
              {adjustingItem && (
                <form onSubmit={handleStockAdjustSubmit} className="space-y-6">
                  {/* Current Stock Display */}
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Current Stock</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {adjustingItem.current_stock.toFixed(2)} <span className="text-base font-normal text-slate-500">{adjustingItem.unit_type}</span>
                        </p>
                      </div>
                      <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                    </div>
                  </div>

                  {/* Adjustment Type */}
                  <div className="space-y-2">
                    <Label>Adjustment Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustmentType('increase');
                          setAdjustmentReason('restock');
                        }}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          adjustmentType === 'increase'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                            : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                        }`}
                      >
                        <TrendingUp className={`h-6 w-6 mx-auto mb-1 ${
                          adjustmentType === 'increase' ? 'text-emerald-600' : 'text-slate-400'
                        }`} />
                        <p className={`font-semibold ${
                          adjustmentType === 'increase' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
                        }`}>Add Stock</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustmentType('decrease');
                          setAdjustmentReason('spoilage');
                        }}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          adjustmentType === 'decrease'
                            ? 'border-red-500 bg-red-50 dark:bg-red-950'
                            : 'border-slate-200 dark:border-slate-700 hover:border-red-300'
                        }`}
                      >
                        <TrendingDown className={`h-6 w-6 mx-auto mb-1 ${
                          adjustmentType === 'decrease' ? 'text-red-600' : 'text-slate-400'
                        }`} />
                        <p className={`font-semibold ${
                          adjustmentType === 'decrease' ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'
                        }`}>Remove Stock</p>
                      </button>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="space-y-2">
                    <Label htmlFor="adjustQuantity">Quantity ({adjustingItem.unit_type})</Label>
                    <Input
                      id="adjustQuantity"
                      type="number"
                      step="0.01"
                      min="0"
                      value={adjustmentQuantity}
                      onChange={(e) => setAdjustmentQuantity(e.target.value)}
                      placeholder="0.00"
                      className="h-12 text-lg"
                      autoFocus
                    />
                  </div>

                  {/* New Stock Preview */}
                  {calculatedNewStock !== null && adjustmentQuantity && (
                    <div className={`p-4 rounded-xl border-2 ${
                      adjustmentType === 'increase' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800' 
                        : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'
                    }`}>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">New Stock After Adjustment</p>
                      <p className={`text-2xl font-bold ${
                        adjustmentType === 'increase' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {calculatedNewStock.toFixed(2)} <span className="text-base font-normal">{adjustingItem.unit_type}</span>
                      </p>
                      <p className="text-sm mt-1 text-slate-500">
                        {adjustmentType === 'increase' ? '+' : '-'}{parseFloat(adjustmentQuantity).toFixed(2)} from current
                      </p>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Select value={adjustmentReason} onValueChange={(v) => setAdjustmentReason(v as AdjustmentReason)}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADJUSTMENT_REASONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {REASON_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="adjustNotes">Notes (Optional)</Label>
                    <Input
                      id="adjustNotes"
                      value={adjustmentNotes}
                      onChange={(e) => setAdjustmentNotes(e.target.value)}
                      placeholder="Add any notes..."
                      className="h-12"
                    />
                  </div>

                  {/* Error */}
                  {adjustmentError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                      {adjustmentError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStockDrawerOpen(false)}
                      disabled={isAdjusting}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isAdjusting || !adjustmentQuantity}
                      className={`flex-1 ${
                        adjustmentType === 'increase' 
                          ? 'bg-emerald-600 hover:bg-emerald-700' 
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {isAdjusting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          {adjustmentType === 'increase' ? (
                            <TrendingUp className="mr-2 h-4 w-4" />
                          ) : (
                            <TrendingDown className="mr-2 h-4 w-4" />
                          )}
                          {adjustmentType === 'increase' ? 'Add Stock' : 'Remove Stock'}
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </DrawerContent>
        </Drawer>
    </div>
  );
}

export default function ItemsPage() {
  return (
    <AdminLayout>
      <ItemsManager />
    </AdminLayout>
  );
}
