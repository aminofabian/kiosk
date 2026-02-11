'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Folder, Loader2, Package } from 'lucide-react';
import type { Category } from '@/lib/db/types';

export interface CategoryWithCount extends Category {
  item_count?: number;
}

interface CategoryListProps {
  categories: CategoryWithCount[];
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
  deletingId: string | null;
}

export function CategoryList({
  categories,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  deletingId,
}: CategoryListProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <Button
          onClick={onAddCategory}
          className="bg-[#259783] hover:bg-[#1e8a72] text-white shadow-md shadow-[#259783]/20"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {categories.map((category) => {
          const count = (category as CategoryWithCount).item_count ?? 0;
          return (
            <Card
              key={category.id}
              className={`rounded-none border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/95 overflow-hidden transition-all hover:shadow-md hover:border-[#259783]/30 dark:hover:border-[#259783]/40 ${
                category.active === 0 ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-11 w-11 rounded-none bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center flex-shrink-0">
                      {category.icon ? (
                        <span className="text-xl">{category.icon}</span>
                      ) : (
                        <Folder className="h-5 w-5 text-[#259783]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        {category.name}
                        {category.active === 0 && (
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                          <Package className="h-3.5 w-3.5" />
                          <span className="font-medium tabular-nums">{count}</span>
                          <span>{count === 1 ? 'product' : 'products'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditCategory(category)}
                      className="h-8 w-8 p-0 rounded-none border-slate-200 dark:border-slate-600 hover:border-[#259783] hover:bg-[#259783]/5 hover:text-[#259783]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteCategory(category.id)}
                      disabled={deletingId === category.id}
                      className="h-8 w-8 p-0 rounded-none border-slate-200 dark:border-slate-600 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400"
                    >
                      {deletingId === category.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {categories.length === 0 && (
          <Card className="col-span-full rounded-none border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/95">
            <CardContent className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-none bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Folder className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                No categories found
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1 mb-4">
                Create your first category to organize products
              </p>
              <Button
                onClick={onAddCategory}
                className="bg-[#259783] hover:bg-[#1e8a72] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
