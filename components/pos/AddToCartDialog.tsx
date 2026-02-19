'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Minus, Plus, ShoppingCart, X, Package, Tag, Edit2 } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cart-store';
import type { Item } from '@/lib/db/types';
import { getItemImage } from '@/lib/utils/item-images';
import { Badge } from '@/components/ui/badge';

type PurchaseMode = 'regular' | 'bundle';
type PortionSize = 'full' | 'half' | 'quarter' | 'eighth' | 'tenth' | 'twentieth' | 'custom';

interface AddToCartDialogProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToCartDialog({
  item,
  open,
  onOpenChange,
}: AddToCartDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [bundleCount, setBundleCount] = useState(1);
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>('regular');
  const [manualPrice, setManualPrice] = useState<number | null>(null);
  const [useManualPrice, setUseManualPrice] = useState(false);
  const [portion, setPortion] = useState<PortionSize>('full');
  const { addItem, items: cartItems } = useCartStore();

  // Check if item has bundle pricing
  const hasBundle = item && item.bundle_quantity && item.bundle_price && item.bundle_quantity > 0 && item.bundle_price > 0;

  useEffect(() => {
    if (open && item) {
      // Reset to regular mode when opening
      setPurchaseMode('regular');
      setBundleCount(1);
      setManualPrice(null);
      setUseManualPrice(false);
      
      const existingItem = cartItems.find((i) => i.itemId === item.id && !i.isBundle);
      if (existingItem) {
        setQuantity(existingItem.quantity);
      } else {
        setQuantity(1);
      }
      setPortion('full');
    }
  }, [open, item, cartItems]);

  // Update manual price when purchase mode changes (if manual price is enabled)
  useEffect(() => {
    if (useManualPrice && item) {
      const newPrice = purchaseMode === 'bundle' && hasBundle
        ? item.bundle_price!
        : item.current_sell_price;
      setManualPrice(newPrice);
    }
  }, [purchaseMode, hasBundle, useManualPrice, item]);

  if (!item) return null;

  const handleAddToCart = () => {
    if (purchaseMode === 'bundle' && hasBundle && bundleCount > 0) {
      // Add as bundle
      const bundlePrice = useManualPrice && manualPrice !== null 
        ? manualPrice 
        : item.bundle_price!;
      addItem(
        {
          itemId: item.id,
          name: item.bundle_name || `${item.name} (${item.bundle_quantity} for ${bundlePrice})`,
          price: bundlePrice,
          unitType: 'bundle',
          isBundle: true,
          bundleQuantity: item.bundle_quantity!,
        },
        bundleCount
      );
      onOpenChange(false);
    } else if (quantity > 0) {
      // Regular add - use manual price if set, otherwise use default price
      const finalPrice = useManualPrice && manualPrice !== null 
        ? manualPrice 
        : item.current_sell_price;
      addItem(
        {
          itemId: item.id,
          name: item.name,
          price: finalPrice,
          unitType: item.unit_type,
        },
        quantity
      );
      onOpenChange(false);
    }
  };

  // Calculate subtotal - use manual price if enabled, otherwise use default
  const currentPrice = useManualPrice && manualPrice !== null 
    ? manualPrice 
    : (purchaseMode === 'bundle' && hasBundle 
        ? item.bundle_price! 
        : item.current_sell_price);
  const subtotal = currentPrice * (purchaseMode === 'bundle' && hasBundle ? bundleCount : quantity);
  
  // Calculate bundle savings - use manual price if set
  const bundlePriceToUse = purchaseMode === 'bundle' && useManualPrice && manualPrice !== null
    ? manualPrice
    : (hasBundle ? item.bundle_price! : 0);
  const regularPriceForBundle = hasBundle 
    ? item.current_sell_price * item.bundle_quantity! * bundleCount 
    : 0;
  const bundleSavings = hasBundle ? regularPriceForBundle - (bundlePriceToUse * bundleCount) : 0;
  
  const formatPrice = (price: number) => `KES ${price.toFixed(0)}`;
  
  // Calculate quantity already in cart for this item (excluding bundles)
  const quantityInCart = cartItems
    .filter((i) => i.itemId === item.id && !i.isBundle)
    .reduce((sum, i) => sum + i.quantity, 0);
  
  // Calculate remaining stock (for display only, not for restrictions)
  const remainingStock = Math.max(0, item.current_stock - quantityInCart);
  
  const isOutOfStock = remainingStock <= 0;
  // Remove maxQuantity restriction - allow any quantity
  const isWeight = item.unit_type === 'kg' || item.unit_type === 'g';
  const step = isWeight ? 0.05 : 1;

  const handleIncrement = () => {
    const newValue = quantity + step;
    setQuantity(Number(newValue.toFixed(isWeight ? 2 : 0)));
    setPortion('custom');
  };

  const handleDecrement = () => {
    const newValue = quantity - step;
    if (newValue >= 0) {
      setQuantity(Number(newValue.toFixed(isWeight ? 2 : 0)));
      setPortion('custom');
    }
  };

  const handleQuantityChange = (value: string) => {
    if (value === '' || value === '.') {
      setQuantity(0);
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return;
    }

    if (numValue < 0) {
      setQuantity(0);
      return;
    }

    // Preserve fractional quantities for all items - portion buttons (½, ¼, etc.) allow
    // selling portions of piece/bunch items (e.g. half cabbage), so we must not floor.
    const fixedValue = parseFloat(numValue.toFixed(2));
    setQuantity(fixedValue);
    setPortion('custom');
  };

  const handleManualPriceChange = (value: string) => {
    if (value === '' || value === '.') {
      setManualPrice(null);
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return;
    }

    if (numValue < 0) {
      setManualPrice(0);
      return;
    }

    setManualPrice(numValue);
  };

  const handleQuantityBlur = () => {
    if (quantity <= 0) {
      setQuantity(1);
      setPortion('full');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-white dark:bg-gray-900 rounded-3xl pb-6">
          <div className="relative px-6 pt-6">
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-0 right-0 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>

            <div className="flex flex-col items-center pt-8 pb-4">
              <div className="w-20 h-20 rounded-full bg-[#1c6a1e]/20 dark:bg-[#1c6a1e]/10 flex items-center justify-center mb-4 overflow-hidden">
                {getItemImage(item.name) ? (
                  <img
                    src={getItemImage(item.name)!}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-full"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = '<svg class="w-10 h-10 text-[#1c6a1e]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>';
                      }
                    }}
                  />
                ) : (
                  <Package className="w-10 h-10 text-[#1c6a1e]" />
                )}
              </div>
              <DialogTitle className="text-2xl font-bold uppercase text-gray-900 dark:text-gray-100 mb-3 text-center">
                {item.name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {formatPrice(useManualPrice && manualPrice !== null ? manualPrice : item.current_sell_price)} / {item.unit_type}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setUseManualPrice(!useManualPrice);
                    if (!useManualPrice && manualPrice === null) {
                      // Initialize with current price based on purchase mode
                      const initialPrice = purchaseMode === 'bundle' && hasBundle
                        ? item.bundle_price!
                        : item.current_sell_price;
                      setManualPrice(initialPrice);
                    }
                  }}
                  className={`p-1.5 rounded-full transition-colors ${
                    useManualPrice
                      ? 'bg-[#1c6a1e] text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={useManualPrice ? 'Using manual price' : 'Edit price'}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {useManualPrice && (
                <div className="mt-2 w-full max-w-xs">
                  <Label htmlFor="manual-price" className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                    Manual Price (KES)
                  </Label>
                  <Input
                    id="manual-price"
                    type="number"
                    value={manualPrice !== null ? manualPrice.toFixed(0) : ''}
                    onChange={(e) => handleManualPriceChange(e.target.value)}
                    min="0"
                    step="1"
                    className="h-10 text-center font-semibold"
                    placeholder={item.current_sell_price.toFixed(0)}
                    autoFocus
                  />
                </div>
              )}
              <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full border ${
                remainingStock > 0 
                  ? 'bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 border-[#1c6a1e]/30 dark:border-[#1c6a1e]/50' 
                  : 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'
              }`}>
                <Package className={`w-3.5 h-3.5 mr-1.5 ${
                  remainingStock > 0 
                    ? 'text-[#1c6a1e] dark:text-[#2a8a30]' 
                    : 'text-red-600 dark:text-red-400'
                }`} />
                <span className={`text-sm font-medium ${
                  remainingStock > 0 
                    ? 'text-[#1c6a1e] dark:text-[#2a8a30]' 
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {remainingStock > 0 ? (
                    <>Remaining: {remainingStock.toFixed(isWeight ? 2 : 0)} {item.unit_type}</>
                  ) : (
                    <>Out of Stock</>
                  )}
                </span>
              </div>
              {hasBundle && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
                  <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {item.bundle_name || `${item.bundle_quantity} for ${formatPrice(item.bundle_price!)}`}
                  </span>
                </div>
              )}
            </div>

            {/* Purchase Mode Toggle (only show if bundle available) */}
            {hasBundle && (
              <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button
                  onClick={() => setPurchaseMode('regular')}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                    purchaseMode === 'regular'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Regular Price
                </button>
                <button
                  onClick={() => setPurchaseMode('bundle')}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    purchaseMode === 'bundle'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  Bundle Deal
                </button>
              </div>
            )}

            {/* Bundle Mode Quantity Selector */}
            {purchaseMode === 'bundle' && hasBundle ? (
              <div className="mb-6">
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                  How many bundles?
                </p>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button
                    onClick={() => setBundleCount(Math.max(1, bundleCount - 1))}
                    disabled={bundleCount <= 1}
                    className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Minus className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                  </button>
                  <div className="flex flex-col items-center">
                    <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                      {bundleCount}
                    </span>
                    <span className="text-sm text-amber-600 dark:text-amber-400 font-medium mt-1">
                      {bundleCount === 1 ? 'bundle' : 'bundles'}
                    </span>
                  </div>
                  <button
                    onClick={() => setBundleCount(bundleCount + 1)}
                    className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center hover:bg-amber-600 transition-colors"
                  >
                    <Plus className="w-6 h-6 text-white" />
                  </button>
                </div>
                
                {/* Bundle quick select */}
                <div className="flex gap-2 justify-center mb-4">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      onClick={() => setBundleCount(num)}
                      className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
                        bundleCount === num
                          ? 'bg-amber-500 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                    {bundleCount} × ({item.bundle_quantity} {item.unit_type}) = {bundleCount * item.bundle_quantity!} {item.unit_type} total
                  </p>
                </div>
              </div>
            ) : (
              /* Regular Mode Quantity Selector */
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={handleDecrement}
                    disabled={quantity <= 0}
                    className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Minus className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                  </button>
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      value={quantity.toFixed(isWeight ? 2 : 0)}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      onBlur={handleQuantityBlur}
                      min="0"
                      step={step}
                      className="text-4xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none text-center w-32 focus:ring-2 focus:ring-[#1c6a1e] rounded-lg px-2 py-1"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400 uppercase mt-1">
                      {item.unit_type}
                    </span>
                  </div>
                  <button
                    onClick={handleIncrement}
                    className="w-12 h-12 rounded-full bg-[#1c6a1e] flex items-center justify-center hover:bg-[#2a8a30] transition-colors"
                  >
                    <Plus className="w-6 h-6 text-white" />
                  </button>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Choose portion
                  </p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        const target = 0.05;
                        setQuantity(target);
                        setPortion('twentieth');
                      }}
                      className={`w-12 px-0 py-1.5 rounded-full text-[10px] font-semibold flex items-center justify-center transition-all border ${
                        portion === 'twentieth'
                          ? 'bg-[#1c6a1e] text-white border-[#1c6a1e] shadow-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      1/20
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = 0.125;
                        setQuantity(target);
                        setPortion('eighth');
                      }}
                      className={`w-12 px-0 py-1.5 rounded-full text-sm font-semibold flex items-center justify-center transition-all border ${
                        portion === 'eighth'
                          ? 'bg-[#1c6a1e] text-white border-[#1c6a1e] shadow-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      ⅛
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = 0.1;
                        setQuantity(target);
                        setPortion('tenth');
                      }}
                      className={`w-12 px-0 py-1.5 rounded-full text-[10px] font-semibold flex items-center justify-center transition-all border ${
                        portion === 'tenth'
                          ? 'bg-[#1c6a1e] text-white border-[#1c6a1e] shadow-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      1/10
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = 0.25;
                        setQuantity(target);
                        setPortion('quarter');
                      }}
                      className={`w-12 px-0 py-1.5 rounded-full text-sm font-semibold flex items-center justify-center transition-all border ${
                        portion === 'quarter'
                          ? 'bg-[#1c6a1e] text-white border-[#1c6a1e] shadow-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      ¼
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = 0.5;
                        setQuantity(target);
                        setPortion('half');
                      }}
                      className={`w-12 px-0 py-1.5 rounded-full text-sm font-semibold flex items-center justify-center transition-all border ${
                        portion === 'half'
                          ? 'bg-[#1c6a1e] text-white border-[#1c6a1e] shadow-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      ½
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = 1;
                        setQuantity(target);
                        setPortion('full');
                      }}
                      className={`w-12 px-0 py-1.5 rounded-full text-sm font-semibold flex items-center justify-center transition-all border ${
                        portion === 'full'
                          ? 'bg-[#1c6a1e] text-white border-[#1c6a1e] shadow-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      1
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Subtotal */}
            <div className="mb-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Subtotal
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {formatPrice(subtotal)}
                </p>
                {purchaseMode === 'bundle' && bundleSavings > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
                    <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                      You save {formatPrice(bundleSavings)}!
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleAddToCart}
              disabled={quantity <= 0 || (useManualPrice && (manualPrice === null || manualPrice < 0))}
              className="w-full h-14 pos-btn-primary rounded-2xl flex items-center justify-center gap-2 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>ADD TO CART</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

