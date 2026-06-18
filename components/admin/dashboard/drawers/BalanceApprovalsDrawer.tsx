"use client";

import { DollarSign } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { BalanceApprovals } from "@/components/admin/BalanceApprovals";

interface BalanceApprovalsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}

function BalanceApprovalsDrawerContent() {
  return (
    <div className="p-4">
      <BalanceApprovals />
    </div>
  );
}

export function BalanceApprovalsDrawer({
  open,
  onOpenChange,
  isMobile,
}: BalanceApprovalsDrawerProps) {
  return (
    <Drawer open={open && !isMobile} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[720px] md:!w-[840px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
        <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Balance Approvals
              </DrawerTitle>
              <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Review cash balance requests from cashiers
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/30 px-4 sm:px-5 py-4">
          <div className="max-w-4xl mx-auto">
            <BalanceApprovalsDrawerContent />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
