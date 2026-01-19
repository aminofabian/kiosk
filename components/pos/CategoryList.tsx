'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
        {filteredCategories.map((category) => {
          const isSelected = selectedCategoryId === category.id;
          // Always use lucide-react icons
          const icon = getCategoryIcon(category.name);
          
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
              <span
                className={`transition-transform ${
                  isSelected ? 'scale-110 text-white' : 'text-[#259783]'
                }`}
              >
                {icon}
              </span>
              <span className={`text-xs sm:text-sm font-semibold leading-tight text-center ${
                isSelected ? 'text-white' : 'text-gray-700'
              }`}>
                {category.name}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

