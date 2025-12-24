'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Store, ShoppingBag } from 'lucide-react';
import { getShopType, setShopType, type ShopType } from '@/lib/utils/shop-type';

interface ShopTypeSelectorProps {
  onShopTypeChange?: (shopType: ShopType) => void;
  className?: string;
}

export function ShopTypeSelector({ onShopTypeChange, className = '' }: ShopTypeSelectorProps) {
  const [currentShopType, setCurrentShopType] = useState<ShopType>(() => getShopType());

  useEffect(() => {
    const stored = getShopType();
    setCurrentShopType(stored);
  }, []);

  const handleShopTypeChange = (shopType: ShopType) => {
    setShopType(shopType);
    setCurrentShopType(shopType);
    onShopTypeChange?.(shopType);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant={currentShopType === 'grocery' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleShopTypeChange('grocery')}
        className={`flex items-center gap-2 transition-all ${
          currentShopType === 'grocery'
            ? 'bg-[#259783] text-white hover:bg-[#259783]/90'
            : 'bg-white hover:bg-gray-50'
        }`}
      >
        <Store className="w-4 h-4" />
        <span className="hidden sm:inline">Grocery</span>
      </Button>
      <Button
        variant={currentShopType === 'retail' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleShopTypeChange('retail')}
        className={`flex items-center gap-2 transition-all ${
          currentShopType === 'retail'
            ? 'bg-[#259783] text-white hover:bg-[#259783]/90'
            : 'bg-white hover:bg-gray-50'
        }`}
      >
        <ShoppingBag className="w-4 h-4" />
        <span className="hidden sm:inline">Retail</span>
      </Button>
    </div>
  );
}

