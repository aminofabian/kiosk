'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { CategoryList } from '@/components/admin/CategoryList';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { Loader2 } from 'lucide-react';
import type { Category } from '@/lib/db/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/categories');
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

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? Items in this category will need to be reassigned.')) {
      return;
    }

    setDeletingId(categoryId);

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        fetchCategories();
      } else {
        alert(result.message || 'Failed to delete category');
      }
    } catch {
      alert('An error occurred');
    } finally {
      setDeletingId(null);
    }
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
        <div className="p-6">
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
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Category Management</h1>
          <p className="text-muted-foreground">
            Organize your products into categories
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">{error}</div>
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
