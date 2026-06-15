'use client';

import { useState } from 'react';
import { Loader2, Minus, Plus, Save, Send, ShoppingCart, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/lib/stores/cart-store';
import { QuantityInput } from '@/components/pos/QuantityInput';
import type { UnitType } from '@/lib/constants';

const getCartItemKey = (item: {
  itemId: string;
  isBundle?: boolean;
  inventoryBatchId?: string;
}): string => {
  if (item.isBundle) return `${item.itemId}:bundle`;
  if (item.inventoryBatchId) return `${item.itemId}:batch:${item.inventoryBatchId}`;
  return item.itemId;
};

const isValidUnitType = (unitType: UnitType | 'bundle'): unitType is UnitType =>
  unitType !== 'bundle';

interface DepartmentOrderPanelProps {
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  onSaveDraft: () => void;
  onForward: () => void;
  submitting?: boolean;
  layout?: 'column' | 'mobile';
}

export function DepartmentOrderPanel({
  customerName,
  onCustomerNameChange,
  onSaveDraft,
  onForward,
  submitting = false,
  layout = 'column',
}: DepartmentOrderPanelProps) {
  const { updateQuantity, removeItem, clearCart, carts, activeCartId } = useCartStore();
  const [clearConfirm, setClearConfirm] = useState(false);

  const activeCart = carts.find((c) => c.id === activeCartId) || carts[0];
  const cartItems = activeCart?.items || [];
  const cartTotal = activeCart?.total || 0;
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const isColumn = layout === 'column';

  const formatPrice = (price: number) => `KES ${price.toFixed(0)}`;

  if (cartItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <ShoppingCart className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">
            Order is empty
          </h2>
          <p className="text-sm text-slate-400">Tap items to add them to the order</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex-1 overflow-auto ${isColumn ? 'px-1.5 py-1' : 'p-3'}`}>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {cartItems.map((item) => (
            <div
              key={getCartItemKey(item)}
              className={`py-2 px-1.5 ${
                item.isBundle ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1">
                    <p className="text-[11px] font-semibold text-slate-900 dark:text-white uppercase leading-snug break-words">
                      {item.name}
                    </p>
                    {item.isBundle && (
                      <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[8px] px-1 py-0 h-3.5 shrink-0">
                        B
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5 break-words">
                    {formatPrice(item.price)}/{item.isBundle ? 'bdl' : item.unitType}
                  </p>
                </div>
                <p
                  className={`text-[11px] font-bold tabular-nums leading-tight shrink-0 ${
                    item.isBundle ? 'text-amber-600 dark:text-amber-400' : 'text-[#1c6a1e]'
                  }`}
                >
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
              <div className="flex items-center justify-end gap-1">
                {item.isBundle ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.itemId, item.quantity - 1, true)}
                      disabled={item.quantity <= 1}
                      className="h-6 w-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-30"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-[11px] font-bold text-slate-900 dark:text-white tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.itemId, item.quantity + 1, true)}
                      className="h-6 w-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-slate-500"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                ) : isValidUnitType(item.unitType) ? (
                  <QuantityInput
                    unitType={item.unitType}
                    value={item.quantity}
                    onChange={(newQuantity) =>
                      updateQuantity(item.itemId, newQuantity, false, item.inventoryBatchId)
                    }
                    min={0}
                    compact
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => removeItem(item.itemId, item.isBundle, item.inventoryBatchId)}
                  className="h-6 w-6 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          <Input
            type="text"
            placeholder="Customer name (optional)"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {cartCount} {cartCount === 1 ? 'item' : 'items'}
          </span>
          <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            {formatPrice(cartTotal)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={submitting}
            className="h-11 font-semibold"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={onForward}
            disabled={submitting}
            className="h-11 bg-[#1c6a1e] hover:bg-[#155a17] text-white font-semibold"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Forward
              </>
            )}
          </Button>
        </div>
        {clearConfirm ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setClearConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => {
                clearCart();
                onCustomerNameChange('');
                setClearConfirm(false);
              }}
            >
              Clear order
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setClearConfirm(true)}
            className="w-full text-center text-xs text-slate-400 hover:text-red-500 py-1 transition-colors"
          >
            Clear order
          </button>
        )}
      </div>
    </div>
  );
}
