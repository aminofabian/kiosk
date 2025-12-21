'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Layers, ShoppingCart, DollarSign, Box, AlertCircle, Info, Sparkles, Grid3x3 } from 'lucide-react';
import type { Category, Item } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';

type FormMode = 'standalone' | 'parent' | 'variant';

const CATEGORY_ITEM_SUGGESTIONS: Record<string, string[]> = {
  'Vegetables': ['Tomatoes', 'Onions', 'Potatoes', 'Carrots', 'Cabbage', 'Bell Peppers', 'Eggplant', 'Okra', 'Green Beans', 'Cauliflower', 'Broccoli', 'Spinach', 'Lettuce', 'Cucumber', 'Zucchini'],
  'Fruits': ['Bananas', 'Apples', 'Oranges', 'Mangoes', 'Grapes', 'Strawberries', 'Watermelon', 'Pineapple', 'Papaya', 'Avocado', 'Pears', 'Cherries', 'Peaches', 'Plums', 'Berries'],
  'Grains & Cereals': ['Rice', 'Wheat', 'Maize', 'Oats', 'Barley', 'Quinoa', 'Millet', 'Sorghum', 'Flour', 'Pasta', 'Noodles'],
  'Spices': ['Salt', 'Black Pepper', 'Turmeric', 'Cumin', 'Coriander', 'Garlic', 'Ginger', 'Chili Powder', 'Paprika', 'Cinnamon', 'Cardamom', 'Cloves'],
  'Beverages': ['Water', 'Juice', 'Soda', 'Tea', 'Coffee', 'Milk', 'Yogurt Drink', 'Energy Drink', 'Soft Drink', 'Mineral Water'],
  'Snacks': ['Chips', 'Biscuits', 'Cookies', 'Crackers', 'Nuts', 'Popcorn', 'Chocolate', 'Candy', 'Cakes', 'Pastries'],
  'Green Grocery': ['Spinach', 'Kale', 'Lettuce', 'Coriander', 'Parsley', 'Mint', 'Basil', 'Arugula', 'Spring Onions', 'Dill', 'Chives'],
  'Dairy': ['Milk', 'Cheese', 'Yogurt', 'Butter', 'Eggs', 'Cream', 'Sour Cream', 'Cottage Cheese', 'Mozzarella'],
  'Meat': ['Beef', 'Chicken', 'Pork', 'Lamb', 'Fish', 'Turkey', 'Bacon', 'Sausages', 'Ham', 'Mince'],
  'Bakery': ['Bread', 'White Bread', 'Brown Bread', 'Baguette', 'Croissant', 'Donuts', 'Muffins', 'Cookies', 'Cakes', 'Pastries'],
  'Frozen Foods': ['Ice Cream', 'Frozen Vegetables', 'Frozen Fruits', 'Frozen Meat', 'Frozen Fish', 'Frozen Pizza'],
  'Canned Goods': ['Canned Tomatoes', 'Canned Beans', 'Canned Corn', 'Canned Peas', 'Canned Fish', 'Canned Fruits'],
};

interface ItemFormProps {
  itemId?: string;
  initialData?: {
    name: string;
    category_id: string;
    unit_type: UnitType;
    current_stock: number;
    current_sell_price: number;
    min_stock_level: number | null;
    buy_price?: number | null;
    variant_name?: string | null;
    parent_item_id?: string | null;
  };
  parentItemId?: string; // If set, we're creating a variant for this parent
  defaultMode?: FormMode;
  onSuccess?: (updatedItem?: Item) => void;
  onCancel?: () => void;
}

export function ItemForm({ 
  itemId, 
  initialData, 
  parentItemId, 
  defaultMode = 'standalone',
  onSuccess, 
  onCancel 
}: ItemFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [parentItems, setParentItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<FormMode>(
    parentItemId ? 'variant' : 
    initialData?.parent_item_id ? 'variant' : 
    defaultMode
  );
  const [name, setName] = useState<string>(initialData?.name || '');
  const [selectedItemSuggestion, setSelectedItemSuggestion] = useState<string>('');
  const [isCustomItemName, setIsCustomItemName] = useState(true);
  const [variantName, setVariantName] = useState<string>(initialData?.variant_name || '');
  const [selectedParentId, setSelectedParentId] = useState<string>(parentItemId || initialData?.parent_item_id || '');
  const [categoryId, setCategoryId] = useState<string>(initialData?.category_id || '');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [unitType, setUnitType] = useState<UnitType>(initialData?.unit_type || 'piece');
  const [initialStock, setInitialStock] = useState<string>(initialData?.current_stock?.toString() || '0');
  const [buyPrice, setBuyPrice] = useState<string>(initialData?.buy_price?.toString() || '');
  const [sellPrice, setSellPrice] = useState<string>(initialData?.current_sell_price?.toString() || '');
  const [minStockLevel, setMinStockLevel] = useState<string>(initialData?.min_stock_level?.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [categoriesRes, parentsRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/items?all=true&parentsOnly=true'),
        ]);
        
        const categoriesResult = await categoriesRes.json();
        const parentsResult = await parentsRes.json();
        
        if (categoriesResult.success) {
          setCategories(categoriesResult.data);
        }
        if (parentsResult.success) {
          setParentItems(parentsResult.data);
        }
        
        // If parentItemId is set, get the parent's category
        if (parentItemId && parentsResult.success) {
          const parent = parentsResult.data.find((p: Item) => p.id === parentItemId);
          if (parent) {
            setCategoryId(parent.category_id);
          }
        }
        
        // If editing a variant and parent not in list, try to fetch it
        if (itemId && initialData?.parent_item_id && parentsResult.success) {
          const parent = parentsResult.data.find((p: Item) => p.id === initialData.parent_item_id);
          if (!parent && initialData.parent_item_id) {
            // Parent not in parents list, try to fetch it directly
            try {
              const parentRes = await fetch(`/api/items/${initialData.parent_item_id}`);
              const parentResult = await parentRes.json();
              if (parentResult.success && parentResult.data) {
                // Add to parent items list if it's actually a parent
                if (parentResult.data.isParent) {
                  setParentItems(prev => [...prev, parentResult.data]);
                }
              }
            } catch (err) {
              console.error('Error fetching parent item:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [parentItemId, itemId, initialData?.parent_item_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate category
    if (isCustomCategory) {
      if (!customCategoryName.trim()) {
        setError('Category name is required when creating a new category');
        return;
      }
    } else {
      if (!categoryId) {
        setError('Category is required');
        return;
      }
    }

    // Parent mode validation
    if (mode === 'parent') {
      if (!name.trim()) {
        setError('Item name is required');
        return;
      }
      if (!categoryId && !isCustomCategory) {
        setError('Category is required');
        return;
      }
    } else {
      // Standalone or variant mode validation
      if (!name.trim() && mode !== 'variant') {
        setError('Item name is required');
        return;
      }
      
      if (mode === 'variant') {
        if (!selectedParentId) {
          setError('Parent item is required for variants');
          return;
        }
        if (!variantName.trim()) {
          setError('Variant name is required');
          return;
        }
      }

      if (!categoryId && !isCustomCategory) {
        setError('Category is required');
        return;
      }

      if (!sellPrice || parseFloat(sellPrice) <= 0) {
        setError('Sell price must be greater than 0');
        return;
      }
    }

    const stock = parseFloat(initialStock) || 0;
    const buy = buyPrice ? parseFloat(buyPrice) : null;
    const price = mode === 'parent' ? 0 : parseFloat(sellPrice);
    const minStock = minStockLevel ? parseFloat(minStockLevel) : null;

    if (mode !== 'parent' && stock > 0 && buy !== null && buy <= 0) {
      setError('Buy price must be greater than 0 when setting initial stock');
      return;
    }

    if (mode !== 'parent' && minStock !== null && minStock < 0) {
      setError('Min stock level cannot be negative');
      return;
    }

    setIsSubmitting(true);

    try {
      let finalCategoryId = categoryId;
      
      // If custom category, create it first
      if (isCustomCategory && customCategoryName.trim()) {
        const categoryResponse = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: customCategoryName.trim() }),
        });
        
        const categoryResult = await categoryResponse.json();
        if (!categoryResult.success) {
          setError(categoryResult.message || 'Failed to create category');
          setIsSubmitting(false);
          return;
        }
        
        // Fetch updated categories to get the new category ID
        const categoriesRes = await fetch('/api/categories');
        const categoriesResult = await categoriesRes.json();
        if (categoriesResult.success) {
          const newCategory = categoriesResult.data.find(
            (cat: Category) => cat.name === customCategoryName.trim()
          );
          if (newCategory) {
            finalCategoryId = newCategory.id;
            setCategories(categoriesResult.data);
            setIsCustomCategory(false);
            setCategoryId(newCategory.id);
          } else {
            setError('Category was created but could not be found');
            setIsSubmitting(false);
            return;
          }
        }
      }

      const url = itemId ? `/api/items/${itemId}` : '/api/items';
      const method = itemId ? 'PUT' : 'POST';
      
      // Get parent name for variant display name
      const parentItem = mode === 'variant' 
        ? parentItems.find(p => p.id === selectedParentId) 
        : null;
      
      // Build the item name: for variants, use "ParentName - VariantName"
      let itemName: string;
      if (mode === 'variant') {
        if (parentItem) {
          // Use parent name from the list
          itemName = `${parentItem.name} - ${variantName.trim()}`;
        } else if (itemId && initialData?.name) {
          // When editing a variant, if parent not found, extract parent name from existing name
          // Format is typically "ParentName - VariantName"
          const existingName = initialData.name;
          const existingVariantName = initialData.variant_name || '';
          
          if (existingName.includes(' - ') && existingVariantName) {
            // Extract parent name by removing the existing variant part
            const parentName = existingName.replace(` - ${existingVariantName}`, '').trim();
            itemName = `${parentName} - ${variantName.trim()}`;
          } else if (existingName.includes(' - ')) {
            // If we have the separator but no stored variant name, try to extract
            // by using the last part as the variant
            const parts = existingName.split(' - ');
            if (parts.length >= 2) {
              const parentName = parts.slice(0, -1).join(' - ').trim();
              itemName = `${parentName} - ${variantName.trim()}`;
            } else {
              itemName = existingName;
            }
          } else {
            // Fallback: if we can't extract, use the existing name structure
            // This handles cases where the name format might be different
            itemName = existingName;
          }
        } else if (itemId && name.trim()) {
          // Fallback: use the provided name (might already be correctly formatted)
          itemName = name.trim();
        } else {
          // New variant but parent not found - use provided name or build from variant
          itemName = name.trim() || (variantName.trim() ? `Item - ${variantName.trim()}` : '');
        }
      } else {
        itemName = name.trim();
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: itemName,
          categoryId: finalCategoryId,
          unitType,
          initialStock: mode === 'parent' ? 0 : stock,
          buyPrice: mode === 'parent' ? null : buy,
          sellPrice: price,
          minStockLevel: mode === 'parent' ? null : minStock,
          isParent: mode === 'parent',
          parentItemId: mode === 'variant' ? selectedParentId : null,
          variantName: mode === 'variant' ? variantName.trim() : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (onSuccess) {
          onSuccess(result.data);
        } else {
          router.push('/admin/items');
        }
      } else {
        setError(result.message || 'Failed to save item');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Item save error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const isEditingExistingItem = !!itemId;

  return (
    <div className="max-w-2xl mx-auto py-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mode Selection - only show for new items and not when creating variant for a parent */}
        {!isEditingExistingItem && !parentItemId && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-semibold">What type of product is this?</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setMode('standalone')}
                disabled={isSubmitting}
                className={`
                  relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                  hover:shadow-md group
                  ${mode === 'standalone'
                    ? 'border-[#259783] bg-[#259783]/5 dark:bg-[#259783]/10 shadow-sm'
                    : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Single Product</p>
                    <p className="text-xs text-muted-foreground">
                      A regular item you sell (e.g., "Tomatoes", "Milk")
                    </p>
                  </div>
                </div>
                {mode === 'standalone' && (
                  <div className="absolute top-2 right-2">
                    <div className="h-2 w-2 rounded-full bg-[#259783] animate-pulse" />
                  </div>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => setMode('parent')}
                disabled={isSubmitting}
                className={`
                  relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                  hover:shadow-md group
                  ${mode === 'parent'
                    ? 'border-purple-500 bg-purple-500/5 dark:bg-purple-500/10 shadow-sm'
                    : 'border-border bg-card hover:border-purple-500/50 hover:bg-accent/50'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                    <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Product with Variants</p>
                    <p className="text-xs text-muted-foreground">
                      Has different sizes/types (e.g., "Beans" → Big, Small)
                    </p>
                  </div>
                </div>
                {mode === 'parent' && (
                  <div className="absolute top-2 right-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                  </div>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => setMode('variant')}
                disabled={isSubmitting}
                className={`
                  relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                  hover:shadow-md group
                  ${mode === 'variant'
                    ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 shadow-sm'
                    : 'border-border bg-card hover:border-blue-500/50 hover:bg-accent/50'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                    <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Add Variant</p>
                    <p className="text-xs text-muted-foreground">
                      Add size/type to existing product
                    </p>
                  </div>
                </div>
                {mode === 'variant' && (
                  <div className="absolute top-2 right-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Variant-specific: Parent selection */}
        {mode === 'variant' && !parentItemId && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="parent" className="text-base font-semibold">Which product is this a variant of? *</Label>
              </div>
              <Select 
                value={selectedParentId} 
                onValueChange={(v) => {
                  setSelectedParentId(v);
                  const parent = parentItems.find(p => p.id === v);
                  if (parent) {
                    setCategoryId(parent.category_id);
                  }
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Choose the main product..." />
                </SelectTrigger>
                <SelectContent>
                  {parentItems.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-2">No products with variants found.</p>
                      <p className="text-xs text-muted-foreground">Create a "Product with Variants" first.</p>
                    </div>
                  ) : (
                    parentItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Variant Name (for variants) */}
        {mode === 'variant' && (
          <div className="space-y-2">
            <Label htmlFor="variantName" className="text-base font-semibold">
              What's the variant name? *
            </Label>
            <Input
              id="variantName"
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder="e.g., Big, Small, Red Kidney, 500g"
              required
              disabled={isSubmitting}
              className="h-12 text-base focus-visible:ring-[#259783]"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              This will appear as "{selectedParentId ? parentItems.find(p => p.id === selectedParentId)?.name || 'Product' : 'Product'} - {variantName || 'Variant'}"
            </p>
          </div>
        )}

        <Separator />

        {/* Category Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-semibold">Which category does this belong to? *</Label>
          </div>
          
          {categories.length > 0 && !isCustomCategory ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((category) => {
                const isSelected = categoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(category.id);
                      setIsCustomCategory(false);
                      setCustomCategoryName('');
                      // Reset item name selection when category changes
                      setSelectedItemSuggestion('');
                      setIsCustomItemName(true);
                      setName('');
                    }}
                    disabled={isSubmitting || (mode === 'variant' && !!parentItemId)}
                    className={`
                      relative p-3 rounded-lg border-2 transition-all duration-200
                      text-left hover:shadow-sm
                      ${isSelected 
                        ? 'border-[#259783] bg-[#259783]/5 dark:bg-[#259783]/10 shadow-sm' 
                        : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                      }
                      ${isSubmitting || (mode === 'variant' && !!parentItemId) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{category.icon || '📦'}</span>
                      <span className="font-medium text-sm flex-1">{category.name}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#259783] animate-pulse" />
                      </div>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setIsCustomCategory(true);
                  setCategoryId('');
                  setCustomCategoryName('');
                }}
                disabled={isSubmitting || (mode === 'variant' && !!parentItemId)}
                className={`
                  relative p-3 rounded-lg border-2 border-dashed transition-all duration-200
                  text-left hover:shadow-sm
                  ${isCustomCategory
                    ? 'border-[#259783] bg-[#259783]/5 dark:bg-[#259783]/10 shadow-sm'
                    : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                  }
                  ${isSubmitting || (mode === 'variant' && !!parentItemId) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-sm">New Category</span>
                </div>
                {isCustomCategory && (
                  <div className="absolute top-1.5 right-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#259783] animate-pulse" />
                  </div>
                )}
              </button>
            </div>
          ) : (
            <Select 
              value={isCustomCategory ? 'custom' : categoryId} 
              onValueChange={(value) => {
                if (value === 'custom') {
                  setIsCustomCategory(true);
                  setCategoryId('');
                  setCustomCategoryName('');
                } else {
                  setIsCustomCategory(false);
                  setCategoryId(value);
                  setSelectedItemSuggestion('');
                  setIsCustomItemName(true);
                  setName('');
                }
              }}
              disabled={isSubmitting || (mode === 'variant' && !!parentItemId)}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Choose a category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <span>{category.icon || '📦'}</span>
                      <span>{category.name}</span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="custom">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Create New Category</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
          
          {isCustomCategory && (
            <div className="mt-2 p-4 rounded-lg bg-muted/50 border">
              <Label htmlFor="customCategory" className="text-sm font-medium mb-2 block">
                New Category Name
              </Label>
              <Input
                id="customCategory"
                value={customCategoryName}
                onChange={(e) => setCustomCategoryName(e.target.value)}
                placeholder="e.g., Electronics, Stationery"
                disabled={isSubmitting}
                className="h-11 focus-visible:ring-[#259783]"
              />
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Info className="h-3 w-3" />
                A new category will be created automatically
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Item Name (for standalone and parent modes) */}
        {mode !== 'variant' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="name" className="text-base font-semibold">
                What's the product name? *
              </Label>
            </div>
            
            {/* Show suggestions if category is selected and we have suggestions (only for new items) */}
            {!itemId && categoryId && categoryId !== '' && !isCustomCategory && (() => {
              const categoryName = categories.find(c => c.id === categoryId)?.name || '';
              const suggestions = CATEGORY_ITEM_SUGGESTIONS[categoryName];
              return suggestions && suggestions.length > 0;
            })() && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Quick pick from common items:</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ITEM_SUGGESTIONS[categories.find(c => c.id === categoryId)?.name || '']?.slice(0, 8).map((itemName) => {
                    const isSelected = selectedItemSuggestion === itemName && !isCustomItemName;
                    return (
                      <button
                        key={itemName}
                        type="button"
                        onClick={() => {
                          setIsCustomItemName(false);
                          setSelectedItemSuggestion(itemName);
                          setName(itemName);
                        }}
                        disabled={isSubmitting}
                        className={`
                          px-3 py-1.5 rounded-lg border text-sm transition-all
                          ${isSelected
                            ? 'border-[#259783] bg-[#259783]/10 text-[#259783] font-medium'
                            : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                          }
                          ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {itemName}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomItemName(true);
                      setSelectedItemSuggestion('');
                      setName('');
                    }}
                    disabled={isSubmitting}
                    className={`
                      px-3 py-1.5 rounded-lg border-2 border-dashed text-sm transition-all
                      ${isCustomItemName
                        ? 'border-[#259783] bg-[#259783]/10 text-[#259783] font-medium'
                        : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                      }
                      ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    Custom
                  </button>
                </div>
              </div>
            )}
            
            {/* Input field */}
            {selectedItemSuggestion && !isCustomItemName ? (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Selected:</p>
                    <p className="font-semibold text-base">{selectedItemSuggestion}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomItemName(true);
                      setSelectedItemSuggestion('');
                      setName('');
                    }}
                    disabled={isSubmitting}
                    className="text-xs text-primary hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === 'parent' ? 'e.g., Beans, Rice, Flour' : 'e.g., Tomatoes, Milk, Bread'}
                required
                disabled={isSubmitting}
                className="h-12 text-base focus-visible:ring-[#259783]"
              />
            )}
          </div>
        )}

        <Separator />

        {/* Unit Type - only for non-parent items */}
        {mode !== 'parent' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="unit" className="text-base font-semibold">How do you sell this? *</Label>
            </div>
            <Select 
              value={unitType} 
              onValueChange={(v) => setUnitType(v as UnitType)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="piece">By Piece (1, 2, 3...)</SelectItem>
                <SelectItem value="kg">By Kilogram (kg)</SelectItem>
                <SelectItem value="g">By Gram (g)</SelectItem>
                <SelectItem value="bunch">By Bunch</SelectItem>
                <SelectItem value="tray">By Tray</SelectItem>
                <SelectItem value="litre">By Litre (L)</SelectItem>
                <SelectItem value="ml">By Millilitre (ml)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              This determines how you measure and price the product
            </p>
          </div>
        )}

        {/* Stock and Price fields - only for non-parent items */}
        {mode !== 'parent' && (
          <>
            <Separator />
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-semibold">Pricing & Stock Information</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Selling Price */}
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-medium">
                    Selling Price (KES) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">KES</span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="0.00"
                      required
                      disabled={isSubmitting}
                      className="h-12 pl-12 text-base focus-visible:ring-[#259783]"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    How much you sell 1 {unitType} for
                  </p>
                </div>

                {/* Buying Price */}
                <div className="space-y-2">
                  <Label htmlFor="buyPrice" className="text-sm font-medium">
                    Buying Price (KES)
                    <span className="text-xs font-normal text-muted-foreground ml-1">(Optional)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">KES</span>
                    <Input
                      id="buyPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      placeholder="0.00"
                      disabled={isSubmitting}
                      className="h-12 pl-12 text-base focus-visible:ring-[#259783]"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    How much you buy 1 {unitType} for
                  </p>
                </div>
              </div>

              {/* Stock Information */}
              <div className="p-4 rounded-lg bg-muted/30 border space-y-4">
                {!itemId ? (
                  <div className="space-y-2">
                    <Label htmlFor="stock" className="text-sm font-medium">
                      Starting Stock ({unitType})
                      <span className="text-xs font-normal text-muted-foreground ml-1">(Optional)</span>
                    </Label>
                    <Input
                      id="stock"
                      type="number"
                      step="0.01"
                      min="0"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      placeholder="0.00"
                      disabled={isSubmitting}
                      className="h-12 text-base focus-visible:ring-[#259783]"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      How many {unitType}s you have right now (leave 0 if none)
                    </p>
                    {parseFloat(initialStock) > 0 && !buyPrice && (
                      <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Add buying price if you have stock
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Current Stock ({unitType})</Label>
                    <div className="h-12 px-4 flex items-center bg-background rounded-md border border-border">
                      <span className="text-foreground font-semibold text-lg">
                        {initialData?.current_stock?.toFixed(2) || '0.00'} {unitType}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Update stock by adding purchases
                    </p>
                  </div>
                )}

                {/* Min Stock Level */}
                <div className="space-y-2">
                  <Label htmlFor="minStock" className="text-sm font-medium">
                    Low Stock Alert ({unitType})
                    <span className="text-xs font-normal text-muted-foreground ml-1">(Optional)</span>
                  </Label>
                  <Input
                    id="minStock"
                    type="number"
                    step="0.01"
                    min="0"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(e.target.value)}
                    placeholder="Leave empty for no alert"
                    disabled={isSubmitting}
                    className="h-12 text-base focus-visible:ring-[#259783]"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Get notified when stock goes below this amount
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Parent mode info */}
        {mode === 'parent' && (
          <>
            <Separator />
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800/30">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    Product with Variants
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    This product will have different sizes or types. After creating it, you can add variants like "Big", "Small", or "Red Kidney" with their own prices and stock.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <Separator />

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (onCancel) {
                onCancel();
              } else {
                router.push('/admin/items');
              }
            }}
            className="flex-1 h-11"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-11 bg-[#259783] hover:bg-[#45d827] text-white font-semibold shadow-md shadow-[#259783]/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              itemId ? 'Update Product' : 
              mode === 'parent' ? 'Create Product' :
              mode === 'variant' ? 'Add Variant' :
              'Create Product'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

