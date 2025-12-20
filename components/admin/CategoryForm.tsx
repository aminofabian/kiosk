'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X } from 'lucide-react';
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
      setFormData((prev) => ({ ...prev, name: '' }));
    } else {
      setIsCustom(false);
      setFormData((prev) => ({ ...prev, name: value }));
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
    <Card className="max-w-lg mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{isEditing ? 'Edit Category' : 'Add New Category'}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="category-select">Select Category</Label>
              <Select value={selectedCategory} onValueChange={handleCategorySelect} disabled={isLoading}>
                <SelectTrigger id="category-select">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom (Enter new name)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Category Name {!isEditing && isCustom && '(Custom)'}</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={isCustom ? "Enter custom category name" : "e.g., Vegetables"}
              required
              disabled={isLoading || (!isEditing && !isCustom)}
            />
            {!isEditing && !isCustom && (
              <p className="text-xs text-muted-foreground">
                Selected: <strong>{formData.name}</strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon">Icon (Emoji)</Label>
            <Input
              id="icon"
              name="icon"
              value={formData.icon}
              onChange={handleChange}
              placeholder="🥬 (optional)"
              maxLength={2}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Use an emoji or leave empty
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Input
              id="position"
              name="position"
              type="number"
              value={formData.position}
              onChange={handleChange}
              placeholder="Auto (leave empty)"
              min="0"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first. Leave empty to add at the end.
            </p>
          </div>

          {isEditing && (
            <div className="flex items-center gap-2">
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
                className="h-4 w-4"
                disabled={isLoading}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
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
        </form>
      </CardContent>
    </Card>
  );
}
