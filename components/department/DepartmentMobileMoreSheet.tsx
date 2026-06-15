'use client';

import Link from 'next/link';
import { ClipboardList, LogOut, PackageMinus } from 'lucide-react';
import { ShopTypeSelector } from '@/components/pos/ShopTypeSelector';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface DepartmentMobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName?: string;
  userName?: string;
  deptTypes?: string[];
  onShopTypeChange?: (shopType: string) => void;
  onLogout: () => void;
}

function ActionRow({
  icon,
  label,
  description,
  href,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const className = `w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl transition-colors active:scale-[0.99] ${
    danger
      ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
      : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80'
  }`;

  const content = (
    <>
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          danger ? 'bg-red-100 dark:bg-red-950/40' : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}

export function DepartmentMobileMoreSheet({
  open,
  onOpenChange,
  businessName,
  userName,
  deptTypes = [],
  onShopTypeChange,
  onLogout,
}: DepartmentMobileMoreSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left border-b border-slate-100 dark:border-slate-800 pb-4">
          <DrawerTitle className="text-lg">{businessName || 'Department'}</DrawerTitle>
          <DrawerDescription>
            {userName}
            {deptTypes.length > 0 ? ` · ${deptTypes.join(', ')}` : ''}
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-3 space-y-1 pb-8">
          {onShopTypeChange && (
            <div className="px-1 pb-3 mb-1 border-b border-slate-100 dark:border-slate-800">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Department
              </p>
              <div className="px-3 pt-2">
                <ShopTypeSelector
                  compact
                  allowedTypes={deptTypes}
                  onShopTypeChange={onShopTypeChange}
                />
              </div>
            </div>
          )}
          <ActionRow
            icon={<ClipboardList className="w-5 h-5 text-[#1c6a1e]" />}
            label="My orders"
            description="Track orders forwarded to cashiers"
            href="/department/requests"
            onClick={() => onOpenChange(false)}
          />
          <ActionRow
            icon={<PackageMinus className="w-5 h-5 text-[#1c6a1e]" />}
            label="Stock ledger"
            description="Edit stock, prices, and counts"
            href="/department/stock"
            onClick={() => onOpenChange(false)}
          />
          <ActionRow
            icon={<LogOut className="w-5 h-5 text-red-500" />}
            label="Sign out"
            onClick={() => {
              onOpenChange(false);
              onLogout();
            }}
            danger
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
