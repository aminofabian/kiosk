'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { CategoryList, type CategoryWithCount } from '@/components/admin/CategoryList';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { MergeCategoriesDialog } from '@/components/admin/MergeCategoriesDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import type { Category } from '@/lib/db/types';
import { apiPost } from '@/lib/utils/api-client';
import { toast } from 'sonner';
import Link from 'next/link';

function CategoriesPageContent() {
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);

  const inactivePurgeStats = useMemo(() => {
    const inactive = categories.filter((c) => c.active === 0);
    const empty = inactive.filter((c) => (c.item_count ?? 0) === 0);
    const blocked = inactive.filter((c) => (c.item_count ?? 0) > 0);
    return { inactive, empty, blocked };
  }, [categories]);

  const handleConfirmPurgeInactive = async () => {
    setPurgeLoading(true);
    try {
      const result = await apiPost<{
        deleted: { id: string; name: string }[];
        skipped: { id: string; name: string; itemCount: number }[];
      }>('/api/categories/purge-inactive', {});
      if (result.success) {
        toast.success(result.message || 'Inactive categories updated');
        setPurgeDialogOpen(false);
        fetchCategories();
      } else {
        toast.error(result.message || 'Request failed');
      }
    } catch {
      toast.error('Request failed');
    } finally {
      setPurgeLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/categories?all=true&withCounts=true');
      const result = await response.json();

      if (result.success) {
        setCategories(result.data);
      } else {
        setError(result.message);
      }
    } catch {
      setError('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = () => {
    setEditingCategory(null);
    setShowForm(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleDeleteCategory = (categoryId: string) => {
    toast('Are you sure you want to delete this category? Items in this category will need to be reassigned.', {
      action: {
        label: 'Delete',
        onClick: async () => {
          setDeletingId(categoryId);
          try {
            const response = await fetch(`/api/categories/${categoryId}`, {
              method: 'DELETE',
            });
            const result = await response.json();

            if (result.success) {
              fetchCategories();
              toast.success('Category deleted');
            } else {
              toast.error(result.message || 'Failed to delete category');
            }
          } catch {
            toast.error('An error occurred');
          } finally {
            setDeletingId(null);
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingCategory(null);
  };

  const handleSuccess = () => {
    setShowForm(false);
    setEditingCategory(null);
    fetchCategories();
  };

  if (showForm) {
    return (
      <AdminLayout>
        <div className="p-6 sm:p-8">
          <CategoryForm
            category={editingCategory}
            existingCategories={categories}
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8">
        <div className="mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Category Management
              </h1>
              <p className="mt-1.5 text-slate-600 dark:text-slate-400">
                Organize your products into categories
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-none">
              <Link href="/admin/categories/type">Type weekly sheets</Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#1c6a1e]" />
          </div>
        ) : error ? (
          <div className="rounded-none border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-6 py-12 text-center text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        ) : (
          <>
            <CategoryList
              categories={categories}
              onAddCategory={handleAddCategory}
              onEditCategory={handleEditCategory}
              onDeleteCategory={handleDeleteCategory}
              deletingId={deletingId}
              onOpenMerge={() => setMergeDialogOpen(true)}
              onOpenPurgeInactive={() => setPurgeDialogOpen(true)}
            />
            <MergeCategoriesDialog
              open={mergeDialogOpen}
              onOpenChange={setMergeDialogOpen}
              categories={categories}
              onSuccess={fetchCategories}
            />
            <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
              <DialogContent className="sm:max-w-md rounded-none border-slate-200 dark:border-slate-700">
                <DialogHeader>
                  <DialogTitle>Remove inactive categories</DialogTitle>
                  <DialogDescription className="text-left space-y-3 pt-1">
                    <span className="block text-slate-600 dark:text-slate-400">
                      Inactive categories with <strong className="text-slate-800 dark:text-slate-200">no products</strong>{' '}
                      will be <strong className="text-slate-800 dark:text-slate-200">deleted permanently</strong> from
                      the database (not just hidden).
                    </span>
                    <span className="block text-sm">
                      Empty inactive:{' '}
                      <strong>{inactivePurgeStats.empty.length}</strong>
                      <br />
                      Inactive but still have products (skipped):{' '}
                      <strong>{inactivePurgeStats.blocked.length}</strong>
                    </span>
                    {inactivePurgeStats.blocked.length > 0 && (
                      <span className="block text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-2 rounded-none">
                        Merge those into an active category first, then you can remove them here or one-by-one.
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    onClick={() => setPurgeDialogOpen(false)}
                    disabled={purgeLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="rounded-none"
                    disabled={purgeLoading || inactivePurgeStats.empty.length === 0}
                    onClick={handleConfirmPurgeInactive}
                  >
                    {purgeLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Removing…
                      </>
                    ) : (
                      `Delete ${inactivePurgeStats.empty.length} empty`
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function LoadingFallback() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    </AdminLayout>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CategoriesPageContent />
    </Suspense>
  );
}
