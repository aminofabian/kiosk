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
  Ban,
  Check,
  Calendar,
  User,
  ArrowDown,
  ArrowUp,
  Warehouse,
  Receipt,
  TrendingUp,
  Clock,
  ShoppingCart,
  AlertTriangle,
  CalendarClock,
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

const formatDateTime = (ts: number) => {
  const d = new Date(ts * 1000);
  return {
    date: d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
  };
};

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
      const apiStatus = statusFilter === 'expiring' ? 'active' : statusFilter;
      if (apiStatus) params.set('status', apiStatus);
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

  const now = Math.floor(Date.now() / 1000);

  const filtered = batches.filter((b) => {
    if (statusFilter === 'expiring') {
      if (!b.expiry_date || b.quantity_remaining <= 0) return false;
      const shelfLife = b.expiry_date - b.received_at;
      const threshold = b.expiry_date - shelfLife / 4;
      if (now < threshold) return false;
    }
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
                <option value="expiring">Expiring Soon</option>
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
            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
                </div>
              ) : selectedBatch ? (
                (() => {
                  const b = selectedBatch;
                  const totalInvestment = b.buy_price_per_unit * b.initial_quantity;
                  const cogs = b.buy_price_per_unit * b.quantity_sold;
                  const revenue = b.revenue;
                  const grossProfit = revenue - cogs;
                  const unsoldStockValue = b.buy_price_per_unit * b.quantity_remaining;
                  const soldPct = b.initial_quantity > 0 ? (b.quantity_sold / b.initial_quantity) * 100 : 0;
                  const remainPct = b.initial_quantity > 0 ? (b.quantity_remaining / b.initial_quantity) * 100 : 0;
                  const lostQty = b.initial_quantity - b.quantity_sold - b.quantity_remaining;
                  const lostPct = b.initial_quantity > 0 ? (lostQty / b.initial_quantity) * 100 : 0;
                  const lostValue = b.buy_price_per_unit * lostQty;
                  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
                  const avgSellPrice = b.quantity_sold > 0 ? revenue / b.quantity_sold : 0;
                  const markup = b.buy_price_per_unit > 0 ? ((avgSellPrice - b.buy_price_per_unit) / b.buy_price_per_unit) * 100 : 0;

                  return (
                    <div className="space-y-0">
                      {/* Hero Card */}
                      <div className="bg-gradient-to-br from-[#1c6a1e] to-[#145216] p-5 text-white">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-lg font-bold truncate">{b.item_name}</h3>
                            <p className="text-white/60 text-sm font-mono mt-0.5">
                              LOT {b.batch_number || b.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                          <Badge className={`shrink-0 ${b.status === 'active' ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-400/30' : b.status === 'depleted' ? 'bg-white/10 text-white/70 border border-white/20' : 'bg-amber-400/20 text-amber-100 border border-amber-400/30'}`}>
                            {b.status}
                          </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-white/50 text-[11px] uppercase tracking-wider">Buy Price</p>
                            <p className="text-sm font-semibold mt-0.5">{formatPrice(b.buy_price_per_unit)}<span className="text-white/50 font-normal">/{b.item_unit_type}</span></p>
                          </div>
                          {b.quantity_sold > 0 && (
                            <div>
                              <p className="text-white/50 text-[11px] uppercase tracking-wider">Avg Sell</p>
                              <p className="text-sm font-semibold mt-0.5">{formatPrice(avgSellPrice)}<span className="text-white/50 font-normal">/{b.item_unit_type}</span></p>
                            </div>
                          )}
                          <div>
                            <p className="text-white/50 text-[11px] uppercase tracking-wider">Received</p>
                            <p className="text-sm font-semibold mt-0.5">{formatDate(b.received_at)}</p>
                          </div>
                        </div>
                        {b.supplier_name && (
                          <div className="mt-3 flex items-center gap-1.5 text-white/60 text-xs">
                            <User className="w-3.5 h-3.5" />
                            <span>{b.supplier_name}</span>
                          </div>
                        )}
                        {b.expiry_date && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            <span className={b.expiry_date * 1000 < Date.now() ? 'text-red-300' : 'text-white/60'}>
                              {b.expiry_date * 1000 < Date.now() ? 'Expired' : 'Expires'}: {formatDate(b.expiry_date)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-5">
                        {/* Stock Gauge */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                              <Warehouse className="w-4 h-4 text-slate-400" />
                              Stock Breakdown
                            </h4>
                            <span className="text-xs text-slate-500">{b.initial_quantity} {b.item_unit_type} total</span>
                          </div>
                          <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                            {soldPct > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${soldPct}%` }} />}
                            {lostPct > 0 && <div className="bg-red-400 transition-all" style={{ width: `${lostPct}%` }} />}
                            {remainPct > 0 && <div className="bg-blue-400 transition-all" style={{ width: `${remainPct}%` }} />}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-slate-600 dark:text-slate-400">Sold: <span className="font-semibold text-slate-800 dark:text-slate-200">{b.quantity_sold}</span></span>
                            </div>
                            {lostQty > 0 && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                <span className="text-slate-600 dark:text-slate-400">Lost/Waste: <span className="font-semibold text-red-600 dark:text-red-400">{lostQty}</span></span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="w-2 h-2 rounded-full bg-blue-400" />
                              <span className="text-slate-600 dark:text-slate-400">Remaining: <span className="font-semibold text-slate-800 dark:text-slate-200">{b.quantity_remaining}</span></span>
                            </div>
                          </div>
                        </div>

                        {/* Financial Flow */}
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-3">
                            <Receipt className="w-4 h-4 text-slate-400" />
                            Financial Summary
                          </h4>
                          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            {/* Investment */}
                            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                  <ArrowDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Total Investment</p>
                                  <p className="text-[11px] text-slate-400">{b.initial_quantity} × {formatPrice(b.buy_price_per_unit)}</p>
                                </div>
                              </div>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatPrice(totalInvestment)}</p>
                            </div>

                            <div className="h-px bg-slate-200 dark:bg-slate-700" />

                            {/* Revenue */}
                            <div className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                  <ArrowUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Revenue</p>
                                  <p className="text-[11px] text-slate-400">{b.quantity_sold} {b.item_unit_type} sold</p>
                                </div>
                              </div>
                              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(revenue)}</p>
                            </div>

                            <div className="h-px bg-slate-200 dark:bg-slate-700" />

                            {/* COGS */}
                            <div className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                  <ShoppingCart className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Cost of Goods Sold</p>
                                  <p className="text-[11px] text-slate-400">{b.quantity_sold} × {formatPrice(b.buy_price_per_unit)}</p>
                                </div>
                              </div>
                              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">−{formatPrice(cogs)}</p>
                            </div>

                            {/* Loss row if stock was lost */}
                            {lostQty > 0 && (
                              <>
                                <div className="h-px bg-slate-200 dark:bg-slate-700" />
                                <div className="flex items-center justify-between px-4 py-3 bg-red-50/50 dark:bg-red-900/10">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-red-700 dark:text-red-300">Stock Loss</p>
                                      <p className="text-[11px] text-red-400">{lostQty} {b.item_unit_type} unaccounted</p>
                                    </div>
                                  </div>
                                  <p className="text-sm font-bold text-red-600 dark:text-red-400">−{formatPrice(lostValue)}</p>
                                </div>
                              </>
                            )}

                            <div className="h-px bg-slate-200 dark:bg-slate-700" />

                            {/* Profit */}
                            <div className={`flex items-center justify-between px-4 py-3.5 ${grossProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/15' : 'bg-red-50 dark:bg-red-900/15'}`}>
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${grossProfit >= 0 ? 'bg-emerald-200 dark:bg-emerald-800/50' : 'bg-red-200 dark:bg-red-800/50'}`}>
                                  <TrendingUp className={`w-3.5 h-3.5 ${grossProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`} />
                                </div>
                                <div>
                                  <p className={`text-sm font-semibold ${grossProfit >= 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'}`}>
                                    Gross Profit
                                  </p>
                                  {revenue > 0 && (
                                    <p className={`text-[11px] ${grossProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                      {margin.toFixed(1)}% margin{b.quantity_sold > 0 ? ` · ${markup.toFixed(0)}% markup` : ''}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <p className={`text-base font-extrabold ${grossProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                                {grossProfit >= 0 ? '' : '−'}{formatPrice(grossProfit)}
                              </p>
                            </div>

                            {/* Unsold value */}
                            {b.quantity_remaining > 0 && (
                              <>
                                <div className="h-px bg-slate-200 dark:bg-slate-700" />
                                <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/50 dark:bg-blue-900/10">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                      <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Unsold Stock Value</p>
                                      <p className="text-[11px] text-blue-400">{b.quantity_remaining} {b.item_unit_type} × {formatPrice(b.buy_price_per_unit)}</p>
                                    </div>
                                  </div>
                                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatPrice(unsoldStockValue)}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Sales History */}
                        {b.salesHistory && b.salesHistory.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-3">
                              <ShoppingCart className="w-4 h-4 text-slate-400" />
                              Sales History
                              <span className="ml-auto text-xs font-normal text-slate-400">{b.salesHistory.length} transaction{b.salesHistory.length !== 1 ? 's' : ''}</span>
                            </h4>
                            <div className="space-y-0 max-h-64 overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                              {b.salesHistory.map((sale) => {
                                const saleTotal = sale.quantity_sold * sale.sell_price_per_unit;
                                const dt = formatDateTime(sale.sale_date);
                                return (
                                  <div
                                    key={sale.sale_id}
                                    className="flex items-center justify-between py-2.5 px-1"
                                  >
                                    <div>
                                      <p className="text-sm text-slate-700 dark:text-slate-200">{dt.date} <span className="text-slate-400 dark:text-slate-500">{dt.time}</span></p>
                                      <p className="text-xs text-slate-400 mt-0.5">{sale.quantity_sold} {b.item_unit_type}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{formatPrice(saleTotal)}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* No sales message */}
                        {(!b.salesHistory || b.salesHistory.length === 0) && (
                          <div className="text-center py-6">
                            <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                            <p className="text-sm text-slate-400">No sales recorded for this lot yet</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="pt-2 pb-4">
                          {b.status === 'active' && b.quantity_remaining > 0 && (
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
                              Deactivate Lot
                            </Button>
                          )}

                          {b.status === 'deactivated' && (
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
                              Reactivate Lot
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
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
