"use client";

import { Package, X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ItemForm } from "@/components/admin/ItemForm";

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}

export function ItemDrawer({ open, onOpenChange, isMobile }: ItemDrawerProps) {
  return (
    <Drawer open={open && !isMobile} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[600px] md:!w-[740px] !max-w-none h-full max-h-screen rounded-l-3xl overflow-hidden border-0 shadow-[-8px_0_40px_-12px_rgba(0,0,0,0.25)] dark:shadow-[-8px_0_40px_-12px_rgba(0,0,0,0.5)] bg-white dark:bg-slate-900">
        <div
          className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#1c6a1e] via-emerald-500 to-teal-400 dark:from-[#1c6a1e] dark:via-emerald-600 dark:to-teal-500 pointer-events-none"
          aria-hidden
        />
        <DrawerHeader className="relative shrink-0 border-b border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-br from-emerald-50/80 via-white to-slate-50/50 dark:from-[#0d1f0e] dark:via-slate-900 dark:to-slate-950 px-6 py-5 pr-16">
          <DrawerClose asChild>
            <button
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 transition-all duration-200"
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </DrawerClose>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1c6a1e] to-emerald-600 flex items-center justify-center shadow-lg shadow-[#1c6a1e]/25 dark:shadow-[#1c6a1e]/40">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 dark:bg-emerald-500 border-2 border-white dark:border-slate-900"
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <DrawerTitle className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Add New Item
              </DrawerTitle>
              <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Quick-add products to your inventory
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto flex-1 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-950/50 dark:to-slate-900 scroll-smooth">
          <div className="px-5 sm:px-6 py-6 min-h-full">
            <ItemForm
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
