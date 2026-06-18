"use client";

import { ClipboardList } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { StockTakeForm } from "@/components/admin/StockTakeForm";

interface StockTakeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}

export function StockTakeDrawer({
  open,
  onOpenChange,
  isMobile,
}: StockTakeDrawerProps) {
  return (
    <Drawer open={open && !isMobile} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[800px] md:!w-[900px] lg:!w-[1000px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
        <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Stock Take
              </DrawerTitle>
              <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Count physical inventory and record actual stock levels
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 sm:px-5 py-5 flex-1 bg-slate-50/50 dark:bg-slate-950/30">
          <StockTakeForm onCancel={() => onOpenChange(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
