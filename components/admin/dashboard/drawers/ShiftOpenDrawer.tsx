"use client";

import { Banknote } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ShiftOpenForm } from "@/components/pos/ShiftOpenForm";

interface ShiftOpenDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}

export function ShiftOpenDrawer({
  open,
  onOpenChange,
  isMobile,
}: ShiftOpenDrawerProps) {
  return (
    <Drawer open={open && !isMobile} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[480px] md:!w-[520px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
        <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 flex items-center justify-center flex-shrink-0">
              <Banknote className="w-5 h-5 text-[#1c6a1e] dark:text-[#2a8a30]" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Open Shift
              </DrawerTitle>
              <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Record the opening cash balance
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 sm:px-5 py-4 flex-1 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="max-w-md mx-auto">
            <ShiftOpenForm />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
