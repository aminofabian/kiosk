"use client";

import { Scale } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { StockAdjustForm } from "@/components/admin/StockAdjustForm";

interface StockAdjustDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  onSuccess: () => void;
}

export function StockAdjustDrawer({
  open,
  onOpenChange,
  isMobile,
  onSuccess,
}: StockAdjustDrawerProps) {
  return (
    <Drawer open={open && !isMobile} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
        <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Add Stock
              </DrawerTitle>
              <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Adjust inventory levels
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="px-4 sm:px-5 py-5">
            <StockAdjustForm
              onCancel={() => onOpenChange(false)}
              onSuccess={() => {
                onSuccess();
                onOpenChange(false);
              }}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
