'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, Loader2, Package } from 'lucide-react';
import type { Purchase } from '@/lib/db/types';
import type { PurchaseStatus } from '@/lib/constants';
import { SearchFilterSection } from './SearchFilterSection';

interface PurchaseListProps {
  onViewBreakdown?: (purchaseId: string) => void;
}

export function PurchaseList({ onViewBreakdown }: PurchaseListProps = {}) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  useEffect(() => {
    async function fetchPurchases() {
      try {
        setLoading(true);
        const response = await fetch('/api/purchases');
        const result = await response.json();

        if (result.success) {
          setPurchases(result.data);
        } else {
          setError(result.message || 'Failed to load purchases');
        }
      } catch (err) {
        setError('Failed to load purchases');
        console.error('Error fetching purchases:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPurchases();
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getStatusConfig = (status: PurchaseStatus) => {
    switch (status) {
      case 'complete':
        return { variant: 'default' as const, className: 'bg-[#259783] hover:bg-[#45d827] text-white' };
      case 'partial':
        return { variant: 'secondary' as const, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
      case 'pending':
        return { variant: 'destructive' as const, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
      default:
        return { variant: 'outline' as const, className: '' };
    }
  };

  const filteredPurchases = useMemo(() => {
    return purchases
      .filter((purchase) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (
            !purchase.supplier_name?.toLowerCase().includes(query) &&
            !purchase.notes?.toLowerCase().includes(query)
          ) {
            return false;
          }
        }
        if (statusFilter !== 'all' && purchase.status !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'amount') {
          return b.total_amount - a.total_amount;
        }
        return b.purchase_date - a.purchase_date;
      });
  }, [purchases, searchQuery, statusFilter, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading purchases...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SearchFilterSection
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by supplier name or notes..."
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            options: [
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'partial', label: 'Partial' },
              { value: 'complete', label: 'Complete' },
            ],
            onChange: setStatusFilter,
          },
        ]}
        sortOptions={[
          { value: 'date', label: 'Sort by Date (Newest)' },
          { value: 'amount', label: 'Sort by Amount' },
        ]}
        sortValue={sortBy}
        onSortChange={(v) => setSortBy(v as 'date' | 'amount')}
      />

      {filteredPurchases.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
              <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">No purchases found</p>
            <p className="text-sm text-slate-400">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Record your first purchase to get started'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPurchases.map((purchase) => {
            const statusConfig = getStatusConfig(purchase.status);
            return (
              <Card
                key={purchase.id}
                className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-slate-900 dark:text-white truncate">
                            {purchase.supplier_name || 'No Supplier'}
                          </h3>
                          <Badge className={statusConfig.className}>
                            {purchase.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {formatDate(purchase.purchase_date)}
                        </p>
                        {purchase.notes && (
                          <p className="text-sm text-slate-400 mt-1 line-clamp-1">{purchase.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <p className="text-lg font-bold text-[#259783]">
                        {formatPrice(purchase.total_amount)}
                      </p>
                      {onViewBreakdown ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-slate-200 dark:border-slate-700"
                          onClick={() => onViewBreakdown(purchase.id)}
                        >
                          View
                          <ArrowRight className="ml-2 h-3 w-3" />
                        </Button>
                      ) : (
                        <Link href={`/admin/purchases/${purchase.id}/breakdown`}>
                          <Button variant="outline" size="sm" className="border-slate-200 dark:border-slate-700">
                            View
                            <ArrowRight className="ml-2 h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
