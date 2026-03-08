'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MapPin,
  Plus,
  Loader2,
  Search,
  Package,
  Store,
  Grid3X3,
  ChevronDown,
  Sparkles,
  Trash2,
  Pencil,
  Check,
  X,
  Zap,
} from 'lucide-react';
import type { Item, Category, Aisle } from '@/lib/db/types';
import { toast } from 'sonner';

interface ItemWithCategory extends Item {
  category_name?: string;
}

function getAisleMatch(
  item: Item,
  aisles: Aisle[]
): Aisle | undefined {
  const itemAisle = (item as Item & { aisle?: string | null }).aisle?.trim();
  const itemNum = (item as Item & { aisle_number?: string | null }).aisle_number?.trim();
  if (!itemAisle && !itemNum) return undefined;
  return aisles.find(
    (a) =>
      (a.name?.trim() || '') === (itemAisle || '') &&
      (a.number?.trim() || '') === (itemNum || '')
  );
}

function aisleLabel(a: Aisle) {
  if (a.number?.trim()) return `${a.name} (${a.number})`;
  return a.name;
}

/** Inline aisle selector with search + create-new-and-assign */
function AisleAssigner({
  item,
  aisles,
  match,
  isUpdating,
  onAssign,
  onCreateAndAssign,
  onClear,
}: {
  item: ItemWithCategory;
  aisles: Aisle[];
  match: Aisle | undefined;
  isUpdating: boolean;
  onAssign: (itemId: string, aisleId: string | null) => void;
  onCreateAndAssign: (itemId: string, name: string, number?: string) => Promise<Aisle | null>;
  onClear: (itemId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addNumber, setAddNumber] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return aisles;
    const q = search.toLowerCase();
    return aisles.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.number && a.number.toString().toLowerCase().includes(q))
    );
  }, [aisles, search]);

  const showCreateOption = search.trim() && !aisles.some((a) => aisleLabel(a).toLowerCase() === search.trim().toLowerCase());

  const handleCreateAndAssign = async () => {
    const name = showAdd ? addName.trim() : search.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      const created = await onCreateAndAssign(item.id, name, addNumber.trim() || undefined);
      if (created) {
        setOpen(false);
        setShowAdd(false);
        setSearch('');
        setAddName('');
        setAddNumber('');
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isUpdating}
        className="flex items-center gap-2 w-full max-w-[220px] h-9 px-3 rounded-lg border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors text-left"
      >
        {isUpdating ? (
          <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
        ) : (
          <>
            <Grid3X3 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className={match ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-500'}>
              {match ? aisleLabel(match) : 'Assign aisle…'}
            </span>
            <ChevronDown className={`w-4 h-4 ml-auto shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <Input
              placeholder="Search or type new…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowAdd(false);
              }}
              className="h-9 rounded-lg text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => onClear(item.id)}
              className="w-full px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              No aisle
            </button>
            {filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onAssign(item.id, a.id);
                  setOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2"
              >
                <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                {aisleLabel(a)}
                {match?.id === a.id && <Check className="w-4 h-4 ml-auto text-amber-600" />}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 p-2 space-y-2">
            {showAdd ? (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                <Input
                  placeholder="Aisle name (e.g. A1, Produce)"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
                <Input
                  placeholder="Number (optional)"
                  value={addNumber}
                  onChange={(e) => setAddNumber(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8 bg-amber-500 hover:bg-amber-600 text-white text-xs"
                    onClick={handleCreateAndAssign}
                    disabled={isCreating || !addName.trim()}
                  >
                    {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create & assign
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowAdd(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : showCreateOption ? (
              <button
                type="button"
                onClick={() => {
                  setAddName(search.trim());
                  setAddNumber('');
                  setShowAdd(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200/60 dark:border-amber-800/40"
              >
                <Plus className="w-4 h-4" />
                Create &quot;{search.trim()}&quot; and assign
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAddName('');
                  setAddNumber('');
                  setShowAdd(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <Plus className="w-4 h-4" />
                Add new aisle…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AislesPage() {
  const [items, setItems] = useState<ItemWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [aisleFilter, setAisleFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'single' | 'series'>('single');
  const [newAisleName, setNewAisleName] = useState('');
  const [newAisleNumber, setNewAisleNumber] = useState('');
  const [seriesPrefix, setSeriesPrefix] = useState('A');
  const [seriesStart, setSeriesStart] = useState(1);
  const [seriesEnd, setSeriesEnd] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [editingAisle, setEditingAisle] = useState<Aisle | null>(null);
  const [manageAislesOpen, setManageAislesOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkSelectValue, setBulkSelectValue] = useState<string>('__none__');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, categoriesRes, aislesRes] = await Promise.all([
        fetch('/api/items?all=true&sellableOnly=true', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
        fetch('/api/aisles', { cache: 'no-store' }),
      ]);

      const itemsResult = await itemsRes.json();
      const categoriesResult = await categoriesRes.json();
      const aislesResult = await aislesRes.json();

      if (categoriesResult.success) setCategories(categoriesResult.data);
      if (aislesResult.success) setAisles(aislesResult.data);

      if (itemsResult.success) {
        const allItems: ItemWithCategory[] = itemsResult.data.map((item: Item) => {
          const category = categoriesResult.success
            ? categoriesResult.data.find((c: Category) => c.id === item.category_id)
            : null;
          return { ...item, category_name: category?.name };
        });
        setItems(allItems);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const name = item.variant_name ? `${item.name} – ${item.variant_name}` : item.name;
        if (
          !name.toLowerCase().includes(q) &&
          !(item.category_name?.toLowerCase().includes(q))
        )
          return false;
      }
      if (aisleFilter !== 'all') {
        const match = getAisleMatch(item, aisles);
        if (!match || match.id !== aisleFilter) return false;
      }
      return true;
    });
  }, [items, searchQuery, aisleFilter, aisles]);

  const handleCreateAisle = async () => {
    if (createMode === 'series') {
      if (!seriesPrefix.trim()) {
        toast.error('Prefix is required');
        return;
      }
      if (seriesStart > seriesEnd) {
        toast.error('Start must be less than or equal to end');
        return;
      }
    } else {
      if (!newAisleName.trim()) {
        toast.error('Aisle name is required');
        return;
      }
    }
    setIsCreating(true);
    try {
      const body =
        createMode === 'series'
          ? {
              createSeries: true,
              prefix: seriesPrefix.trim(),
              start: seriesStart,
              end: seriesEnd,
            }
          : {
              name: newAisleName.trim(),
              number: newAisleNumber.trim() || null,
            };
      const res = await fetch('/api/aisles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        setAisles((prev) => [...prev, ...data]);
        setCreateOpen(false);
        setNewAisleName('');
        setNewAisleNumber('');
        setSeriesPrefix('A');
        setSeriesStart(1);
        setSeriesEnd(10);
        toast.success(
          data.length > 1 ? `Created ${data.length} aisles` : 'Aisle created'
        );
      } else {
        toast.error(result.message || 'Failed to create aisle');
      }
    } catch {
      toast.error('Failed to create aisle');
    } finally {
      setIsCreating(false);
    }
  };

  const updateItemAisle = (itemId: string, aisle: Aisle | null) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        return {
          ...i,
          aisle: aisle?.name ?? null,
          aisle_number: aisle?.number ?? null,
        } as ItemWithCategory;
      })
    );
  };

  const handleAssignAisle = async (itemId: string, aisleId: string | null) => {
    setUpdatingItemId(itemId);
    try {
      const res = await fetch(`/api/items/${itemId}/aisle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aisleId }),
      });
      const result = await res.json();
      if (result.success) {
        const aisle = aisleId ? (aisles.find((a) => a.id === aisleId) ?? null) : null;
        updateItemAisle(itemId, aisle);
        toast.success('Aisle updated');
      } else {
        toast.error(result.message || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleCreateAndAssign = async (
    itemId: string,
    name: string,
    number?: string
  ): Promise<Aisle | null> => {
    try {
      const res = await fetch('/api/aisles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), number: number?.trim() || null }),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.message || 'Failed to create aisle');
        return null;
      }
      const newAisle = result.data;
      setAisles((prev) => [...prev, newAisle]);
      const patchRes = await fetch(`/api/items/${itemId}/aisle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aisleId: newAisle.id }),
      });
      if (patchRes.ok) {
        updateItemAisle(itemId, newAisle);
      }
      toast.success(`Created "${aisleLabel(newAisle)}" and assigned`);
      return newAisle;
    } catch {
      toast.error('Failed to create aisle');
      return null;
    }
  };

  const handleBulkAssign = async (aisleId: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkAssigning(true);
    try {
      let ok = 0;
      for (const id of ids) {
        const res = await fetch(`/api/items/${id}/aisle`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aisleId }),
        });
        const result = await res.json();
        if (result.success) {
          const aisle = aisleId ? (aisles.find((a) => a.id === aisleId) ?? null) : null;
          updateItemAisle(id, aisle);
          ok++;
        }
      }
      setSelectedIds(new Set());
      setBulkSelectValue('__none__');
      toast.success(`Assigned ${ok} item${ok !== 1 ? 's' : ''} to aisle`);
    } catch {
      toast.error('Failed to assign');
    } finally {
      setBulkAssigning(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const handleDeleteAisle = async (aisle: Aisle) => {
    if (!confirm(`Delete aisle "${aisleLabel(aisle)}"? Items will be unassigned.`)) return;
    try {
      const res = await fetch(`/api/aisles/${aisle.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setAisles((prev) => prev.filter((a) => a.id !== aisle.id));
        setItems((prev) =>
          prev.map((i) => {
            const m = getAisleMatch(i, [aisle]);
            if (!m) return i;
            return { ...i, aisle: null, aisle_number: null } as ItemWithCategory;
          })
        );
        toast.success('Aisle deleted');
      } else {
        toast.error(result.message || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingAisle) return;
    try {
      const res = await fetch(`/api/aisles/${editingAisle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), number: editNumber.trim() || null }),
      });
      const result = await res.json();
      if (result.success) {
        setAisles((prev) =>
          prev.map((a) => (a.id === editingAisle.id ? result.data : a))
        );
        setEditingAisle(null);
        toast.success('Aisle updated');
      } else {
        toast.error(result.message || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    }
  };

  const formatPrice = (p: number) => `KES ${p.toFixed(0)}`;
  const formatStock = (s: number, u: string) =>
    u === 'piece' ? Math.round(s).toString() : `${s.toFixed(1)} ${u}`;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-amber-50/30 dark:from-[#0f1a0d] dark:via-[#0f1a0d] dark:to-emerald-950/10">
        {/* Header - Store map aesthetic */}
        <div className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-xl">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Store Layout
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Organize aisles and assign products to locations
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => {
                  setNewAisleName('');
                  setNewAisleNumber('');
                  setCreateOpen(true);
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 border-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Aisle
              </Button>
            </div>

            {/* Aisle chips + search */}
            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50"
                />
              </div>
              <div className="flex gap-2">
                <Select value={aisleFilter} onValueChange={setAisleFilter}>
                  <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-xl">
                    <Store className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by aisle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    {aisles.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {aisleLabel(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 rounded-xl"
                  onClick={() => setManageAislesOpen(true)}
                >
                  Manage aisles
                </Button>
              </div>
            </div>

          </div>
        </div>

        {/* Items table */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-12 h-12 animate-spin text-amber-500 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">Loading products...</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/30 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
                      <th className="w-10 py-4 pl-4 pr-2">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center hover:border-amber-500 transition-colors"
                        >
                          {selectedIds.size > 0 && selectedIds.size >= filteredItems.length ? (
                            <Check className="w-3 h-3 text-amber-600" />
                          ) : null}
                        </button>
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Product
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Category
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Price
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Stock
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[220px]">
                        Aisle
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => {
                      const match = getAisleMatch(item, aisles);
                      const isUpdating = updatingItemId === item.id;
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-slate-100 dark:border-slate-800/80 transition-colors hover:bg-amber-50/30 dark:hover:bg-slate-800/30 ${
                            selectedIds.has(item.id) ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                          } ${
                            idx % 2 === 0 && !selectedIds.has(item.id) ? 'bg-white dark:bg-transparent' : 'bg-slate-50/30 dark:bg-slate-900/20'
                          }`}
                        >
                          <td className="w-10 py-3.5 pl-4 pr-2">
                            <button
                              type="button"
                              onClick={() => toggleSelect(item.id)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors hover:border-amber-500 ${
                                selectedIds.has(item.id)
                                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {selectedIds.has(item.id) ? (
                                <Check className="w-3 h-3 text-amber-600" />
                              ) : null}
                            </button>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {item.variant_name ? `${item.name} – ${item.variant_name}` : item.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-sm text-slate-600 dark:text-slate-400">
                            {item.category_name || '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-sm font-medium text-slate-700 dark:text-slate-300">
                            {formatPrice(item.current_sell_price)}
                          </td>
                          <td className="py-3.5 px-4 text-sm text-slate-600 dark:text-slate-400">
                            {formatStock(item.current_stock, item.unit_type)}
                          </td>
                          <td className="py-3.5 px-4">
                            <AisleAssigner
                              item={item}
                              aisles={aisles}
                              match={match}
                              isUpdating={isUpdating}
                              onAssign={handleAssignAisle}
                              onCreateAndAssign={handleCreateAndAssign}
                              onClear={(id) => handleAssignAisle(id, null)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredItems.length === 0 && (
                <div className="py-16 text-center">
                  <Sparkles className="w-12 h-12 mx-auto text-amber-400/60 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {searchQuery || aisleFilter !== 'all'
                      ? 'No products match your filters'
                      : 'No products yet. Add items first.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating bulk assign bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-8 md:max-w-lg z-30 animate-in slide-in-from-bottom-4 duration-300">
            <div className="rounded-2xl border border-amber-200/80 dark:border-amber-700/50 bg-white dark:bg-slate-900 shadow-2xl shadow-amber-500/10 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Assign to aisle or clear
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={bulkSelectValue}
                    onValueChange={(v) => {
                      setBulkSelectValue(v);
                      if (v === '__clear__') handleBulkAssign(null);
                      else if (v && v !== '__none__') handleBulkAssign(v);
                    }}
                    disabled={bulkAssigning}
                  >
                    <SelectTrigger className="w-[180px] h-9 rounded-lg border-amber-200/60 bg-amber-50/50">
                      <SelectValue placeholder="Assign to…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-slate-500">Assign to…</span>
                      </SelectItem>
                      <SelectItem value="__clear__">
                        <span className="text-slate-500 flex items-center gap-2">
                          <X className="w-4 h-4" />
                          Clear aisle
                        </span>
                      </SelectItem>
                      {aisles.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-amber-500" />
                            {aisleLabel(a)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    Deselect all
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Aisle Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl border-amber-200/60 dark:border-amber-800/40">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-500" />
                New Aisle
              </DialogTitle>
              <DialogDescription>
                Create a single aisle or a series (e.g., A1, A2, A3…). Assign products from the table below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={() => setCreateMode('single')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    createMode === 'single'
                      ? 'bg-white dark:bg-slate-700 shadow text-amber-700 dark:text-amber-300'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('series')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    createMode === 'series'
                      ? 'bg-white dark:bg-slate-700 shadow text-amber-700 dark:text-amber-300'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Series (A1, A2…)
                </button>
              </div>

              {createMode === 'single' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="aisle-name">Aisle name</Label>
                    <Input
                      id="aisle-name"
                      placeholder="e.g., Produce, Dairy, Snacks"
                      value={newAisleName}
                      onChange={(e) => setNewAisleName(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aisle-number">Aisle number (optional)</Label>
                    <Input
                      id="aisle-number"
                      placeholder="e.g., A3, 12"
                      value={newAisleNumber}
                      onChange={(e) => setNewAisleNumber(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="series-prefix">Prefix</Label>
                      <Input
                        id="series-prefix"
                        placeholder="A"
                        value={seriesPrefix}
                        onChange={(e) => setSeriesPrefix(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="series-start">Start</Label>
                      <Input
                        id="series-start"
                        type="number"
                        min={1}
                        value={seriesStart}
                        onChange={(e) => setSeriesStart(parseInt(e.target.value, 10) || 1)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="series-end">End</Label>
                      <Input
                        id="series-end"
                        type="number"
                        min={1}
                        value={seriesEnd}
                        onChange={(e) => setSeriesEnd(parseInt(e.target.value, 10) || 1)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Creates: {seriesPrefix || 'A'}{seriesStart} through {seriesPrefix || 'A'}{seriesEnd} (
                    {Math.max(0, seriesEnd - seriesStart + 1)} aisles)
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateAisle}
                disabled={
                  isCreating ||
                  (createMode === 'single' ? !newAisleName.trim() : !seriesPrefix.trim())
                }
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {createMode === 'series' && seriesEnd >= seriesStart
                  ? `Create ${seriesEnd - seriesStart + 1} aisles`
                  : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Aisles Dialog */}
        <Dialog open={manageAislesOpen} onOpenChange={setManageAislesOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Manage Aisles</DialogTitle>
              <DialogDescription>Edit or delete aisles. Create new ones from the main page.</DialogDescription>
            </DialogHeader>
            <div className="max-h-64 overflow-y-auto space-y-2 py-4">
              {aisles.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No aisles yet. Create one with the New Aisle button.</p>
              ) : (
                aisles.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                  >
                    <span className="font-medium">{aisleLabel(a)}</span>
                    <span className="text-xs text-slate-500">
                      {items.filter((i) => getAisleMatch(i, [a])).length} items
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingAisle(a);
                          setEditName(a.name);
                          setEditNumber(a.number || '');
                          setManageAislesOpen(false);
                        }}
                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteAisle(a)}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Aisle Dialog */}
        <Dialog open={!!editingAisle} onOpenChange={(o) => !o && setEditingAisle(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Edit Aisle</DialogTitle>
              <DialogDescription>Update the aisle name and number.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Number (optional)</Label>
                <Input
                  value={editNumber}
                  onChange={(e) => setEditNumber(e.target.value)}
                  placeholder="e.g., A3"
                  className="rounded-xl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingAisle(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editName.trim()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
