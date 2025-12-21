'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Category } from '@/lib/db/types';

interface CategoryListProps {
  onSelectCategory: (categoryId: string | null) => void;
  selectedCategoryId?: string;
}

export function CategoryList({
  onSelectCategory,
  selectedCategoryId,
}: CategoryListProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        setLoading(true);
        const response = await fetch('/api/categories');
        const result = await response.json();

        if (result.success) {
          setCategories(result.data);
        } else {
          setError(result.message || 'Failed to load categories');
        }
      } catch (err) {
        setError('Failed to load categories');
        console.error('Error fetching categories:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto border-4 border-[#259783]/20 border-t-[#259783] rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading categories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-xl">⚠️</span>
          </div>
          <p className="text-destructive font-semibold">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-700">
          Categories
        </h2>
        {selectedCategoryId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectCategory(null)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear selection
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {categories.map((category) => {
          const isSelected = selectedCategoryId === category.id;
          return (
            <Button
              key={category.id}
              variant={isSelected ? 'default' : 'outline'}
              size="touch"
              className={`flex flex-col items-center justify-center h-20 sm:h-24 gap-2 transition-all duration-200 hover-lift ${
                isSelected
                  ? 'bg-[#259783] text-white border-0 shadow-lg scale-105 ring-2 ring-[#259783]/30'
                  : 'bg-white hover:bg-[#259783]/10 border-gray-200 hover:border-[#259783] shadow-sm hover:scale-102'
              }`}
              onClick={() =>
                onSelectCategory(isSelected ? null : category.id)
              }
            >
              {category.icon && (
                <span
                  className={`text-2xl sm:text-3xl transition-transform ${
                    isSelected ? 'scale-110' : ''
                  }`}
                >
                  {category.icon}
                </span>
              )}
              <span className="text-xs sm:text-sm font-semibold leading-tight">
                {category.name}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

