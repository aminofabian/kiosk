"use client";

import { useEffect, useState } from "react";
import { FolderTree } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { CategoryForm } from "@/components/admin/CategoryForm";
import type { Category } from "@/lib/db/types";

interface CategoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}

export function CategoryDrawer({
  open,
  onOpenChange,
  isMobile,
}: CategoryDrawerProps) {
  const [existingCategories, setExistingCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (open) {
      fetch("/api/categories")
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            setExistingCategories(result.data);
          }
        })
        .catch(() => {
          setExistingCategories([]);
        });
    }
  }, [open]);

  return (
    <Drawer open={open && !isMobile} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[500px] md:!w-[600px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
        <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <FolderTree className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Add New Category
              </DrawerTitle>
              <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Organize your products into groups
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto px-5 py-5 flex-1 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="max-w-2xl mx-auto">
            <CategoryForm
              category={null}
              existingCategories={existingCategories}
              onClose={() => onOpenChange(false)}
              onSuccess={() => onOpenChange(false)}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
