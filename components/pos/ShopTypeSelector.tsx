'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getShopType, setShopType, SHOP_TYPE_ALL } from '@/lib/utils/shop-type';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { resolveVisibleProductTypes } from '@/lib/types/product-types';

interface ShopTypeSelectorProps {
  onShopTypeChange?: (shopType: string) => void;
  className?: string;
  compact?: boolean;
  /** When set, only these product type keys are shown (e.g. department staff scope). */
  allowedTypes?: string[];
}

export function ShopTypeSelector({
  onShopTypeChange,
  className = '',
  compact = false,
  allowedTypes,
}: ShopTypeSelectorProps) {
  const { productTypes, itemTypeKeys } = useItemTypes();

  const visibleTypes = resolveVisibleProductTypes(productTypes, allowedTypes);
  const validKeys = visibleTypes.map((t) => t.key);
  const scopedToAssignment = allowedTypes !== undefined;

  const [currentShopType, setCurrentShopType] = useState<string>(() => {
    if (scopedToAssignment) {
      if (validKeys.length === 1) return validKeys[0];
      if (validKeys.length === 0) return SHOP_TYPE_ALL;
      return getShopType(validKeys);
    }
    return getShopType(validKeys.length ? validKeys : itemTypeKeys.length ? itemTypeKeys : undefined);
  });

  useEffect(() => {
    if (scopedToAssignment) {
      if (validKeys.length === 1) {
        setCurrentShopType(validKeys[0]);
        return;
      }
      if (validKeys.length === 0) return;
      setCurrentShopType(getShopType(validKeys));
      return;
    }
    const keys = validKeys.length ? validKeys : itemTypeKeys.length ? itemTypeKeys : ['grocery', 'retail'];
    setCurrentShopType(getShopType(keys));
  }, [itemTypeKeys, validKeys, scopedToAssignment]);

  const handleShopTypeChange = (shopType: string) => {
    setShopType(shopType);
    setCurrentShopType(shopType);
    onShopTypeChange?.(shopType);
  };

  if (visibleTypes.length === 0) return null;

  const showAll = visibleTypes.length > 1;

  return (
    <div className={`flex items-center flex-nowrap ${compact ? 'gap-1 overflow-x-auto no-scrollbar' : 'gap-2 flex-wrap'} ${className}`}>
      {showAll && (
      <Button
        key={SHOP_TYPE_ALL}
        variant={currentShopType === SHOP_TYPE_ALL ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleShopTypeChange(SHOP_TYPE_ALL)}
        className={`flex items-center gap-1.5 transition-all shrink-0 ${
          compact ? 'h-7 px-2.5 text-xs rounded-md' : ''
        } ${
          currentShopType === SHOP_TYPE_ALL
            ? 'bg-[#1c6a1e] text-white hover:bg-[#1c6a1e]/90'
            : 'bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700'
        }`}
      >
        <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>All</span>
      </Button>
      )}
      {visibleTypes.map((type) => (
        <Button
          key={type.key}
          variant={currentShopType === type.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleShopTypeChange(type.key)}
          className={`flex items-center gap-1.5 transition-all shrink-0 ${
            compact ? 'h-7 px-2.5 text-xs rounded-md' : ''
          } ${
            currentShopType === type.key
              ? 'bg-[#1c6a1e] text-white hover:bg-[#1c6a1e]/90'
              : 'bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700'
          }`}
          style={currentShopType === type.key ? { borderColor: type.color } : undefined}
        >
          <span className={`leading-none ${compact ? 'text-sm' : 'text-lg'}`} aria-hidden>
            {type.emoji}
          </span>
          <span className={compact ? 'text-xs' : 'hidden sm:inline'}>{type.label}</span>
        </Button>
      ))}
    </div>
  );
}
