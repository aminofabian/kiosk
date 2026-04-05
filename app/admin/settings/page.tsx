'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiPatch } from '@/lib/utils/api-client';
import { toast } from 'sonner';
import { Settings, Loader2, Plus, Trash2, GripVertical, Tag, Palette, Gift } from 'lucide-react';
import type { ProductTypeConfig } from '@/lib/types/product-types';

type ProductType = ProductTypeConfig;

const DEFAULT_NEW_TYPE: ProductTypeConfig = {
  key: '',
  label: '',
  emoji: '📦',
  color: '#64748b',
};

const EMOJI_OPTIONS = ['🥬', '🏪', '🌾', '📦', '🥤', '🧹', '🍎', '🧴', '⚡', '🛒'];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export default function AdminSettingsPage() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<ProductTypeConfig>(DEFAULT_NEW_TYPE);
  const [loyaltyPointsPerKesInput, setLoyaltyPointsPerKesInput] = useState('0');
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{
        productTypes: ProductType[];
        loyaltyPointsPerKes?: number;
      }>('/api/settings');
      if (res.success && res.data) {
        if (res.data.productTypes) setProductTypes(res.data.productTypes);
        if (res.data.loyaltyPointsPerKes !== undefined) {
          setLoyaltyPointsPerKesInput(String(res.data.loyaltyPointsPerKes));
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (types: ProductType[]) => {
    setSaving(true);
    try {
      const res = await apiPatch<{ productTypes: ProductType[] }>('/api/settings', {
        productTypes: types,
      });
      if (res.success && res.data?.productTypes) {
        setProductTypes(res.data.productTypes);
        toast.success('Settings saved');
      } else {
        toast.error(res.message || 'Failed to save');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateType = (index: number, updates: Partial<ProductType>) => {
    const next = productTypes.map((t, i) =>
      i === index ? { ...t, ...updates } : t
    );
    setProductTypes(next);
  };

  const handleRemoveType = (index: number) => {
    const t = productTypes[index];
    toast(`Remove "${t.label}"? Items using this type will keep it until you change them.`, {
      action: {
        label: 'Remove',
        onClick: () => {
          const next = productTypes.filter((_, i) => i !== index);
          setProductTypes(next);
          handleSave(next);
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleAddType = () => {
    const key = newType.key.trim() || slugify(newType.label.trim());
    if (!key) {
      toast.error('Enter a label or key');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(key)) {
      toast.error('Key must be lowercase letters, numbers, or underscore');
      return;
    }
    if (productTypes.some((t) => t.key === key)) {
      toast.error('A type with this key already exists');
      return;
    }
    const toAdd: ProductType = {
      key,
      label: newType.label.trim() || key,
      emoji: newType.emoji || '📦',
      color: newType.color || '#64748b',
    };
    const next = [...productTypes, toAdd];
    setProductTypes(next);
    setNewType(DEFAULT_NEW_TYPE);
    setAdding(false);
    handleSave(next);
  };

  const handleSaveLoyalty = async () => {
    const raw = loyaltyPointsPerKesInput.trim().replace(',', '.');
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      toast.error('Rate must be a number from 0 (off) up to 5 points per KES');
      return;
    }
    setLoyaltySaving(true);
    try {
      const res = await apiPatch<{ loyaltyPointsPerKes: number }>('/api/settings', {
        loyaltyPointsPerKes: n,
      });
      if (res.success && res.data?.loyaltyPointsPerKes !== undefined) {
        setLoyaltyPointsPerKesInput(String(res.data.loyaltyPointsPerKes));
        toast.success('Loyalty rate saved');
      } else {
        toast.error(res.message || 'Failed to save');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save loyalty rate');
    } finally {
      setLoyaltySaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen px-3 py-4 sm:px-4 md:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Settings
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Business and product type configuration
              </p>
            </div>
          </div>

          <Card className="mb-6 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Loyalty points
              </CardTitle>
              <CardDescription>
                When a sale is linked to a customer (credit tab, split credit, or wallet-linked phone),
                they earn points: <span className="font-mono text-slate-700 dark:text-slate-300">floor(sale total × rate)</span>.
                Example: rate <span className="font-mono">0.01</span> → 100 KES = 1 point. Set to{' '}
                <span className="font-mono">0</span> to turn earning off.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-7 h-7 animate-spin text-[#1c6a1e]" />
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="loyalty-rate">Points per 1 KES</Label>
                    <Input
                      id="loyalty-rate"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={5}
                      step="0.0001"
                      value={loyaltyPointsPerKesInput}
                      onChange={(e) => setLoyaltyPointsPerKesInput(e.target.value)}
                      className="h-10 max-w-xs font-mono text-sm"
                      placeholder="0.01"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Allowed range: 0–5. Customers see their balance on the public credit status page.
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={loyaltySaving}
                    className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white shrink-0"
                    onClick={() => void handleSaveLoyalty()}
                  >
                    {loyaltySaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save rate'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#1c6a1e]" />
                Product Types
              </CardTitle>
              <CardDescription>
                These types are used for items, POS departments, and sales/profit reports. Add or
                remove types (e.g. Grocery, Retail, Cereals). Defaults: Grocery, Retail.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
                </div>
              ) : (
                <div className="space-y-4">
                  {productTypes.map((t, index) => (
                    <div
                      key={t.key}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
                    >
                      <span className="text-slate-400 dark:text-slate-500 cursor-grab">
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <span className="text-2xl" title="Emoji">
                        {t.emoji}
                      </span>
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-slate-500">Label</Label>
                          <Input
                            value={t.label}
                            onChange={(e) => handleUpdateType(index, { label: e.target.value })}
                            className="h-9 text-sm"
                            placeholder="e.g. Grocery"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Key (used in data)</Label>
                          <Input
                            value={t.key}
                            onChange={(e) =>
                              handleUpdateType(index, { key: e.target.value.toLowerCase().replace(/\s/g, '_') })
                            }
                            className="h-9 text-sm font-mono"
                            placeholder="grocery"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="color"
                          value={t.color}
                          onChange={(e) => {
                            handleUpdateType(index, { color: e.target.value });
                            handleSave(
                              productTypes.map((x, i) =>
                                i === index ? { ...x, color: e.target.value } : x
                              )
                            );
                          }}
                          className="w-9 h-9 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                          title="Color"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleRemoveType(index)}
                          title="Remove type"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {adding ? (
                    <div className="flex flex-wrap items-end gap-3 p-4 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex gap-2 items-center">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setNewType((p) => ({ ...p, emoji }))}
                            className={`text-2xl p-1 rounded ${
                              newType.emoji === emoji
                                ? 'ring-2 ring-[#1c6a1e] bg-emerald-50 dark:bg-emerald-900/20'
                                : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 items-end">
                        <div>
                          <Label className="text-xs">Label</Label>
                          <Input
                            value={newType.label}
                            onChange={(e) =>
                              setNewType((p) => ({
                                ...p,
                                label: e.target.value,
                                key: p.key || slugify(e.target.value),
                              }))
                            }
                            placeholder="e.g. Cereals"
                            className="h-9 w-36"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Key</Label>
                          <Input
                            value={newType.key}
                            onChange={(e) =>
                              setNewType((p) => ({ ...p, key: e.target.value.toLowerCase().replace(/\s/g, '_') }))
                            }
                            placeholder="cereals"
                            className="h-9 w-28 font-mono"
                          />
                        </div>
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <Palette className="w-3 h-3" /> Color
                          </Label>
                          <input
                            type="color"
                            value={newType.color}
                            onChange={(e) => setNewType((p) => ({ ...p, color: e.target.value }))}
                            className="w-9 h-9 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white h-9"
                          onClick={handleAddType}
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => {
                            setAdding(false);
                            setNewType(DEFAULT_NEW_TYPE);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-[#1c6a1e] hover:text-[#1c6a1e]"
                      onClick={() => setAdding(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add product type
                    </Button>
                  )}

                  {productTypes.length > 0 && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        disabled={saving}
                        className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
                        onClick={() => handleSave(productTypes)}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save changes'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
