'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Grid3x3, Plus, X, Check } from 'lucide-react';
import type { Category } from '@/lib/db/types';
import { apiPost, apiPut } from '@/lib/utils/api-client';

interface CategoryFormProps {
  category?: Category | null;
  existingCategories?: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

interface PendingCategory {
  id: string;
  name: string;
  icon: string;
}

const COMMON_CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Grains & Cereals',
  'Spices',
  'Beverages',
  'Snacks',
  'Green Grocery',
  'Dairy',
  'Meat',
  'Bakery',
  'Frozen Foods',
  'Canned Goods',
];

const CATEGORY_EMOJIS: Record<string, string[]> = {
  'Vegetables': ['🥬', '🥕', '🥦', '🥒', '🌶️', '🫑', '🍅', '🥔', '🧅', '🥑', '🫒', '🌽'],
  'Fruits': ['🍎', '🍌', '🍊', '🍇', '🍓', '🥭', '🍑', '🥝', '🍍', '🍉', '🍐', '🍒'],
  'Grains & Cereals': ['🌾', '🌽', '🍞', '🥖', '🍚', '🌾', '🌾', '🥐', '🫘', '🫘', '🥨'],
  'Spices': ['🌶️', '🧄', '🧅', '🧂', '🌿', '🫚', '🫒', '🌶️'],
  'Beverages': ['🥤', '🧃', '☕', '🍵', '🧊', '🥛', '🧉', '🥤', '🍺', '🍷'],
  'Snacks': ['🍪', '🍫', '🍬', '🍭', '🥜', '🍿', '🍩', '🥨', '🍰', '🧁'],
  'Green Grocery': ['🥬', '🌿', '🥗', '🥒', '🥦', '🫑', '🫛'],
  'Dairy': ['🥛', '🧀', '🥚', '🧈', '🥛', '🍼', '🧈'],
  'Meat': ['🥩', '🍖', '🍗', '🥓', '🌭', '🍖', '🍗'],
  'Bakery': ['🍞', '🥖', '🥐', '🥨', '🥯', '🧁', '🍰', '🥧', '🧇', '🥞'],
  'Frozen Foods': ['🧊', '❄️', '🧊', '🍦', '🍧', '🧊'],
  'Canned Goods': ['🥫', '🥫', '🥫', '🍯', '🥫'],
};

export function CategoryForm({ category, existingCategories = [], onClose, onSuccess }: CategoryFormProps) {
  const isEditing = !!category;
  
  const existingCategoryNames = new Set(
    existingCategories.map(cat => cat.name.toLowerCase().trim())
  );
  
  const [pendingCategories, setPendingCategories] = useState<PendingCategory[]>([]);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  
  const [formData, setFormData] = useState({
    name: category?.name || '',
    icon: category?.icon || '',
    position: category?.position?.toString() || '',
    active: category?.active ?? 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);

  const availableCategories = COMMON_CATEGORIES.filter(cat => {
    const lowerCat = cat.toLowerCase().trim();
    const alreadyExists = existingCategoryNames.has(lowerCat);
    const alreadyPending = pendingCategories.some(p => p.name.toLowerCase().trim() === lowerCat);
    return !alreadyExists && !alreadyPending;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const toggleCommonCategory = (catName: string) => {
    const exists = pendingCategories.find(p => p.name === catName);
    if (exists) {
      setPendingCategories(prev => prev.filter(p => p.name !== catName));
    } else {
      const emoji = CATEGORY_EMOJIS[catName]?.[0] || '📦';
      setPendingCategories(prev => [
        ...prev,
        { id: `${catName}-${Date.now()}`, name: catName, icon: emoji }
      ]);
    }
  };

  const addCustomCategory = () => {
    const trimmedName = customName.trim();
    if (!trimmedName) return;
    
    const lowerName = trimmedName.toLowerCase();
    const alreadyExists = existingCategoryNames.has(lowerName);
    const alreadyPending = pendingCategories.some(p => p.name.toLowerCase() === lowerName);
    
    if (alreadyExists || alreadyPending) {
      setError(`Category "${trimmedName}" already exists`);
      return;
    }
    
    setPendingCategories(prev => [
      ...prev,
      { id: `custom-${Date.now()}`, name: trimmedName, icon: customIcon || '📦' }
    ]);
    setCustomName('');
    setCustomIcon('');
    setError(null);
  };

  const removePendingCategory = (id: string) => {
    setPendingCategories(prev => prev.filter(p => p.id !== id));
  };

  const updatePendingIcon = (id: string, icon: string) => {
    setPendingCategories(prev => 
      prev.map(p => p.id === id ? { ...p, icon } : p)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessCount(0);

    try {
      if (isEditing) {
        const url = `/api/categories/${category.id}`;
        const payload: Record<string, unknown> = {
          name: formData.name,
          icon: formData.icon || null,
          active: formData.active,
        };
        if (formData.position) {
          payload.position = parseInt(formData.position);
        }
        const result = await apiPut(url, payload);
        if (!result.success) {
          setError(result.message || 'Update failed');
          setIsLoading(false);
          return;
        }
        onSuccess();
        return;
      }

      // Creating multiple categories
      if (pendingCategories.length === 0) {
        setError('Please select or add at least one category');
        setIsLoading(false);
        return;
      }

      let created = 0;
      const errors: string[] = [];

      for (const cat of pendingCategories) {
        const result = await apiPost('/api/categories', {
          name: cat.name,
          icon: cat.icon || null,
        });
        if (result.success) {
          created++;
          setSuccessCount(created);
        } else {
          errors.push(`${cat.name}: ${result.message || 'Failed'}`);
        }
      }

      if (errors.length > 0 && created === 0) {
        setError(errors.join(', '));
        setIsLoading(false);
        return;
      }

      onSuccess();
    } catch {
      setError('An error occurred');
      setIsLoading(false);
    }
  };

  // Edit mode UI
  if (isEditing) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-semibold">Category Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Category name"
                required
                disabled={isLoading}
                className="h-11 text-base focus-visible:ring-[#259783]"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="icon" className="text-base font-semibold">
                Category Icon
                <span className="text-xs font-normal text-muted-foreground ml-2">(Optional)</span>
              </Label>
              
              {CATEGORY_EMOJIS[formData.name] && (
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Suggested icons</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_EMOJIS[formData.name].map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                        disabled={isLoading}
                        className={`text-3xl p-3 rounded-lg border-2 transition-all duration-200
                          hover:scale-110 hover:shadow-md
                          ${formData.icon === emoji 
                            ? 'border-[#259783] bg-[#259783]/10 scale-105 shadow-sm' 
                            : 'border-border bg-background hover:border-[#259783]/50'
                          }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Input
                id="icon"
                name="icon"
                value={formData.icon}
                onChange={handleChange}
                placeholder="🥬 Type or paste an emoji"
                maxLength={2}
                disabled={isLoading}
                className="h-11 text-lg focus-visible:ring-[#259783]"
              />
            </div>

            <Separator />
            
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border">
              <input
                type="checkbox"
                id="active"
                checked={formData.active === 1}
                onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked ? 1 : 0 }))}
                className="h-5 w-5 rounded border-gray-300 text-[#259783] focus:ring-[#259783]"
                disabled={isLoading}
              />
              <Label htmlFor="active" className="text-base font-medium cursor-pointer">
                Category is Active
              </Label>
              <Badge variant={formData.active === 1 ? 'default' : 'secondary'} className="ml-auto">
                {formData.active === 1 ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            {error && (
              <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                ⚠️ {error}
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" className="flex-1 h-11" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-11 bg-[#259783] hover:bg-[#45d827] text-white font-semibold"
                disabled={isLoading}
              >
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : 'Update Category'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // Create mode UI (supports multiple)
  return (
    <div className="max-w-2xl mx-auto py-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quick Select Common Categories */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-semibold">Quick Select Categories</Label>
            <Badge variant="secondary" className="ml-auto">Click to add</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {availableCategories.map((cat) => {
              const emoji = CATEGORY_EMOJIS[cat]?.[0] || '📦';
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCommonCategory(cat)}
                  disabled={isLoading}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all duration-200
                    text-left group hover:shadow-md
                    border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{emoji}</span>
                    <span className="font-medium text-sm flex-1">{cat}</span>
                    <Plus className="h-4 w-4 text-muted-foreground group-hover:text-[#259783]" />
                  </div>
                </button>
              );
            })}
          </div>
          {availableCategories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              All common categories have been added or already exist
            </p>
          )}
        </div>

        <Separator />

        {/* Add Custom Category */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-semibold">Add Custom Category</Label>
          </div>
          <div className="flex gap-2">
            <Input
              value={customIcon}
              onChange={(e) => setCustomIcon(e.target.value)}
              placeholder="📦"
              maxLength={2}
              disabled={isLoading}
              className="w-16 h-11 text-xl text-center focus-visible:ring-[#259783]"
            />
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Enter custom category name"
              disabled={isLoading}
              className="flex-1 h-11 focus-visible:ring-[#259783]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomCategory();
                }
              }}
            />
            <Button
              type="button"
              onClick={addCustomCategory}
              disabled={isLoading || !customName.trim()}
              className="h-11 bg-[#259783] hover:bg-[#45d827] text-white"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Pending Categories List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Categories to Create</Label>
            <Badge variant={pendingCategories.length > 0 ? 'default' : 'secondary'}>
              {pendingCategories.length} selected
            </Badge>
          </div>

          {pendingCategories.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground">
                Click on categories above or add custom ones
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {pendingCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#259783]/5 border border-[#259783]/20"
                >
                  <Input
                    value={cat.icon}
                    onChange={(e) => updatePendingIcon(cat.id, e.target.value)}
                    maxLength={2}
                    disabled={isLoading}
                    className="w-14 h-10 text-xl text-center border-[#259783]/30"
                  />
                  <span className="flex-1 font-medium">{cat.name}</span>
                  <Check className="h-4 w-4 text-[#259783]" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePendingCategory(cat.id)}
                    disabled={isLoading}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
            ⚠️ {error}
          </div>
        )}

        {isLoading && successCount > 0 && (
          <div className="p-4 text-sm text-[#259783] bg-[#259783]/10 border border-[#259783]/20 rounded-lg">
            ✓ Created {successCount} of {pendingCategories.length} categories...
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <Button type="button" variant="outline" className="flex-1 h-11" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 h-11 bg-[#259783] hover:bg-[#45d827] text-white font-semibold shadow-md shadow-[#259783]/20"
            disabled={isLoading || pendingCategories.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating {pendingCategories.length}...
              </>
            ) : (
              <>Create {pendingCategories.length} {pendingCategories.length === 1 ? 'Category' : 'Categories'}</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
