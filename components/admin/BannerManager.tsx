'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Image from 'next/image';
import {
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  X,
  Upload,
} from 'lucide-react';
import type { Banner } from '@/lib/types/banner';

interface BannerFormData {
  file: File | null;
  title: string;
  alt: string;
  type: 'homepage' | 'category' | 'promo';
  categoryId: string;
  startDate: string;
  endDate: string;
}

export function BannerManager() {
  const { user } = useCurrentUser();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState<BannerFormData>({
    file: null,
    title: '',
    alt: '',
    type: 'homepage',
    categoryId: '',
    startDate: '',
    endDate: '',
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const businessId = user?.businessId;

  useEffect(() => {
    if (businessId) {
      fetchBanners();
      fetchCategories();
    }
  }, [businessId]);

  const fetchBanners = async () => {
    if (!businessId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/businesses/${businessId}/banners`);
      const result = await response.json();

      if (result.success) {
        setBanners(result.data.all || []);
      } else {
        setError(result.message || 'Failed to load banners');
      }
    } catch {
      setError('Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const result = await response.json();

      if (result.success) {
        setCategories(result.data || []);
      }
    } catch {
      // Ignore category fetch errors
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;

    if (!editingBanner && !formData.file) {
      setError('Please select an image file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      if (editingBanner) {
        const response = await fetch(
          `/api/businesses/${businessId}/banners/${editingBanner.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: formData.title || undefined,
              alt: formData.alt || undefined,
              active: true,
              startDate: formData.startDate || undefined,
              endDate: formData.endDate || undefined,
            }),
          }
        );

        const result = await response.json();

        if (result.success) {
          setDrawerOpen(false);
          resetForm();
          fetchBanners();
        } else {
          setError(result.message || 'Failed to update banner');
        }
      } else {
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.file!);
        uploadFormData.append('type', formData.type);
        if (formData.title) uploadFormData.append('title', formData.title);
        if (formData.alt) uploadFormData.append('alt', formData.alt);
        if (formData.categoryId) uploadFormData.append('categoryId', formData.categoryId);
        if (formData.startDate) uploadFormData.append('startDate', formData.startDate);
        if (formData.endDate) uploadFormData.append('endDate', formData.endDate);

        const response = await fetch(`/api/businesses/${businessId}/banners`, {
          method: 'POST',
          body: uploadFormData,
        });

        const result = await response.json();

        if (result.success) {
          setDrawerOpen(false);
          resetForm();
          fetchBanners();
        } else {
          setError(result.message || 'Failed to upload banner');
        }
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (bannerId: string) => {
    if (!businessId || !confirm('Are you sure you want to delete this banner?')) return;

    try {
      const response = await fetch(`/api/businesses/${businessId}/banners/${bannerId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        fetchBanners();
      } else {
        alert(result.message || 'Failed to delete banner');
      }
    } catch {
      alert('Failed to delete banner');
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    if (!businessId) return;

    try {
      const response = await fetch(`/api/businesses/${businessId}/banners/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !banner.active }),
      });

      const result = await response.json();

      if (result.success) {
        fetchBanners();
      }
    } catch {
      // Ignore errors
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      file: null,
      title: banner.title || '',
      alt: banner.alt || '',
      type: banner.type,
      categoryId: banner.categoryId || '',
      startDate: banner.startDate
        ? new Date(banner.startDate * 1000).toISOString().split('T')[0]
        : '',
      endDate: banner.endDate
        ? new Date(banner.endDate * 1000).toISOString().split('T')[0]
        : '',
    });
    setPreview(banner.url);
    setDrawerOpen(true);
  };

  const resetForm = () => {
    setFormData({
      file: null,
      title: '',
      alt: '',
      type: 'homepage',
      categoryId: '',
      startDate: '',
      endDate: '',
    });
    setPreview(null);
    setEditingBanner(null);
    setError(null);
  };

  const handleClose = () => {
    setDrawerOpen(false);
    resetForm();
  };

  const groupedBanners = {
    homepage: banners.filter((b) => b.type === 'homepage'),
    category: banners.filter((b) => b.type === 'category'),
    promo: banners.filter((b) => b.type === 'promo'),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#259783]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Manage Banners
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Upload banners for your storefront
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)} className="bg-[#259783] hover:bg-[#3bd522]">
          <Plus className="w-4 h-4 mr-2" />
          Add Banner
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Homepage Banners */}
      <Card>
        <CardHeader>
          <CardTitle>Homepage Banners</CardTitle>
        </CardHeader>
        <CardContent>
          {groupedBanners.homepage.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No homepage banners yet
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedBanners.homepage.map((banner) => (
                <BannerCard
                  key={banner.id}
                  banner={banner}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Banners */}
      <Card>
        <CardHeader>
          <CardTitle>Category Banners</CardTitle>
        </CardHeader>
        <CardContent>
          {groupedBanners.category.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No category banners yet
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedBanners.category.map((banner) => (
                <BannerCard
                  key={banner.id}
                  banner={banner}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promo Banners */}
      <Card>
        <CardHeader>
          <CardTitle>Promotional Banners</CardTitle>
        </CardHeader>
        <CardContent>
          {groupedBanners.promo.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No promotional banners yet
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedBanners.promo.map((banner) => (
                <BannerCard
                  key={banner.id}
                  banner={banner}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload/Edit Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{editingBanner ? 'Edit Banner' : 'Upload New Banner'}</DrawerTitle>
            <DrawerDescription>
              {editingBanner
                ? 'Update banner details'
                : 'Upload an image and configure banner settings'}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingBanner && (
                <div>
                  <Label htmlFor="file">Image File *</Label>
                  <Input
                    id="file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    required={!editingBanner}
                    className="mt-1"
                  />
                  {preview && (
                    <div className="mt-4 relative w-full h-48 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                      <Image
                        src={preview}
                        alt="Preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              {preview && editingBanner && (
                <div className="relative w-full h-48 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <Image
                    src={preview}
                    alt="Preview"
                    fill
                    className="object-contain"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="type">Banner Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'homepage' | 'category' | 'promo') =>
                    setFormData({ ...formData, type: value })
                  }
                  disabled={!!editingBanner}
                >
                  <SelectTrigger id="type" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homepage">Homepage</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="promo">Promotional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'category' && (
                <div>
                  <Label htmlFor="categoryId">Category *</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, categoryId: value })
                    }
                    disabled={!!editingBanner}
                  >
                    <SelectTrigger id="categoryId" className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="title">Title (Optional)</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="alt">Alt Text (Optional)</Label>
                <Input
                  id="alt"
                  value={formData.alt}
                  onChange={(e) => setFormData({ ...formData, alt: e.target.value })}
                  className="mt-1"
                />
              </div>

              {formData.type === 'promo' && (
                <>
                  <div>
                    <Label htmlFor="startDate">Start Date (Optional)</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 bg-[#259783] hover:bg-[#3bd522]"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingBanner ? 'Updating...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {editingBanner ? 'Update Banner' : 'Upload Banner'}
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

interface BannerCardProps {
  banner: Banner;
  onEdit: (banner: Banner) => void;
  onDelete: (id: string) => void;
  onToggleActive: (banner: Banner) => void;
}

function BannerCard({ banner, onEdit, onDelete, onToggleActive }: BannerCardProps) {
  const now = Math.floor(Date.now() / 1000);
  const isActive = banner.active && (!banner.startDate || banner.startDate <= now) &&
    (!banner.endDate || banner.endDate >= now);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div className="relative w-full h-48 bg-slate-100 dark:bg-slate-800">
        <Image
          src={banner.url}
          alt={banner.alt || banner.title || 'Banner'}
          fill
          className="object-cover"
        />
        {!isActive && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-semibold">Inactive</span>
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        {banner.title && (
          <h3 className="font-semibold text-slate-900 dark:text-white">{banner.title}</h3>
        )}
        {banner.categoryName && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Category: {banner.categoryName}
          </p>
        )}
        {banner.startDate && banner.endDate && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {new Date(banner.startDate * 1000).toLocaleDateString()} -{' '}
            {new Date(banner.endDate * 1000).toLocaleDateString()}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onToggleActive(banner)}
            className="flex-1"
          >
            {isActive ? (
              <>
                <EyeOff className="w-3 h-3 mr-1" />
                Deactivate
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 mr-1" />
                Activate
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(banner)}
            className="flex-1"
          >
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(banner.id)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
