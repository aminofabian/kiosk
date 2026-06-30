'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { getShopType, setShopType, SHOP_TYPE_ALL } from '@/lib/utils/shop-type';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { resolveVisibleProductTypes } from '@/lib/types/product-types';

interface PosDepartmentRailProps {
  onShopTypeChange?: (shopType: string) => void;
  /** When set, only these product type keys are shown (e.g. department staff scope). */
  allowedTypes?: string[];
  /** Vertical sidebar (POS) or horizontal chip row (department stock). */
  layout?: 'rail' | 'chips';
}

export function PosDepartmentRail({
  onShopTypeChange,
  allowedTypes,
  layout = 'rail',
}: PosDepartmentRailProps) {
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

  const handleChange = (shopType: string) => {
    setShopType(shopType);
    setCurrentShopType(shopType);
    onShopTypeChange?.(shopType);
  };

  if (visibleTypes.length === 0) return null;

  const showAll = visibleTypes.length > 1;
  const items: { key: string; label: string; emoji?: string }[] = [
    ...(showAll ? [{ key: SHOP_TYPE_ALL, label: 'All' }] : []),
    ...visibleTypes.map((t) => ({ key: t.key, label: t.label, emoji: t.emoji })),
  ];

  if (layout === 'chips') {
    return (
      <div
        className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-0.5 px-0.5"
        aria-label="Departments"
      >
        {items.map((item) => {
          const active = currentShopType === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleChange(item.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all touch-manipulation ${
                active
                  ? 'bg-[#1c6a1e] text-white shadow-sm shadow-[#1c6a1e]/20'
                  : 'bg-white dark:bg-[#1c2e18] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
              aria-pressed={active}
            >
              <span className="text-sm leading-none" aria-hidden>
                {item.key === SHOP_TYPE_ALL ? (
                  <LayoutGrid className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-500'}`} />
                ) : (
                  item.emoji
                )}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <aside
      className="flex flex-col w-[4.25rem] shrink-0 border-r border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm py-2 px-1 gap-0.5 overflow-y-auto overflow-x-hidden"
      aria-label="Departments"
    >
      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center leading-none mb-1 px-0.5">
        Dept
      </p>
      {items.map((item) => {
        const active = currentShopType === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => handleChange(item.key)}
            title={item.label}
            className={`flex flex-col items-center justify-center gap-0.5 w-full min-h-[3.25rem] px-0.5 py-1.5 rounded-lg transition-all touch-manipulation ${
              active
                ? 'bg-[#1c6a1e] text-white shadow-sm shadow-[#1c6a1e]/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            aria-pressed={active}
          >
            <span className="text-base leading-none flex items-center justify-center h-4" aria-hidden>
              {item.key === SHOP_TYPE_ALL ? (
                <LayoutGrid className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-500'}`} />
              ) : (
                item.emoji
              )}
            </span>
            <span
              className={`text-[9px] font-semibold leading-tight text-center break-words w-full ${
                active ? 'text-white' : ''
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
