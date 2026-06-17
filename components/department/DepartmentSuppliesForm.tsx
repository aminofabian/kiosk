"use client";

import Link from "next/link";
import { FileText, ArrowRight, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DepartmentSuppliesFormProps {
  assignedTypes: string[];
  onSuccess?: () => void;
}

export function DepartmentSuppliesForm({
  assignedTypes: _assignedTypes,
}: DepartmentSuppliesFormProps) {
  return (
    <div className="p-4 pb-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-[#1c6a1e]/10 to-transparent border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#1c6a1e]" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            Department supply
          </span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Order stock through purchase orders — submit for approval, then record
            delivery when goods arrive.
          </p>
          <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
            <li>Create a PO with your assigned supplier</li>
            <li>Admin approves the order</li>
            <li>Log delivery to update stock</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              className="flex-1 h-10 bg-[#1c6a1e] hover:bg-[#165a19] text-white text-sm"
              asChild
            >
              <Link href="/department/supply/new">
                <Plus className="w-4 h-4 mr-2" />
                New order
              </Link>
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-10 text-sm"
              asChild
            >
              <Link href="/department/supply">
                <FileText className="w-4 h-4 mr-2" />
                View orders
                <ArrowRight className="w-3.5 h-3.5 ml-auto sm:ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
