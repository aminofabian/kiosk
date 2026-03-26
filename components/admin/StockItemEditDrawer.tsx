'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Loader2, X, Save, Package, TrendingUp, TrendingDown, Minus, Sparkles,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { UNIT_TYPES, ADJUSTMENT_REASONS } from '@/lib/constants';
import type { UnitType, AdjustmentReason } from '@/lib/constants';
import type { Category } from '@/lib/db/types';

interface StockItemData {
  id: string;
  name: string;
  variant_name: string | null;
  category_id: string;
  category_name?: string;
  unit_type: UnitType;
  item_type: string;
  current_stock: number;
  current_sell_price: number;
  min_stock_level: number | null;
  barcode: string | null;
  product_code: string | null;
  expiry_date: number | null;
  bundle_quantity: number | null;
  bundle_price: number | null;
  bundle_name: string | null;
  packaging_unit_name: string | null;
  packaging_unit_qty: number | null;
  aisle_number?: string | null;
  parent_item_id: string | null;
  stock_value: number;
  sales_value: number;
  trend: 'growing' | 'shrinking' | 'stable' | 'new';
  stock_change_percent: number | null;
}

interface StockItemEditDrawerProps {
  item: StockItemData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  itemTypes: string[];
  onSaved: () => void;
}

const REASON_LABELS: Record<AdjustmentReason, string> = {
  restock: 'Restock / New Delivery',
  spoilage: 'Spoilage',
  theft: 'Theft',
  counting_error: 'Counting Error',
  damage: 'Damage',
  other: 'Other',
};

const UNIT_LABELS: Record<string, string> = {
  kg: 'Kilograms (kg)',
  g: 'Grams (g)',
  piece: 'Pieces',
  bunch: 'Bunches',
  tray: 'Trays',
  litre: 'Litres (L)',
  ml: 'Millilitres (ml)',
};

const TREND_CONFIG = {
  growing: { label: 'Growing', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  shrinking: { label: 'Declining', icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30' },
  stable: { label: 'Stable', icon: Minus, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30' },
  new: { label: 'New', icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
};

export function StockItemEditDrawer({ item, open, onOpenChange, categories, itemTypes, onSaved }: StockItemEditDrawerProps) {
  // Item detail fields
  const [name, setName] = useState('');
  const [variantName, setVariantName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitType, setUnitType] = useState<string>('piece');
  const [itemType, setItemType] = useState('retail');
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productCode, setProductCode] = useState('');
  const [aisleNumber, setAisleNumber] = useState('');

  // Stock adjustment fields
  const [showStockAdjust, setShowStockAdjust] = useState(false);
  const [adjustType, setAdjustType] = useState<'increase' | 'decrease'>('increase');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState<AdjustmentReason>('restock');
  const [adjustNotes, setAdjustNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resetForm = useCallback(() => {
    setShowStockAdjust(false);
    setAdjustType('increase');
    setAdjustQty('');
    setAdjustReason('restock');
    setAdjustNotes('');
    setShowAdvanced(false);
  }, []);

  useEffect(() => {
    if (item && open) {
      setName(item.name);
      setVariantName(item.variant_name || '');
      setCategoryId(item.category_id);
      setUnitType(item.unit_type);
      setItemType(item.item_type || 'retail');
      setSellPrice(String(item.current_sell_price || ''));
      setMinStockLevel(item.min_stock_level ? String(item.min_stock_level) : '');
      setBarcode(item.barcode || '');
      setProductCode(item.product_code || '');
      setAisleNumber(item.aisle_number || '');
      resetForm();

      // Fetch buy price from item detail API
      setLoadingDetail(true);
      fetch(`/api/items/${item.id}`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data.buy_price != null) {
            setBuyPrice(String(res.data.buy_price));
          } else {
            setBuyPrice('');
          }
        })
        .catch(() => setBuyPrice(''))
        .finally(() => setLoadingDetail(false));
    }
  }, [item, open, resetForm]);

  const handleSaveDetails = async () => {
    if (!item) return;
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!categoryId) { toast.error('Category is required'); return; }
    if (!sellPrice || Number(sellPrice) <= 0) { toast.error('Sell price must be greater than 0'); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          variantName: variantName.trim() || null,
          categoryId,
          unitType,
          itemType,
          sellPrice: Number(sellPrice),
          buyPrice: buyPrice ? Number(buyPrice) : null,
          minStockLevel: minStockLevel ? Number(minStockLevel) : null,
          barcode: barcode.trim() || null,
          productCode: productCode.trim() || null,
          aisleNumber: aisleNumber.trim() || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Item updated');
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(result.message || 'Failed to update item');
      }
    } catch {
      toast.error('Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleStockAdjust = async () => {
    if (!item) return;
    if (!adjustQty || Number(adjustQty) <= 0) { toast.error('Enter a valid quantity'); return; }

    setAdjusting(true);
    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          adjustmentType: adjustType,
          quantity: Number(adjustQty),
          reason: adjustReason,
          notes: adjustNotes.trim() || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        const msg = result.data?.requiresApproval
          ? 'Adjustment submitted for approval'
          : 'Stock adjusted';
        toast.success(msg);
        setShowStockAdjust(false);
        setAdjustQty('');
        setAdjustNotes('');
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(result.message || 'Failed to adjust stock');
      }
    } catch {
      toast.error('Failed to adjust stock');
    } finally {
      setAdjusting(false);
    }
  };

  if (!item) return null;

  const trendCfg = TREND_CONFIG[item.trend];
  const TrendIcon = trendCfg.icon;
  const formatCurrency = (n: number) => `KES ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[480px] md:!w-[520px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header */}
        <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 px-5 py-4 space-y-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${trendCfg.bg}`}>
                <TrendIcon className={`w-5 h-5 ${trendCfg.color}`} />
              </div>
              <div className="min-w-0">
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {item.name}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                  {item.category_name || 'Uncategorized'}
                  {item.variant_name && <><span className="text-slate-300">·</span> {item.variant_name}</>}
                </DrawerDescription>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Quick stats */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex-1 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Stock</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {item.current_stock <= 0 ? '0' : item.current_stock.toLocaleString('en-KE', { maximumFractionDigits: 1 })}
                <span className="text-xs text-slate-400 ml-1 font-medium">{item.unit_type}</span>
              </p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Value</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(item.stock_value || 0)}</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Trend</p>
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${trendCfg.bg}`}>
                <TrendIcon className={`w-3 h-3 ${trendCfg.color}`} />
                <span className={`text-xs font-semibold ${trendCfg.color}`}>
                  {item.stock_change_percent !== null ? `${item.stock_change_percent >= 0 ? '+' : ''}${item.stock_change_percent.toFixed(0)}%` : trendCfg.label}
                </span>
              </div>
            </div>
          </div>
        </DrawerHeader>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">

            {/* ── Stock Adjustment Section ── */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setShowStockAdjust(!showStockAdjust)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#1c6a1e]" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Adjust Stock</span>
                  <span className="text-xs text-slate-400">Current: {item.current_stock.toLocaleString('en-KE', { maximumFractionDigits: 1 })} {item.unit_type}</span>
                </div>
                {showStockAdjust ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showStockAdjust && (
                <div className="p-4 space-y-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setAdjustType('increase')}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        adjustType === 'increase'
                          ? 'bg-[#1c6a1e] text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      Add Stock
                    </button>
                    <button
                      onClick={() => setAdjustType('decrease')}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        adjustType === 'decrease'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <TrendingDown className="w-4 h-4" />
                      Remove Stock
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">Quantity</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={adjustQty}
                        onChange={e => setAdjustQty(e.target.value)}
                        placeholder="0"
                        className="h-10 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">Reason</Label>
                      <Select value={adjustReason} onValueChange={v => setAdjustReason(v as AdjustmentReason)}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ADJUSTMENT_REASONS.map(r => (
                            <SelectItem key={r} value={r}>{REASON_LABELS[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Notes (optional)</Label>
                    <Textarea
                      value={adjustNotes}
                      onChange={e => setAdjustNotes(e.target.value)}
                      placeholder="Add a note..."
                      className="h-16 text-sm resize-none"
                    />
                  </div>
                  {adjustQty && Number(adjustQty) > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs">
                      <span className="text-slate-500">New stock:</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {Math.max(0, adjustType === 'increase'
                          ? item.current_stock + Number(adjustQty)
                          : item.current_stock - Number(adjustQty)
                        ).toLocaleString('en-KE', { maximumFractionDigits: 1 })}
                      </span>
                      <span className="text-slate-400">{item.unit_type}</span>
                    </div>
                  )}
                  <Button
                    onClick={handleStockAdjust}
                    disabled={adjusting || !adjustQty || Number(adjustQty) <= 0}
                    className={`w-full h-10 font-semibold ${
                      adjustType === 'increase'
                        ? 'bg-[#1c6a1e] hover:bg-[#2a8a30] text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {adjusting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {adjustType === 'increase' ? 'Add' : 'Remove'} {adjustQty || '0'} {item.unit_type}
                  </Button>
                </div>
              )}
            </div>

            {/* ── Item Details Form ── */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Item Details</h3>

              <div className="space-y-3">
                {/* Name */}
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="h-10 text-sm" />
                </div>

                {/* Variant name (if applicable) */}
                {item.parent_item_id && (
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Variant Name</Label>
                    <Input value={variantName} onChange={e => setVariantName(e.target.value)} placeholder="e.g. Small, Large, Red" className="h-10 text-sm" />
                  </div>
                )}

                {/* Category + Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Category</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.filter(c => c.active).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Item Type</Label>
                    <Select value={itemType} onValueChange={setItemType}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(itemTypes.length > 0 ? itemTypes : ['retail', 'grocery']).map(t => (
                          <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Unit type + Min stock */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Unit Type</Label>
                    <Select value={unitType} onValueChange={setUnitType}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_TYPES.map(u => (
                          <SelectItem key={u} value={u}>{UNIT_LABELS[u] || u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Min Stock Level</Label>
                    <Input type="number" step="any" min="0" value={minStockLevel} onChange={e => setMinStockLevel(e.target.value)} placeholder="—" className="h-10 text-sm" />
                  </div>
                </div>

                {/* Prices */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Sell Price (KES)</Label>
                    <Input type="number" step="any" min="0" value={sellPrice} onChange={e => setSellPrice(e.target.value)} className="h-10 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">
                      Buy Price (KES)
                      {loadingDetail && <Loader2 className="w-3 h-3 ml-1 inline animate-spin" />}
                    </Label>
                    <Input type="number" step="any" min="0" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="—" className="h-10 text-sm" />
                  </div>
                </div>

                {/* Advanced fields toggle */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors pt-1"
                >
                  {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showAdvanced ? 'Hide' : 'Show'} advanced fields
                </button>

                {showAdvanced && (
                  <div className="space-y-3 pt-1 animate-in slide-in-from-top-1 duration-200">
                    {/* Barcode + Product Code */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500 mb-1 block">Barcode</Label>
                        <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="EAN-13, UPC..." className="h-10 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1 block">Product Code</Label>
                        <Input value={productCode} onChange={e => setProductCode(e.target.value)} placeholder="e.g. TOM" maxLength={5} className="h-10 text-sm" />
                      </div>
                    </div>
                    {/* Aisle */}
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">Aisle / Location</Label>
                      <Input value={aisleNumber} onChange={e => setAisleNumber(e.target.value)} placeholder="e.g. A3, Produce" className="h-10 text-sm" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveDetails}
              disabled={saving}
              className="flex-1 h-10 text-sm bg-[#1c6a1e] hover:bg-[#2a8a30] text-white font-semibold"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
