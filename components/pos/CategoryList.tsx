'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Category } from '@/lib/db/types';
import { shouldShowCategory, SHOP_TYPE_ALL, type ShopType } from '@/lib/utils/shop-type';
import { apiGetOffline } from '@/lib/offline/api-offline';

interface CategoryListProps {
  onSelectCategory: (categoryId: string | null) => void;
  selectedCategoryId?: string;
  shopType?: ShopType;
  categories?: Category[];
}

export function CategoryList({
  onSelectCategory,
  selectedCategoryId,
  shopType = SHOP_TYPE_ALL,
  categories: propCategories,
}: CategoryListProps) {
  const [expanded, setExpanded] = useState(false);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(!propCategories);
  const [error, setError] = useState<string | null>(null);

  const categories = propCategories || localCategories;
  const isOfflineEmpty =
    error &&
    (error.includes('Offline') || error.includes('No cached') || error.includes('Network'));

  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setLoading(false);
      return;
    }

    async function fetchCategories() {
      try {
        setLoading(true);
        setError(null);
        const result = await apiGetOffline<Category[]>('/api/categories');

        if (result.success) {
          setLocalCategories(result.data ?? []);
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

  const filteredCategories = categories.filter((cat) =>
    shouldShowCategory(cat.name, shopType),
  );

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-2">
        <div className="h-8 w-32 bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 py-3 flex flex-col gap-1">
        <span className="text-sm font-medium text-red-500">
          {isOfflineEmpty
            ? 'No products cached for offline use'
            : 'Failed to load categories'}
        </span>
        {isOfflineEmpty && (
          <span className="text-xs text-muted-foreground">
            Connect to the internet and tap &quot;Sync for offline&quot; to download products.
          </span>
        )}
      </div>
    );
  }

  if (filteredCategories.length === 0) return null;

  const selectedName = selectedCategoryId
    ? filteredCategories.find((c) => c.id === selectedCategoryId)?.name
    : null;

  return (
    <div className="px-4 sm:px-6 py-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 min-h-[40px] text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 min-w-0">
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
              expanded ? 'rotate-0' : '-rotate-90'
            }`}
          />
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Categories
          </span>
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
            ({filteredCategories.length})
          </span>
        </span>
        {!expanded && (
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {selectedName ? `Selected: ${selectedName}` : 'Click to expand'}
          </span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-wrap gap-2 items-center pt-2 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {selectedCategoryId && (
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className="px-2.5 py-1 text-[9px] font-medium text-slate-500 dark:text-slate-400 hover:text-[#1c6a1e] transition-colors"
            >
              All
            </button>
          )}
          {filteredCategories.map((category) => {
            const isSelected = selectedCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                className={`px-2.5 py-1.5 text-[10px] font-medium whitespace-nowrap transition-all duration-150 ${
                  isSelected
                    ? 'text-[#1c6a1e] bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/15 border border-[#1c6a1e]/30'
                    : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-600/50 hover:border-[#1c6a1e]/40 hover:bg-[#1c6a1e]/5 dark:hover:bg-[#1c6a1e]/10 hover:text-[#1c6a1e]'
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
      )}
    </div>
  );
}
