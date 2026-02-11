'use client';

import { useEffect, useState } from 'react';
import type { Category } from '@/lib/db/types';
import { shouldShowCategory, type ShopType } from '@/lib/utils/shop-type';
import {
  Leaf,
  Apple,
  Wheat,
  Flame,
  Droplets,
  Package,
  Sprout,
  GlassWater,
  Drumstick,
  Croissant,
  Snowflake,
  Box,
  Utensils,
  Candy,
  Sparkles,
  Heart,
  Home,
  FileText,
  Store,
  Pill,
  Coffee,
  Cake,
  Shirt,
  BookOpen,
  UtensilsCrossed,
} from 'lucide-react';

// Icon map for predefined categories - all icons use consistent size w-6 h-6 for desktop
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  // Grocery categories
  'Vegetables': <Leaf className="w-6 h-6" />,
  'Fruits': <Apple className="w-6 h-6" />,
  'Grains & Cereals': <Wheat className="w-6 h-6" />,
  'Spices': <Flame className="w-6 h-6" />,
  'Beverages': <Droplets className="w-6 h-6" />,
  'Snacks': <Package className="w-6 h-6" />,
  'Green Grocery': <Sprout className="w-6 h-6" />,
  'Dairy': <GlassWater className="w-6 h-6" />,
  'Meat': <Drumstick className="w-6 h-6" />,
  'Bakery': <Croissant className="w-6 h-6" />,
  'Frozen Foods': <Snowflake className="w-6 h-6" />,
  'Canned Goods': <Box className="w-6 h-6" />,
  // Retail categories
  'Food Essentials': <Utensils className="w-6 h-6" />,
  'Snacks & Confectionery': <Candy className="w-6 h-6" />,
  'Cleaning Products': <Sparkles className="w-6 h-6" />,
  'Personal Care': <Heart className="w-6 h-6" />,
  'Household Items': <Home className="w-6 h-6" />,
  'Paper Products': <FileText className="w-6 h-6" />,
  'General Merchandise': <Store className="w-6 h-6" />,
};

// Get icon for a category - matches by name or keywords
function getCategoryIcon(categoryName: string): React.ReactNode {
  if (!categoryName) return <Package className="w-6 h-6" />;
  
  const lowerName = categoryName.toLowerCase().trim();
  
  // Direct match first
  if (CATEGORY_ICONS[categoryName]) {
    return CATEGORY_ICONS[categoryName];
  }
  
  // Case-insensitive match
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.toLowerCase() === lowerName) {
      return icon;
    }
  }
  
  // Keyword-based matching for custom categories - all icons use consistent size w-6 h-6
  if (lowerName.includes('medicine') || lowerName.includes('meds') || lowerName.includes('pill') || lowerName.includes('drug')) {
    return <Pill className="w-6 h-6" />;
  }
  if (lowerName.includes('coffee') || lowerName.includes('tea')) {
    return <Coffee className="w-6 h-6" />;
  }
  if (lowerName.includes('cake') || lowerName.includes('pastry') || lowerName.includes('baked')) {
    return <Cake className="w-6 h-6" />;
  }
  if (lowerName.includes('beauty') || lowerName.includes('cosmetic') || lowerName.includes('makeup')) {
    return <Heart className="w-6 h-6" />;
  }
  if (lowerName.includes('juice') || lowerName.includes('drink') || lowerName.includes('soda')) {
    return <Droplets className="w-6 h-6" />;
  }
  if (lowerName.includes('detergent') || lowerName.includes('soap') || lowerName.includes('cleaner')) {
    return <Sparkles className="w-6 h-6" />;
  }
  if (lowerName.includes('stationery') || lowerName.includes('pen') || lowerName.includes('paper') || lowerName.includes('notebook')) {
    return <BookOpen className="w-6 h-6" />;
  }
  if (lowerName.includes('match') || lowerName.includes('lighter')) {
    return <Flame className="w-6 h-6" />;
  }
  if (lowerName.includes('shoe') || lowerName.includes('polish') || lowerName.includes('suede')) {
    return <Shirt className="w-6 h-6" />;
  }
  if (lowerName.includes('lotion') || lowerName.includes('cream') || lowerName.includes('body')) {
    return <Heart className="w-6 h-6" />;
  }
  if (lowerName.includes('sauce') || lowerName.includes('condiment') || lowerName.includes('ketchup') || lowerName.includes('tomato')) {
    return <UtensilsCrossed className="w-6 h-6" />;
  }
  if (lowerName.includes('flour') || lowerName.includes('wheat') || lowerName.includes('maize') || lowerName.includes('grain') || lowerName.includes('cereal') || lowerName.includes('weetabix')) {
    return <Wheat className="w-6 h-6" />;
  }
  if (lowerName.includes('oil') || lowerName.includes('cooking')) {
    return <Droplets className="w-6 h-6" />;
  }
  if (lowerName.includes('sugar') || lowerName.includes('sweet')) {
    return <Candy className="w-6 h-6" />;
  }
  if (lowerName.includes('household') || lowerName.includes('goods')) {
    return <Home className="w-6 h-6" />;
  }
  if (lowerName.includes('food') || lowerName.includes('essential')) {
    return <Utensils className="w-6 h-6" />;
  }
  
  // Default fallback
  return <Package className="w-6 h-6" />;
}

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
      <div className="px-4 sm:px-6 py-3">
        <div className="flex gap-2.5 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[120px] h-[52px] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
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
    <div className="px-4 sm:px-6 py-3">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {/* All categories / clear button */}
        {selectedCategoryId && (
          <button
            onClick={() => onSelectCategory(null)}
            className="pos-grid-btn flex-shrink-0 flex items-center gap-1.5 h-[44px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200/80 dark:border-slate-600/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium shadow-md active:scale-95 transition-transform duration-100"
          >
            <Package className="w-3.5 h-3.5" />
            All
          </button>
        )}
        {filteredCategories.map((category) => {
          const isSelected = selectedCategoryId === category.id;
          const icon = getCategoryIcon(category.name);
          
          return (
            <button
              key={category.id}
              className={`pos-grid-btn flex-shrink-0 flex items-center gap-2 h-[44px] px-4 rounded-xl border-2 transition-all duration-200 active:scale-95 ${
                isSelected
                  ? 'bg-[#259783] text-white border-[#259783] shadow-lg shadow-[#259783]/25'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 hover:border-[#259783]/40 hover:bg-[#259783]/5 dark:hover:bg-[#259783]/10 shadow-md'
              }`}
              onClick={() =>
                onSelectCategory(isSelected ? null : category.id)
              }
            >
              <span
                className={`[&>svg]:w-4 [&>svg]:h-4 transition-colors ${
                  isSelected ? 'text-white' : 'text-[#259783]'
                }`}
              >
                {icon}
              </span>
              <span className={`text-[13px] font-semibold whitespace-nowrap ${
                isSelected ? 'text-white' : ''
              }`}>
                {category.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

