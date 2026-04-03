'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getShopType, setShopType, SHOP_TYPE_ALL } from '@/lib/utils/shop-type';
import { useItemTypes } from '@/lib/hooks/use-item-types';

interface ShopTypeSelectorProps {
  onShopTypeChange?: (shopType: string) => void;
  className?: string;
}

export function ShopTypeSelector({ onShopTypeChange, className = '' }: ShopTypeSelectorProps) {
  const { productTypes, itemTypeKeys } = useItemTypes();
  const [currentShopType, setCurrentShopType] = useState<string>(() =>
    getShopType(itemTypeKeys.length ? itemTypeKeys : undefined)
  );

  useEffect(() => {
    const keys = itemTypeKeys.length ? itemTypeKeys : ['grocery', 'retail'];
    const resolved = getShopType(keys);
    setCurrentShopType(resolved);
  }, [itemTypeKeys]);

  const handleShopTypeChange = (shopType: string) => {
    setShopType(shopType);
    setCurrentShopType(shopType);
    onShopTypeChange?.(shopType);
  };

  if (productTypes.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <Button
        key={SHOP_TYPE_ALL}
        variant={currentShopType === SHOP_TYPE_ALL ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleShopTypeChange(SHOP_TYPE_ALL)}
        className={`flex items-center gap-2 transition-all ${
          currentShopType === SHOP_TYPE_ALL
            ? 'bg-[#1c6a1e] text-white hover:bg-[#1c6a1e]/90'
            : 'bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700'
        }`}
      >
        <span className="text-sm font-semibold">All</span>
      </Button>
      {productTypes.map((type) => (
        <Button
          key={type.key}
          variant={currentShopType === type.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleShopTypeChange(type.key)}
          className={`flex items-center gap-2 transition-all ${
            currentShopType === type.key
              ? 'bg-[#1c6a1e] text-white hover:bg-[#1c6a1e]/90'
              : 'bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700'
          }`}
          style={currentShopType === type.key ? { borderColor: type.color } : undefined}
        >
          <span className="text-lg leading-none" aria-hidden>
            {type.emoji}
          </span>
          <span className="hidden sm:inline">{type.label}</span>
        </Button>
      ))}
    </div>
  );
}
