'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { apiGet, apiPatch } from '@/lib/utils/api-client';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Layers,
  Loader2,
  Search,
  ChevronRight,
  Package,
  TrendingUp,
  Ban,
  Check,
  Calendar,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

interface Batch {
  id: string;
  batch_number: string | null;
  status: string;
  supplier_id: string | null;
  item_id: string;
  initial_quantity: number;
  quantity_remaining: number;
  buy_price_per_unit: number;
  received_at: number;
  expiry_date: number | null;
  created_at: number;
  item_name: string;
  item_unit_type: string;
  supplier_name: string | null;
  quantity_sold: number;
  revenue: number;
  profit: number;
}

interface BatchDetail extends Batch {
  salesHistory: Array<{
    sale_id: string;
    quantity_sold: number;
    sell_price_per_unit: number;
    profit: number;
    sale_date: number;
  }>;
}

const formatPrice = (n: number) =>
  `KES ${Math.abs(n).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  depleted: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  deactivated: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [listDeactivatingId, setListDeactivatingId] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const result = await apiGet<Batch[]>(
        `/api/batches?${params.toString()}`
      );
      if (result.success && result.data) {
        setBatches(result.data);
      } else {
        toast.error(result.message || 'Failed to load batches');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handleRowClick = async (batch: Batch) => {
    setDetailDrawerOpen(true);
    setDetailLoading(true);
    setSelectedBatch(null);
    try {
      const result = await apiGet<BatchDetail>(`/api/batches/${batch.id}`);
      if (result.success && result.data) {
        setSelectedBatch(result.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load batch details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedBatch) return;
    setDeactivating(true);
    try {
      const newStatus =
        selectedBatch.status === 'deactivated' ? 'active' : 'deactivated';
      const result = await apiPatch<{ batchId: string; status: string }>(
        `/api/batches/${selectedBatch.id}`,
        { status: newStatus }
      );
      if (result.success) {
        toast.success(
          newStatus === 'deactivated' ? 'Batch deactivated' : 'Batch reactivated'
        );
        setSelectedBatch((prev) =>
          prev ? { ...prev, status: newStatus } : null
        );
        fetchBatches();
      } else {
        toast.error(result.message || 'Failed to update batch');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update batch');
    } finally {
      setDeactivating(false);
    }
  };

  const filtered = batches.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.item_name?.toLowerCase().includes(q) ||
      b.batch_number?.toLowerCase().includes(q) ||
      b.supplier_name?.toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a1208]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-lg shadow-[#1c6a1e]/20">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                    Stock Lots
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Track batches, profit, and supplier performance
                  </p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by product, lot number, supplier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="depleted">Depleted</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 py-4 pb-24 md:pb-6 max-w-6xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400">
              <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No stock lots found</p>
              <p className="text-sm mt-1">
                Batches are created when you record purchases or add stock
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((batch) => (
                <div
                  key={batch.id}
                  className="group flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-[#1c6a1e]/50 dark:hover:border-[#1c6a1e]/30 transition-all"
                >
                  <button
                    onClick={() => handleRowClick(batch)}
                    className="flex-1 text-left p-4 flex items-center justify-between gap-4 min-w-0 hover:bg-[#1c6a1e]/5 dark:hover:bg-[#1c6a1e]/10 rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-[#1c6a1e]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {batch.item_name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {batch.batch_number || batch.id.slice(0, 8)} •{' '}
                          {batch.supplier_name || 'No supplier'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {formatPrice(batch.profit)} profit
                        </p>
                        <p className="text-xs text-slate-500">
                          {batch.quantity_remaining} / {batch.initial_quantity}{' '}
                          {batch.item_unit_type} left
                        </p>
                      </div>
                      <Badge
                        className={statusColors[batch.status] || 'bg-slate-100'}
                      >
                        {batch.status}
                      </Badge>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </button>
                  {batch.status === 'active' && batch.quantity_remaining > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setListDeactivatingId(batch.id);
                        try {
                          const result = await apiPatch<{ batchId: string; status: string }>(
                            `/api/batches/${batch.id}`,
                            { status: 'deactivated' }
                          );
                          if (result.success) {
                            toast.success('Batch deactivated');
                            fetchBatches();
                            if (selectedBatch?.id === batch.id) {
                              setSelectedBatch((prev) => prev ? { ...prev, status: 'deactivated' } : null);
                            }
                          } else {
                            toast.error(result.message || 'Failed to deactivate');
                          }
                        } catch {
                          toast.error('Failed to deactivate');
                        } finally {
                          setListDeactivatingId(null);
                        }
                      }}
                      disabled={listDeactivatingId === batch.id}
                      className="opacity-60 group-hover:opacity-100 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 shrink-0 mr-2"
                      title="Deactivate batch (won't appear for sale)"
                    >
                      {listDeactivatingId === batch.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Ban className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Drawer */}
        <Drawer
          open={detailDrawerOpen}
          onOpenChange={setDetailDrawerOpen}
          direction="right"
        >
          <DrawerContent className="!w-full sm:!w-[480px] md:!w-[520px] !max-w-none h-full max-h-screen flex flex-col">
            <DrawerHeader className="border-b border-slate-200 dark:border-slate-700">
              <DrawerTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#1c6a1e]" />
                Stock Lot Details
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
                </div>
              ) : selectedBatch ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {selectedBatch.item_name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {selectedBatch.batch_number || selectedBatch.id.slice(0, 8)}
                    </p>
                    <Badge
                      className={`mt-2 ${statusColors[selectedBatch.status] || ''}`}
                    >
                      {selectedBatch.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">
                        Quantity
                      </p>
                      <p className="font-semibold">
                        {selectedBatch.quantity_remaining} /{' '}
                        {selectedBatch.initial_quantity}{' '}
                        {selectedBatch.item_unit_type}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">
                        Cost/unit
                      </p>
                      <p className="font-semibold">
                        {formatPrice(selectedBatch.buy_price_per_unit)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        Profit
                      </p>
                      <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatPrice(selectedBatch.profit)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">
                        Revenue
                      </p>
                      <p className="font-semibold">
                        {formatPrice(selectedBatch.revenue)}
                      </p>
                    </div>
                  </div>

                  {selectedBatch.supplier_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Supplier: {selectedBatch.supplier_name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="w-4 h-4" />
                    <span>Received: {formatDate(selectedBatch.received_at)}</span>
                  </div>

                  {selectedBatch.salesHistory &&
                    selectedBatch.salesHistory.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Sales History</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedBatch.salesHistory.map((sale) => (
                            <div
                              key={sale.sale_id}
                              className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                            >
                              <span>
                                {sale.quantity_sold}{' '}
                                {selectedBatch.item_unit_type} •{' '}
                                {formatDate(sale.sale_date)}
                              </span>
                              <span className="font-medium text-emerald-600">
                                +{formatPrice(sale.profit)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {selectedBatch.status === 'active' &&
                    selectedBatch.quantity_remaining > 0 && (
                      <Button
                        variant="outline"
                        className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
                        onClick={handleDeactivate}
                        disabled={deactivating}
                      >
                        {deactivating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Ban className="w-4 h-4 mr-2" />
                        )}
                        Deactivate batch
                      </Button>
                    )}

                  {selectedBatch.status === 'deactivated' && (
                    <Button
                      className="w-full bg-[#1c6a1e] hover:bg-[#2a8a30]"
                      onClick={handleDeactivate}
                      disabled={deactivating}
                    >
                      {deactivating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Reactivate batch
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">
                  No batch selected
                </p>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </AdminLayout>
  );
}
