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
import { Edit, Loader2, Plus, Search, Package, X, ChevronRight, FolderTree, Layers, ChevronDown, TrendingUp, TrendingDown, Trash2, Printer, QrCode } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ItemForm } from '@/components/admin/ItemForm';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { InlineEditableCell } from '@/components/admin/InlineEditableCell';
import type { Item, Category } from '@/lib/db/types';
import type { UnitType, AdjustmentReason, ItemType } from '@/lib/constants';
import { ADJUSTMENT_REASONS, isDiscreteUnitType } from '@/lib/constants';
import { getItemShopType } from '@/lib/utils/shop-type';
import { getItemDisplayName } from '@/lib/utils';
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

  const variantParentDefaultsForForm = useMemo(() => {
    if (!addingVariantToParent) return undefined;
    const parent = items.find((i) => i.id === addingVariantToParent);
    if (!parent) return undefined;
    return {
      category_id: parent.category_id,
      item_type: parent.item_type,
    };
  }, [addingVariantToParent, items]);

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

  type QuickEditField = 'price' | 'stock' | 'barcode' | null;
  const [quickEditField, setQuickEditField] = useState<QuickEditField>(null);
  const [quickEditValue, setQuickEditValue] = useState('');
  const [quickSaving, setQuickSaving] = useState<QuickEditField>(null);

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

  useEffect(() => {
    setQuickEditField(null);
    setQuickEditValue('');
    setQuickSaving(null);
  }, [selectedItem?.id]);

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const formatStock = (stock: number | string, unitType: UnitType) => {
    const n = Number(stock) || 0;
    if (n <= 0) return 'Out of stock';
    return `${n.toFixed(2)} ${unitType}`;
  };

  const formatStockCompact = (stock: number | string, unitType: UnitType) => {
    const n = Number(stock) || 0;
    if (n <= 0) return 'Out';
    const val = n % 1 === 0 ? String(n) : n.toFixed(1);
    return unitType === 'piece' ? val : `${val} ${unitType}`;
  };

  const isLowStock = (item: ItemWithCategory) => {
    if (!item.min_stock_level) return false;
    return item.current_stock <= item.min_stock_level;
  };

  const formatStockQty = (stock: number, unitType: UnitType) =>
    isDiscreteUnitType(unitType) ? Math.round(stock).toString() : stock.toFixed(2);

  const applyItemPatch = (id: string, patch: Partial<ItemWithCategory>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) return { ...item, ...patch };
        if (item.variants?.some((v) => v.id === id)) {
          return {
            ...item,
            variants: item.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)),
          };
        }
        return item;
      })
    );
    setSelectedItem((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  };

  const cancelQuickEdit = () => {
    setQuickEditField(null);
    setQuickEditValue('');
  };

  const startQuickPriceEdit = () => {
    if (!selectedItem || isCashier) return;
    setQuickEditField('price');
    setQuickEditValue(String(selectedItem.current_sell_price));
  };

  const startQuickStockEdit = () => {
    if (!selectedItem) return;
    setQuickEditField('stock');
    setQuickEditValue(formatStockQty(selectedItem.current_stock, selectedItem.unit_type));
  };

  const startQuickBarcodeEdit = () => {
    if (!selectedItem || isCashier) return;
    setQuickEditField('barcode');
    setQuickEditValue(selectedItem.barcode || '');
  };

  const saveQuickPrice = async () => {
    if (!selectedItem) return;
    const sellPrice = parseFloat(quickEditValue);
    if (!quickEditValue || isNaN(sellPrice) || sellPrice <= 0) {
      toast.error('Enter a valid price');
      cancelQuickEdit();
      return;
    }
    if (Math.abs(sellPrice - selectedItem.current_sell_price) < 0.01) {
      cancelQuickEdit();
      return;
    }

    setQuickSaving('price');
    setQuickEditField(null);
    try {
      const res = await fetch(`/api/items/${selectedItem.id}/prices`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellPrice }),
      });
      const result = await res.json();
      if (result.success) {
        applyItemPatch(selectedItem.id, { current_sell_price: sellPrice });
        toast.success('Price updated');
      } else {
        toast.error(result.message || 'Failed to update price');
        setQuickEditField('price');
        setQuickEditValue(String(sellPrice));
      }
    } catch {
      toast.error('Failed to update price');
      setQuickEditField('price');
      setQuickEditValue(String(sellPrice));
    } finally {
      setQuickSaving(null);
      if (!quickEditField) setQuickEditValue('');
    }
  };

  const saveQuickStock = async () => {
    if (!selectedItem) return;
    const isDiscrete = isDiscreteUnitType(selectedItem.unit_type);
    const target = isDiscrete ? parseInt(quickEditValue, 10) : parseFloat(quickEditValue);

    if (!quickEditValue || isNaN(target) || target < 0) {
      toast.error('Enter a valid stock level');
      cancelQuickEdit();
      return;
    }

    const diff = target - selectedItem.current_stock;
    if (diff === 0) {
      cancelQuickEdit();
      return;
    }

    setQuickSaving('stock');
    setQuickEditField(null);
    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          adjustmentType: diff > 0 ? 'increase' : 'decrease',
          quantity: Math.abs(diff),
          reason: 'counting_error',
          notes: null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        if (result.data?.requiresApproval) {
          toast.success(result.message || 'Stock adjustment submitted for approval');
        } else {
          applyItemPatch(selectedItem.id, { current_stock: target });
          toast.success('Stock updated');
        }
      } else {
        toast.error(result.message || 'Failed to update stock');
        setQuickEditField('stock');
        setQuickEditValue(formatStockQty(target, selectedItem.unit_type));
      }
    } catch {
      toast.error('Failed to update stock');
      setQuickEditField('stock');
      setQuickEditValue(formatStockQty(target, selectedItem.unit_type));
    } finally {
      setQuickSaving(null);
      if (!quickEditField) setQuickEditValue('');
    }
  };

  const saveQuickBarcode = async () => {
    if (!selectedItem) return;
    const trimmed = quickEditValue.trim();
    const current = selectedItem.barcode?.trim() || '';
    if (trimmed === current) {
      cancelQuickEdit();
      return;
    }

    setQuickSaving('barcode');
    setQuickEditField(null);
    try {
      const res = await fetch(`/api/items/${selectedItem.id}/barcode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: trimmed || null }),
      });
      const result = await res.json();
      if (result.success) {
        applyItemPatch(selectedItem.id, { barcode: trimmed || null });
        toast.success(trimmed ? 'Barcode updated' : 'Barcode removed');
      } else {
        toast.error(result.message || 'Failed to update barcode');
        setQuickEditField('barcode');
        setQuickEditValue(trimmed);
      }
    } catch {
      toast.error('Failed to update barcode');
      setQuickEditField('barcode');
      setQuickEditValue(trimmed);
    } finally {
      setQuickSaving(null);
      if (!quickEditField) setQuickEditValue('');
    }
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

  const handleItemClick = async (item: ItemWithCategory) => {
    setSelectedItem(item);
    try {
      const response = await fetch(`/api/items/${item.id}`);
      const result = await response.json();
      if (result.success && result.data) {
        setSelectedItem({
          ...item,
          ...result.data,
          category_name: item.category_name ?? categories.find((c) => c.id === result.data.category_id)?.name,
          variants: item.variants,
          isParent: item.isParent,
          variantCount: item.variantCount,
        });
      }
    } catch {
      // Keep list row data if detail fetch fails
    }
  };

  const handleEditClick = async () => {
    if (selectedItem) {
      setAddingVariantToParent(null);
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

    const currentStock = Number(adjustingItem.current_stock) || 0;
    if (adjustmentType === 'decrease' && qty > currentStock) {
      setAdjustmentError(`Cannot decrease by more than current stock (${currentStock.toFixed(2)})`);
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

        // Update local state with new stock (coerce to number to avoid string concatenation)
        const newStock = adjustmentType === 'increase'
          ? currentStock + qty
          : currentStock - qty;

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

  const currentStockNum = adjustingItem ? (Number(adjustingItem.current_stock) || 0) : 0;
  const calculatedNewStock = adjustingItem && adjustmentQuantity 
    ? (adjustmentType === 'increase' 
        ? currentStockNum + (parseFloat(adjustmentQuantity) || 0)
        : Math.max(0, currentStockNum - (parseFloat(adjustmentQuantity) || 0)))
    : null;

  const handleDeleteClick = () => {
    if (!selectedItem) return;

    const itemName = getItemDisplayName(selectedItem.name, selectedItem.variant_name);

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

  const handlePrintLabel = (item: ItemWithCategory) => {
    const displayName = getItemDisplayName(item.name, item.variant_name);
    const priceStr = formatPrice(item.current_sell_price);
    const unitLine = item.unit_type !== 'piece'
      ? `${item.unit_type} · ${formatStock(item.current_stock, item.unit_type)}`
      : '';

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title></title><style>
      @page { size: 25mm 50mm; margin: 0 !important; }
      * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
      html, body { width: 25mm; height: 50mm; overflow: hidden; }
      body { font-family: Arial, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 0 1mm !important; }
      .name, .meta, .price { max-width: 100%; overflow-wrap: break-word; word-break: break-word; }
      .name { font-size: 6pt; font-weight: 800; color: #000; line-height: 1.1; }
      .meta { font-size: 5pt; color: #000; line-height: 1.1; }
      .price { font-size: 10pt; font-weight: 900; color: #000; line-height: 1; }
    </style></head><body>
      <div class="name">${displayName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>${unitLine ? `<div class="meta">${unitLine}</div>` : ''}<div class="price">${priceStr}</div>
    </body></html>`);
    doc.close();

    iframe.onload = () => {
      try { iframe.contentWindow?.print(); } catch { /* ignore */ }
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  const handleDeleteItemFromList = (item: ItemWithCategory, e: React.MouseEvent) => {
    e.stopPropagation();

    const itemName = getItemDisplayName(item.name, item.variant_name);
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
          <div className="px-3 md:px-4 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Items</h1>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Product catalog</p>
                </div>
              </div>
              <Button
                size="sm"
                className="h-8 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white font-medium"
                onClick={() => {
                  setEditingItem(null);
                  setSelectedItem(null);
                  setAddingVariantToParent(null);
                  setDrawerOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline text-xs">New Item</span>
                <span className="sm:hidden text-xs">Add</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-2 md:p-3 pb-16 md:pb-4 h-[calc(100dvh-3.25rem)]">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mx-auto">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Loading items...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                  <span className="text-xl">⚠️</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2 lg:grid-cols-[minmax(248px,300px)_1fr] h-full items-stretch">
              <div className="min-h-0 flex flex-col">
                <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800 flex flex-col min-h-0 flex-1 overflow-hidden">
                  <CardContent className="p-2 flex flex-col gap-1.5 min-h-0 flex-1">
                    <div className="shrink-0 space-y-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                      <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-7 h-7 text-[11px] bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus-visible:ring-[#1c6a1e]"
                      />
                    </div>

                    <div className="flex gap-0.5 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant={shopTypeFilter === 'all' ? 'default' : 'outline'}
                        className={`h-6 px-1.5 text-[10px] ${
                          shopTypeFilter === 'all'
                            ? 'bg-[#1c6a1e] hover:bg-[#2a8a30] text-white'
                            : 'bg-slate-50 dark:bg-slate-800/50'
                        }`}
                        onClick={() => setShopTypeFilter('all')}
                      >
                        All
                      </Button>
                      {productTypes.map((type) => (
                        <Button
                          key={type.key}
                          type="button"
                          size="sm"
                          variant={shopTypeFilter === type.key ? 'default' : 'outline'}
                          className={`h-6 px-1.5 text-[10px] ${
                            shopTypeFilter === type.key
                              ? 'bg-[#1c6a1e] hover:bg-[#2a8a30] text-white'
                              : 'bg-slate-50 dark:bg-slate-800/50'
                          }`}
                          onClick={() => setShopTypeFilter(type.key)}
                        >
                          <span className="mr-0.5" aria-hidden>{type.emoji}</span>
                          {type.label}
                        </Button>
                      ))}
                    </div>

                    <div className="flex gap-1 items-center">
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="h-6 flex-1 text-[10px] bg-slate-50 dark:bg-slate-800/50 min-w-0">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All categories</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'price' | 'stock')}>
                        <SelectTrigger className="h-6 w-[4.5rem] text-[10px] bg-slate-50 dark:bg-slate-800/50 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="price">Price</SelectItem>
                          <SelectItem value="stock">Stock</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(null);
                          setCategoryDrawerOpen(true);
                        }}
                        className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded border border-[#1c6a1e]/30 text-[#1c6a1e] hover:bg-[#1c6a1e]/10"
                        title="Manage categories"
                      >
                        <FolderTree className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showDeletedItems}
                          onChange={(e) => setShowDeletedItems(e.target.checked)}
                          className="rounded border-slate-300 text-[#1c6a1e] focus:ring-[#1c6a1e] scale-90"
                        />
                        Deleted
                      </label>
                      <span>{filteredItems.length} shown</span>
                    </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto -mx-0.5 px-0.5 border-t border-slate-100 dark:border-slate-800 pt-1">
                      {filteredItems.length === 0 ? (
                        <div className="text-center py-6">
                          <Package className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                          <p className="text-xs text-slate-500">No items found</p>
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
                              <div
                                className={`group w-full rounded transition-colors border-l-2 ${
                                  item.isParent
                                    ? `${isSelected ? 'bg-purple-100/70 dark:bg-purple-900/25 border-l-purple-500' : 'bg-purple-50/50 dark:bg-purple-900/15 hover:bg-purple-100/50 border-l-purple-400'}`
                                    : `${isSelected ? 'bg-[#1c6a1e]/10 border-l-[#1c6a1e]' : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/40 border-l-transparent'} ${isLow && !item.isParent ? '!border-l-orange-400' : ''}`
                                }`}
                              >
                                <div className="flex items-center gap-0.5 min-h-[24px] py-px px-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.isParent) toggleParentExpanded(item.id);
                                      handleItemClick(item);
                                    }}
                                    className="flex items-center gap-1 flex-1 min-w-0 text-left"
                                  >
                                    {item.isParent && (
                                      <ChevronDown
                                        className={`w-3 h-3 shrink-0 text-purple-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                                      />
                                    )}
                                    <span className={`truncate text-[11px] leading-tight ${item.isParent ? 'font-semibold text-purple-900 dark:text-purple-100' : 'font-medium text-slate-900 dark:text-white'}`}>
                                      {item.name}
                                    </span>
                                    {item.isParent ? (
                                      <span className="shrink-0 text-[10px] text-purple-600 dark:text-purple-400">
                                        ×{item.variantCount}
                                      </span>
                                    ) : (
                                      <>
                                        <span className="shrink-0 text-[10px] font-medium text-[#1c6a1e]">
                                          {formatPrice(item.current_sell_price)}
                                        </span>
                                        <span className={`shrink-0 text-[10px] ${item.current_stock <= 0 ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-slate-400'}`}>
                                          {formatStockCompact(item.current_stock, item.unit_type)}
                                        </span>
                                      </>
                                    )}
                                  </button>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {item.active === 0 && (
                                      <span className="text-[9px] text-red-500 font-medium">D</span>
                                    )}
                                    {isLow && !item.isParent && (
                                      <span className="text-[9px] text-orange-500 font-medium">!</span>
                                    )}
                                    {isSelected && (
                                      <ChevronRight className="w-3 h-3 text-[#1c6a1e]" />
                                    )}
                                    {!isCashier && (
                                      <div className="hidden group-hover:flex items-center">
                                        {(() => {
                                          const tc = productTypes.find((t) => t.key === (item.item_type || productTypes[0]?.key));
                                          return (
                                            <button
                                              type="button"
                                              onClick={(e) => handleToggleItemType(item, e)}
                                              disabled={togglingTypeId === item.id}
                                              className="p-0.5 rounded disabled:opacity-50"
                                              title={tc?.label}
                                            >
                                              {togglingTypeId === item.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <span className="text-[11px] leading-none">{tc?.emoji ?? '📦'}</span>
                                              )}
                                            </button>
                                          );
                                        })()}
                                        <button
                                          type="button"
                                          onClick={(e) => handleDeleteItemFromList(item, e)}
                                          disabled={deletingItemId === item.id}
                                          className="p-0.5 rounded text-red-500 disabled:opacity-50"
                                          title="Delete"
                                        >
                                          {deletingItemId === item.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-3 w-3" />
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {item.isParent && isExpanded && item.variants && (
                                <div className="ml-3 border-l border-blue-200 dark:border-blue-800 pl-1">
                                  {item.variants.map((variant) => {
                                    const variantIsLow = isLowStock(variant);
                                    const variantIsSelected = selectedItem?.id === variant.id;
                                    return (
                                      <div
                                        key={variant.id}
                                        className={`group rounded transition-colors ${
                                          variantIsSelected
                                            ? 'bg-blue-100/70 dark:bg-blue-900/25'
                                            : 'hover:bg-blue-50/60 dark:hover:bg-blue-900/15'
                                        }`}
                                      >
                                        <div className="flex items-center gap-0.5 min-h-[22px] py-px px-1">
                                          <button
                                            type="button"
                                            onClick={() => handleItemClick(variant)}
                                            className="flex items-center gap-1 flex-1 min-w-0 text-left"
                                          >
                                            <span className="truncate text-[10px] text-slate-600 dark:text-slate-400">
                                              {variant.variant_name || variant.name}
                                            </span>
                                            <span className="shrink-0 text-[10px] font-medium text-[#1c6a1e]">
                                              {formatPrice(variant.current_sell_price)}
                                            </span>
                                            <span className={`shrink-0 text-[10px] ${variant.current_stock <= 0 ? 'text-red-500' : variantIsLow ? 'text-orange-500' : 'text-slate-400'}`}>
                                              {formatStockCompact(variant.current_stock, variant.unit_type)}
                                            </span>
                                          </button>
                                          <div className="flex items-center shrink-0">
                                            {variantIsLow && (
                                              <span className="text-[9px] text-orange-500">!</span>
                                            )}
                                            {!isCashier && (
                                              <div className="hidden group-hover:flex items-center">
                                                {(() => {
                                                  const tc = productTypes.find((t) => t.key === (variant.item_type || productTypes[0]?.key));
                                                  return (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => handleToggleItemType(variant, e)}
                                                      disabled={togglingTypeId === variant.id}
                                                      className="p-0.5 rounded disabled:opacity-50"
                                                    >
                                                      {togglingTypeId === variant.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                      ) : (
                                                        <span className="text-[11px]">{tc?.emoji ?? '📦'}</span>
                                                      )}
                                                    </button>
                                                  );
                                                })()}
                                                <button
                                                  type="button"
                                                  onClick={(e) => handleDeleteItemFromList(variant, e)}
                                                  disabled={deletingItemId === variant.id}
                                                  className="p-0.5 rounded text-red-500 disabled:opacity-50"
                                                >
                                                  {deletingItemId === variant.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                  ) : (
                                                    <Trash2 className="h-3 w-3" />
                                                  )}
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {!isCashier && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddingVariantToParent(item.id);
                                        setEditingItem(null);
                                        setDrawerOpen(true);
                                      }}
                                      className="w-full text-left py-0.5 px-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      + variant
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
              <div className="space-y-2 min-h-0 overflow-y-auto">
                {selectedItem ? (
                  <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
                    <CardContent className="p-0">
                      {/* Detail Header */}
                      <div className={`flex items-start justify-between gap-2 p-2.5 border-b ${
                        selectedItem.isParent
                          ? 'border-l-[3px] border-l-purple-500 bg-purple-50/40 dark:bg-purple-900/10'
                          : selectedItem.variant_name
                            ? 'border-l-[3px] border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10'
                            : ''
                      } border-slate-100 dark:border-slate-800`}>
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                            selectedItem.isParent
                              ? 'bg-purple-100 dark:bg-purple-900/40'
                              : selectedItem.variant_name
                                ? 'bg-blue-100 dark:bg-blue-900/40'
                                : 'bg-emerald-50 dark:bg-emerald-900/20'
                          }`}>
                            {selectedItem.isParent ? (
                              <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            {selectedItem.isParent ? (
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Parent product</p>
                            ) : selectedItem.variant_name ? (
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                Variant
                                {(() => {
                                  const parentItem = items.find((i) => i.id === selectedItem.parent_item_id);
                                  return parentItem ? ` of ${parentItem.name}` : '';
                                })()}
                              </p>
                            ) : null}
                            <h2 className="font-semibold text-slate-900 dark:text-white truncate text-sm leading-tight">
                              {selectedItem.variant_name ? (selectedItem.variant_name || selectedItem.name) : selectedItem.name}
                            </h2>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {selectedItem.category_name || 'Uncategorized'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {!selectedItem.isParent && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handlePrintLabel(selectedItem)}
                              title="Print price label"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSelectedItem(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="p-2.5 space-y-2">
                        {selectedItem.isParent ? (
                          // Parent item view
                          <>
                            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-2.5 border border-purple-100 dark:border-purple-800/30">
                              <p className="text-xs text-purple-700 dark:text-purple-300">
                                Parent with <strong>{selectedItem.variantCount} variant(s)</strong> — only variants are sold.
                              </p>
                            </div>

                            {selectedItem.variants && selectedItem.variants.length > 0 && (
                              <div className="space-y-1.5">
                                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Variants</h3>
                                <div className="space-y-1">
                                  {selectedItem.variants.map((variant) => (
                                    <div 
                                      key={variant.id}
                                      className="flex items-center justify-between py-2 px-2.5 rounded-md border-l-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100/50"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm text-slate-700 dark:text-slate-300 truncate">
                                          {variant.variant_name}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {formatPrice(variant.current_sell_price)} • {formatStock(variant.current_stock, variant.unit_type)}
                                        </p>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 shrink-0"
                                        onClick={() => handleItemClick(variant)}
                                      >
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-1.5 pt-0.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedItem(null)}
                                className="h-8 flex-1 text-[10px]"
                              >
                                Close
                              </Button>
                              {!isCashier && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setAddingVariantToParent(selectedItem.id);
                                      setEditingItem(null);
                                      setDrawerOpen(true);
                                    }}
                                    className="h-8 flex-1 text-[10px] bg-purple-600 hover:bg-purple-700 text-white"
                                  >
                                    <Plus className="h-3 w-3 mr-0.5" />
                                    Variant
                                  </Button>
                                  <Button size="sm" onClick={handleEditClick} className="h-8 w-8 p-0 bg-[#1c6a1e] hover:bg-[#2a8a30]">
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" onClick={handleDeleteClick} disabled={isDeleting} variant="destructive" className="h-8 w-8 p-0">
                                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                  </Button>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          // Regular item or variant view
                          <>
                            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden divide-x divide-slate-200 dark:divide-slate-700">
                              <div className="flex-1 min-w-0 px-2 py-1.5 text-center">
                                <p className="text-[9px] uppercase tracking-wide text-slate-500">Price</p>
                                <div className="flex justify-center min-h-[1.25rem]">
                                  {!isCashier ? (
                                    <InlineEditableCell
                                      displayValue={formatPrice(selectedItem.current_sell_price)}
                                      isEditing={quickEditField === 'price'}
                                      value={quickEditValue}
                                      isSaving={quickSaving === 'price'}
                                      onStartEdit={startQuickPriceEdit}
                                      onChange={setQuickEditValue}
                                      onSave={saveQuickPrice}
                                      onCancel={cancelQuickEdit}
                                      valueKind="price"
                                      align="left"
                                      inline
                                      className="text-sm font-bold text-[#1c6a1e] leading-tight"
                                    />
                                  ) : (
                                    <p className="text-sm font-bold text-[#1c6a1e] leading-tight">
                                      {formatPrice(selectedItem.current_sell_price)}
                                    </p>
                                  )}
                                </div>
                                {selectedItem.buy_price != null && selectedItem.buy_price > 0 && (
                                  <p className="text-[9px] text-slate-400 leading-tight">Buy {formatPrice(selectedItem.buy_price)}</p>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 px-2 py-1.5 text-center">
                                <p className="text-[9px] uppercase tracking-wide text-slate-500">Stock</p>
                                <div className="flex justify-center min-h-[1.25rem]">
                                  <InlineEditableCell
                                    displayValue={formatStockCompact(selectedItem.current_stock, selectedItem.unit_type)}
                                    isEditing={quickEditField === 'stock'}
                                    value={quickEditValue}
                                    isSaving={quickSaving === 'stock'}
                                    onStartEdit={startQuickStockEdit}
                                    onChange={setQuickEditValue}
                                    onSave={saveQuickStock}
                                    onCancel={cancelQuickEdit}
                                    unitType={selectedItem.unit_type}
                                    valueKind="quantity"
                                    align="left"
                                    inline
                                    className={`text-sm font-bold leading-tight ${
                                      selectedItem.current_stock <= 0
                                        ? 'text-red-500'
                                        : isLowStock(selectedItem)
                                        ? 'text-orange-500'
                                        : 'text-slate-900 dark:text-white'
                                    }`}
                                  />
                                </div>
                                {selectedItem.min_stock_level != null && selectedItem.min_stock_level > 0 && (
                                  <p className="text-[9px] text-orange-600/80 dark:text-orange-400/80 leading-tight">
                                    min {selectedItem.min_stock_level}
                                  </p>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 px-2 py-1.5 text-center">
                                <p className="text-[9px] uppercase tracking-wide text-slate-500">Unit</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white capitalize leading-tight">
                                  {selectedItem.unit_type}
                                </p>
                              </div>
                              <div className="flex-1 min-w-0 px-2 py-1.5 text-center flex flex-col items-center justify-center">
                                <p className="text-[9px] uppercase tracking-wide text-slate-500">Status</p>
                                {selectedItem.current_stock <= 0 ? (
                                  <Badge variant="destructive" className="text-[9px] h-4 px-1.5 mt-0.5">Out</Badge>
                                ) : isLowStock(selectedItem) ? (
                                  <Badge className="bg-orange-500 text-[9px] h-4 px-1.5 mt-0.5">Low</Badge>
                                ) : (
                                  <Badge className="bg-[#1c6a1e] text-white text-[9px] h-4 px-1.5 mt-0.5">OK</Badge>
                                )}
                              </div>
                            </div>

                            {!isCashier ? (
                              <div className="flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 px-2 py-1 min-h-[1.75rem]">
                                <QrCode className="h-3 w-3 shrink-0 text-slate-400" />
                                <div className="min-w-0 flex-1">
                                  <InlineEditableCell
                                    displayValue={selectedItem.barcode || 'Add barcode'}
                                    isEditing={quickEditField === 'barcode'}
                                    value={quickEditValue}
                                    isSaving={quickSaving === 'barcode'}
                                    onStartEdit={startQuickBarcodeEdit}
                                    onChange={setQuickEditValue}
                                    onSave={saveQuickBarcode}
                                    onCancel={cancelQuickEdit}
                                    valueKind="text"
                                    allowEmpty
                                    align="left"
                                    className={`text-[10px] font-mono truncate w-full text-left ${
                                      selectedItem.barcode
                                        ? 'text-slate-700 dark:text-slate-300'
                                        : 'text-slate-400 italic'
                                    }`}
                                  />
                                </div>
                              </div>
                            ) : selectedItem.barcode ? (
                              <div className="flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 px-2 py-1">
                                <QrCode className="h-3 w-3 shrink-0 text-slate-400" />
                                <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 truncate">{selectedItem.barcode}</span>
                              </div>
                            ) : null}

                            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                              <Button size="sm" variant="outline" onClick={() => setSelectedItem(null)} className="h-8 text-[10px] px-1">
                                Close
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleAdjustStockClick} className="h-8 text-[10px] px-1 border-blue-500/60 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                                <TrendingUp className="h-3 w-3 mr-0.5 shrink-0" />
                                Stock
                              </Button>
                              {!isCashier ? (
                                <>
                                  <Button size="sm" onClick={handleEditClick} className="h-8 text-[10px] px-1 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white">
                                    <Edit className="h-3 w-3 mr-0.5 shrink-0" />
                                    Edit
                                  </Button>
                                  <Button size="sm" onClick={handleDeleteClick} disabled={isDeleting} variant="destructive" className="h-8 text-[10px] px-1">
                                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-0.5 shrink-0" />}
                                    Delete
                                  </Button>
                                </>
                              ) : (
                                <div className="col-span-2" />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
                    <CardContent className="p-8 text-center">
                      <div className="w-14 h-14 mx-auto bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3">
                        <Package className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-1">No item selected</p>
                      <p className="text-xs text-slate-400">
                        Select an item from the list
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
          <DrawerContent className="!w-full sm:!w-[520px] md:!w-[580px] !max-w-none h-full max-h-screen flex flex-col">
            <DrawerHeader className={`border-b bg-gradient-to-r from-purple-500/10 to-[#1c6a1e]/10 shrink-0 ${editingItem || addingVariantToParent ? 'py-2.5 px-4' : 'py-2.5 px-4'}`}>
              <DrawerTitle className={`flex items-center gap-2 ${editingItem || addingVariantToParent ? 'text-base' : 'text-base'}`}>
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
              <DrawerDescription className="text-xs">
                {addingVariantToParent
                  ? 'Required fields first — name, price, and unit'
                  : editingItem
                  ? 'Required fields first — expand optional if needed'
                  : 'Required fields first — expand optional if needed'}
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 px-4 pb-0 pt-2">
              <ItemForm
                itemId={editingItem?.id}
                parentItemId={addingVariantToParent || undefined}
                variantParentDefaults={variantParentDefaultsForForm}
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
                  image_url: editingItem.image_url,
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
                      description: getItemDisplayName(updatedItem.name, updatedItem.variant_name),
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
                          {(Number(adjustingItem.current_stock) || 0).toFixed(2)} <span className="text-base font-normal text-slate-500">{adjustingItem.unit_type}</span>
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
