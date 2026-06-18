"use client";

import { ShopTypeSelector } from "@/components/pos/ShopTypeSelector";

interface DashboardHeaderProps {
  shopType: string;
  onShopTypeChange: (shopType: string) => void;
}

export function DashboardHeader({
  shopType,
  onShopTypeChange,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
        Dashboard
      </h1>
      <ShopTypeSelector
        key={shopType}
        onShopTypeChange={onShopTypeChange}
        className="w-full sm:w-auto"
      />
    </header>
  );
}
