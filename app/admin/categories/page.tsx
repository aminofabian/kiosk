'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { CategoryList, type CategoryWithCount } from '@/components/admin/CategoryList';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { Loader2 } from 'lucide-react';
import type { Category } from '@/lib/db/types';
import { toast } from 'sonner';

function CategoriesPageContent() {
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Category Management
          </h1>
          <p className="mt-1.5 text-slate-600 dark:text-slate-400">
            Organize your products into categories
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#259783]" />
          </div>
        ) : error ? (
          <div className="rounded-none border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-6 py-12 text-center text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        ) : (
          <CategoryList
            categories={categories}
            onAddCategory={handleAddCategory}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
            deletingId={deletingId}
          />
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
