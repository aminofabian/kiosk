'use client';

import { useEffect, useState } from 'react';
import type { Category } from '@/lib/db/types';
import { shouldShowCategory, type ShopType } from '@/lib/utils/shop-type';

interface CategoryListProps {
  onSelectCategory: (categoryId: string | null) => void;
  selectedCategoryId?: string;
  shopType?: ShopType;
  categories?: Category[]; // Pass categories from parent to avoid redundant fetch
}

export function CategoryList({
  onSelectCategory,
  selectedCategoryId,
  shopType = 'grocery',
  categories: propCategories,
}: CategoryListProps) {
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(!propCategories);
  const [error, setError] = useState<string | null>(null);

  // Use prop categories if available
  const categories = propCategories || localCategories;

  useEffect(() => {
    // Skip fetch if categories provided via props
    if (propCategories && propCategories.length > 0) {
      setLoading(false);
      return;
    }

    async function fetchCategories() {
      try {
        setLoading(true);
        const response = await fetch('/api/categories');
        const result = await response.json();

        if (result.success) {
          setLocalCategories(result.data);
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
  }, [propCategories]);

  const filteredCategories = categories.filter(cat => 
    shouldShowCategory(cat.name, shopType)
  );

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-2">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 w-16 bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 py-3 flex items-center gap-2 text-red-500">
        <span className="text-sm font-medium">Failed to load categories</span>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/30">
      <div className="flex flex-wrap gap-2 items-center">
        {selectedCategoryId && (
          <button
            onClick={() => onSelectCategory(null)}
            className="px-2.5 py-1 text-[9px] font-medium text-slate-500 dark:text-slate-400 hover:text-[#259783] transition-colors"
          >
            All
          </button>
        )}
        {filteredCategories.map((category) => {
          const isSelected = selectedCategoryId === category.id;
          return (
            <button
              key={category.id}
              className={`px-2.5 py-1.5 text-[10px] font-medium whitespace-nowrap transition-all duration-150 ${
                isSelected
                  ? 'text-[#259783] bg-[#259783]/10 dark:bg-[#259783]/15 border border-[#259783]/30'
                  : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-600/50 hover:border-[#259783]/40 hover:bg-[#259783]/5 dark:hover:bg-[#259783]/10 hover:text-[#259783]'
              }`}
              onClick={() =>
                onSelectCategory(isSelected ? null : category.id)
              }
            >
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

