'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Grid3x3 } from 'lucide-react';
import type { Category } from '@/lib/db/types';

interface CategoryFormProps {
  category?: Category | null;
  onClose: () => void;
  onSuccess: () => void;
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

export function CategoryForm({ category, onClose, onSuccess }: CategoryFormProps) {
  const isEditing = !!category;
  const [selectedCategory, setSelectedCategory] = useState<string>(
    category?.name || 'custom'
  );
  const [isCustom, setIsCustom] = useState(!category || !COMMON_CATEGORIES.includes(category.name));
  
  const [formData, setFormData] = useState({
    name: category?.name || '',
    icon: category?.icon || '',
    position: category?.position?.toString() || '',
    active: category?.active ?? 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleCategorySelect = (value: string) => {
    setSelectedCategory(value);
    if (value === 'custom') {
      setIsCustom(true);
      setFormData((prev) => ({ ...prev, name: '', icon: '' }));
    } else {
      setIsCustom(false);
      // Auto-select first emoji for the category if available
      const suggestedEmoji = CATEGORY_EMOJIS[value]?.[0] || '';
      setFormData((prev) => ({ ...prev, name: value, icon: suggestedEmoji }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const url = isEditing ? `/api/categories/${category.id}` : '/api/categories';
      const method = isEditing ? 'PUT' : 'POST';

      const payload: Record<string, unknown> = {
        name: formData.name,
        icon: formData.icon || null,
      };

      if (formData.position) {
        payload.position = parseInt(formData.position);
      }

      if (isEditing) {
        payload.active = formData.active;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.message || 'Operation failed');
        setIsLoading(false);
        return;
      }

      onSuccess();
    } catch {
      setError('An error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {!isEditing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-semibold">Choose a Category</Label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {COMMON_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                const emoji = CATEGORY_EMOJIS[cat]?.[0] || '📦';
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    disabled={isLoading}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all duration-200
                      text-left group hover:shadow-md
                      ${isSelected 
                        ? 'border-[#259783] bg-[#259783]/5 dark:bg-[#259783]/10 shadow-sm' 
                        : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                      }
                      ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{emoji}</span>
                      <span className="font-medium text-sm flex-1">{cat}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="h-2 w-2 rounded-full bg-[#259783] animate-pulse" />
                      </div>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleCategorySelect('custom')}
                disabled={isLoading}
                className={`
                  relative p-4 rounded-lg border-2 border-dashed transition-all duration-200
                  text-left group hover:shadow-md
                  ${selectedCategory === 'custom'
                    ? 'border-[#259783] bg-[#259783]/5 dark:bg-[#259783]/10 shadow-sm'
                    : 'border-border bg-card hover:border-[#259783]/50 hover:bg-accent/50'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                  <span className="font-medium text-sm">Custom</span>
                </div>
                {selectedCategory === 'custom' && (
                  <div className="absolute top-2 right-2">
                    <div className="h-2 w-2 rounded-full bg-[#259783] animate-pulse" />
                  </div>
                )}
              </button>
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base font-semibold">
              Category Name
              {!isEditing && isCustom && (
                <Badge variant="outline" className="ml-2">Custom</Badge>
              )}
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={isCustom ? "Enter your custom category name" : "Category name"}
              required
              disabled={isLoading || (!isEditing && !isCustom)}
              className="h-11 text-base focus-visible:ring-[#259783]"
            />
            {!isEditing && !isCustom && formData.name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <span>Selected:</span>
                <Badge variant="secondary">{formData.name}</Badge>
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="icon" className="text-base font-semibold">
              Category Icon
              <span className="text-xs font-normal text-muted-foreground ml-2">(Optional)</span>
            </Label>
            
            {formData.name && CATEGORY_EMOJIS[formData.name] && (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">
                    Suggested icons for <span className="font-semibold text-foreground">{formData.name}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_EMOJIS[formData.name].map((emoji, idx) => {
                      const isSelected = formData.icon === emoji;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, icon: emoji }))}
                          disabled={isLoading}
                          className={`
                            text-3xl p-3 rounded-lg border-2 transition-all duration-200
                            hover:scale-110 hover:shadow-md
                            ${isSelected 
                              ? 'border-[#259783] bg-[#259783]/10 scale-105 shadow-sm' 
                              : 'border-border bg-background hover:border-[#259783]/50'
                            }
                            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                          title={`Select ${emoji}`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
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
              <p className="text-xs text-muted-foreground">
                {formData.name && CATEGORY_EMOJIS[formData.name]
                  ? 'Click an icon above or type your own emoji'
                  : 'Enter an emoji to represent this category visually'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position" className="text-base font-semibold">
              Display Position
              <span className="text-xs font-normal text-muted-foreground ml-2">(Optional)</span>
            </Label>
            <Input
              id="position"
              name="position"
              type="number"
              value={formData.position}
              onChange={handleChange}
              placeholder="Auto (will be added at the end)"
              min="0"
              disabled={isLoading}
              className="h-11 focus-visible:ring-[#259783]"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first in the category list. Leave empty to add at the end automatically.
            </p>
          </div>

          {isEditing && (
            <>
              <Separator />
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active === 1}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      active: e.target.checked ? 1 : 0,
                    }))
                  }
                  className="h-5 w-5 rounded border-gray-300 text-[#259783] focus:ring-[#259783] focus:ring-2"
                  disabled={isLoading}
                />
                <Label htmlFor="active" className="text-base font-medium cursor-pointer">
                  Category is Active
                </Label>
                <Badge variant={formData.active === 1 ? 'default' : 'secondary'} className="ml-auto">
                  {formData.active === 1 ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </>
          )}

          {error && (
            <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
              <span className="text-destructive">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11 bg-[#259783] hover:bg-[#45d827] text-white font-semibold shadow-md shadow-[#259783]/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Update Category'
              ) : (
                'Create Category'
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
