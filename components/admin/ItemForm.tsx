'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, Layers } from 'lucide-react';
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
  onSuccess?: () => void;
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
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [parentItemId]);

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
      const itemName = mode === 'variant' && parentItem
        ? `${parentItem.name} - ${variantName.trim()}`
        : name.trim();

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
          onSuccess();
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
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode Selection - only show for new items and not when creating variant for a parent */}
        {!isEditingExistingItem && !parentItemId && (
          <div className="space-y-3">
            <Label>Item Type</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode('standalone')}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  mode === 'standalone'
                    ? 'border-[#4bee2b] bg-[#4bee2b]/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <Package className="h-5 w-5 mb-1 text-slate-600 dark:text-slate-400" />
                <p className="text-sm font-medium">Standalone</p>
                <p className="text-xs text-slate-500">Single item</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('parent')}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  mode === 'parent'
                    ? 'border-[#4bee2b] bg-[#4bee2b]/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <Layers className="h-5 w-5 mb-1 text-purple-500" />
                <p className="text-sm font-medium">Parent</p>
                <p className="text-xs text-slate-500">Has variants</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('variant')}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  mode === 'variant'
                    ? 'border-[#4bee2b] bg-[#4bee2b]/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <Layers className="h-5 w-5 mb-1 text-blue-500" />
                <p className="text-sm font-medium">Variant</p>
                <p className="text-xs text-slate-500">Add to parent</p>
              </button>
            </div>
          </div>
        )}

        {/* Variant-specific: Parent selection */}
        {mode === 'variant' && !parentItemId && (
          <div className="space-y-2">
            <Label htmlFor="parent">Parent Item *</Label>
            <Select value={selectedParentId} onValueChange={(v) => {
              setSelectedParentId(v);
              const parent = parentItems.find(p => p.id === v);
              if (parent) {
                setCategoryId(parent.category_id);
              }
            }}>
              <SelectTrigger className="h-12 touch-target">
                <SelectValue placeholder="Select parent item" />
              </SelectTrigger>
              <SelectContent>
                {parentItems.length === 0 ? (
                  <p className="p-2 text-sm text-slate-500">No parent items. Create one first.</p>
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
        )}

        {/* Variant Name (for variants) */}
        {mode === 'variant' && (
          <div className="space-y-2">
            <Label htmlFor="variantName">Variant Name *</Label>
            <Input
              id="variantName"
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder="e.g., Big, Small, Red Kidney"
              required
              className="h-12 touch-target"
            />
            <p className="text-xs text-muted-foreground">
              This will be combined with parent name (e.g., "Tomatoes - Big")
            </p>
          </div>
        )}

        {/* Category Selection - show first */}
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
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
                // Reset item name selection when category changes
                setSelectedItemSuggestion('');
                setIsCustomItemName(true);
                setName('');
              }
            }}
            disabled={mode === 'variant' && !!parentItemId}
          >
            <SelectTrigger className="h-12 touch-target">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
              <SelectItem value="custom">+ Add New Category</SelectItem>
            </SelectContent>
          </Select>
          {isCustomCategory && (
            <div className="mt-2">
              <Input
                value={customCategoryName}
                onChange={(e) => setCustomCategoryName(e.target.value)}
                placeholder="Enter new category name"
                className="h-12 touch-target"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A new category will be created with this name
              </p>
            </div>
          )}
        </div>

        {/* Item Name (for standalone and parent modes) - show after category */}
        {mode !== 'variant' && (
          <div className="space-y-2">
            <Label htmlFor="name">
              {mode === 'parent' ? 'Product Name *' : 'Item Name *'}
            </Label>
            
            {/* Show dropdown if category is selected and we have suggestions (only for new items) */}
            {!itemId && categoryId && categoryId !== '' && !isCustomCategory && (() => {
              const categoryName = categories.find(c => c.id === categoryId)?.name || '';
              const suggestions = CATEGORY_ITEM_SUGGESTIONS[categoryName];
              return suggestions && suggestions.length > 0;
            })() && (
              <div className="space-y-2">
                <Select
                  value={selectedItemSuggestion || ''}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      setIsCustomItemName(true);
                      setSelectedItemSuggestion('');
                    } else {
                      setIsCustomItemName(false);
                      setSelectedItemSuggestion(value);
                      setName(value);
                    }
                  }}
                >
                  <SelectTrigger className="h-12 touch-target">
                    <SelectValue placeholder="Select common item name or choose custom" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ITEM_SUGGESTIONS[categories.find(c => c.id === categoryId)?.name || '']?.map((itemName) => (
                      <SelectItem key={itemName} value={itemName}>
                        {itemName}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom (Enter new name)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Always show input field, but show selected value if a suggestion was chosen */}
            {selectedItemSuggestion && !isCustomItemName ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-sm">
                  <span className="text-muted-foreground">Selected:</span>{' '}
                  <strong>{selectedItemSuggestion}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomItemName(true);
                    setSelectedItemSuggestion('');
                    setName('');
                  }}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Change to custom name
                </button>
              </div>
            ) : (
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Tomatoes"
                required
                className="h-12 touch-target"
                disabled={!!selectedItemSuggestion && !isCustomItemName}
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Unit Type - only for non-parent items */}
          {mode !== 'parent' && (
            <div className="space-y-2">
              <Label htmlFor="unit">Unit Type *</Label>
              <Select value={unitType} onValueChange={(v) => setUnitType(v as UnitType)}>
                <SelectTrigger className="h-12 touch-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogram (kg)</SelectItem>
                  <SelectItem value="g">Gram (g)</SelectItem>
                  <SelectItem value="piece">Piece</SelectItem>
                  <SelectItem value="bunch">Bunch</SelectItem>
                  <SelectItem value="tray">Tray</SelectItem>
                  <SelectItem value="litre">Litre (L)</SelectItem>
                  <SelectItem value="ml">Millilitre (ml)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Stock and Price fields - only for non-parent items */}
        {mode !== 'parent' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Initial Stock ({unitType})</Label>
                <Input
                  id="stock"
                  type="number"
                  step="0.01"
                  min="0"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  placeholder="0.00"
                  className="h-12 touch-target"
                />
                <p className="text-xs text-muted-foreground">
                  Starting stock level (default: 0)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyPrice">Buying Price (KES)</Label>
                <Input
                  id="buyPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="0.00"
                  className="h-12 touch-target"
                />
                <p className="text-xs text-muted-foreground">
                  Cost per {unitType} (required if stock &gt; 0)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Selling Price (KES) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="h-12 touch-target"
                />
                <p className="text-xs text-muted-foreground">
                  Price per {unitType}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minStock">Min Stock Level ({unitType})</Label>
              <Input
                id="minStock"
                type="number"
                step="0.01"
                min="0"
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(e.target.value)}
                placeholder="Leave empty for no alert"
                className="h-12 touch-target"
              />
              <p className="text-xs text-muted-foreground">
                Alert when stock falls below this level (optional)
              </p>
            </div>
          </>
        )}

        {/* Parent mode info */}
        {mode === 'parent' && (
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800/30">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              <strong>Parent items</strong> are containers for variants. They don&apos;t have their own stock or price. 
              After creating, you can add variants like "Big", "Small", or "Red Kidney".
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-4">
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
            size="touch"
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="touch"
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              itemId ? 'Update Item' : 
              mode === 'parent' ? 'Create Parent Item' :
              mode === 'variant' ? 'Create Variant' :
              'Create Item'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

