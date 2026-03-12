'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Search,
  TrendingDown,
  Package,
  ChevronRight,
  Award,
  Building2,
  ArrowLeft,
} from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';

interface SupplierPrice {
  supplierId: string;
  supplierName: string;
  defaultCostPrice: number | null;
  lastBuyPrice: number | null;
  effectivePrice: number;
}

interface ComparisonItem {
  itemId: string;
  itemName: string;
  variantName: string | null;
  unitType: string;
  categoryName: string;
  categoryId: string;
  suppliers: SupplierPrice[];
  cheapestSupplierId: string;
  cheapestSupplierName: string;
  cheapestPrice: number;
  mostExpensivePrice: number;
  savings: number;
  supplierCount: number;
}

interface Category {
  id: string;
  name: string;
}

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getItemDisplayName = (name: string, variant: string | null) =>
  variant ? `${name} (${variant})` : name;

export default function SupplierPriceComparisonPage() {
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        apiGet<{ items: ComparisonItem[] }>(
          `/api/reports/supplier-price-comparison?minSuppliers=2${
            categoryFilter && categoryFilter !== 'all' ? `&categoryId=${categoryFilter}` : ''
          }`
        ),
        apiGet<Category[]>('/api/categories?all=true'),
      ]);
      if (itemsRes.success && itemsRes.data?.items) {
        setItems(itemsRes.data.items);
      }
      if (categoriesRes.success && categoriesRes.data) {
        setCategories(categoriesRes.data);
      }
    } catch (err) {
      console.error('Error fetching supplier price comparison:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = items.filter((item) => {
    const name = getItemDisplayName(item.itemName, item.variantName).toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return name.includes(q) || item.categoryName.toLowerCase().includes(q);
  });

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/supplier-bills">
              <Button variant="ghost" size="touch" className="gap-2">
                <ArrowLeft className="w-5 h-5" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingDown className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                Supplier Price Comparison
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Compare prices across suppliers and find the cheapest option
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="pl-9 h-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-10">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="touch" onClick={fetchData} disabled={loading}>
                <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">Loading comparison...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="w-14 h-14 text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-slate-600 dark:text-slate-400 font-medium">
                  No products with multiple suppliers
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-1 max-w-sm">
                  Link the same product to multiple suppliers and set their cost prices to see
                  comparisons here.
                </p>
                <Link href="/admin/supplier-bills">
                  <Button className="mt-4" variant="outline">
                    Go to Supplier Bills
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-2 font-semibold text-slate-700 dark:text-slate-300">
                        Product
                      </th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-700 dark:text-slate-300 hidden sm:table-cell">
                        Category
                      </th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-700 dark:text-slate-300">
                        Unit
                      </th>
                      <th className="text-left py-3 px-2 font-semibold text-emerald-700 dark:text-emerald-400">
                        Cheapest
                      </th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-700 dark:text-slate-300">
                        Others
                      </th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-700 dark:text-slate-300">
                        Save
                      </th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr
                        key={item.itemId}
                        className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-2">
                          <Link
                            href={`/admin/items/${item.itemId}/edit`}
                            className="font-medium text-slate-900 dark:text-white hover:text-[#1c6a1e] dark:hover:text-emerald-400"
                          >
                            {getItemDisplayName(item.itemName, item.variantName)}
                          </Link>
                        </td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                          {item.categoryName}
                        </td>
                        <td className="py-3 px-2 text-slate-500 dark:text-slate-500">
                          {item.unitType}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div>
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                {formatPrice(item.cheapestPrice)}
                              </span>
                              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                                {item.cheapestSupplierName}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {item.suppliers
                              .filter((s) => s.supplierId !== item.cheapestSupplierId)
                              .sort((a, b) => a.effectivePrice - b.effectivePrice)
                              .map((s) => (
                                <span
                                  key={s.supplierId}
                                  className="text-xs text-slate-600 dark:text-slate-400"
                                >
                                  {s.supplierName}: {formatPrice(s.effectivePrice)}
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          {item.savings > 0 ? (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {formatPrice(item.savings)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <Link href={`/admin/items/${item.itemId}/edit`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
