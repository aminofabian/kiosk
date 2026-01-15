import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnitType } from '@/lib/constants';

export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  unitType: UnitType | 'bundle';
  // Bundle-specific fields
  isBundle?: boolean;
  bundleQuantity?: number; // Number of items in each bundle
}

// Generate a unique cart key for an item (differentiates bundles from regular)
const getCartKey = (item: { itemId: string; isBundle?: boolean }): string => {
  return item.isBundle ? `${item.itemId}:bundle` : item.itemId;
};

interface CartStore {
  items: CartItem[];
  total: number;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  updateQuantity: (itemId: string, quantity: number, isBundle?: boolean) => void;
  removeItem: (itemId: string, isBundle?: boolean) => void;
  clearCart: () => void;
}

const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      total: 0,
      
      addItem: (item, quantity) => {
        set((state) => {
          // Find existing item with same itemId AND same type (bundle vs regular)
          const existingItemIndex = state.items.findIndex(
            (i) => i.itemId === item.itemId && Boolean(i.isBundle) === Boolean(item.isBundle)
          );
          
          let newItems: CartItem[];
          if (existingItemIndex >= 0) {
            // Update existing item quantity
            newItems = state.items.map((i, idx) =>
              idx === existingItemIndex
                ? { ...i, quantity: i.quantity + quantity }
                : i
            );
          } else {
            // Add new item
            newItems = [...state.items, { ...item, quantity }];
          }
          
          return {
            items: newItems,
            total: calculateTotal(newItems),
          };
        });
      },
      
      updateQuantity: (itemId, quantity, isBundle = false) => {
        set((state) => {
          if (quantity <= 0) {
            // Remove item if quantity is 0 or less
            const newItems = state.items.filter(
              (i) => !(i.itemId === itemId && Boolean(i.isBundle) === isBundle)
            );
            return {
              items: newItems,
              total: calculateTotal(newItems),
            };
          }
          
          const newItems = state.items.map((i) =>
            i.itemId === itemId && Boolean(i.isBundle) === isBundle 
              ? { ...i, quantity } 
              : i
          );
          
          return {
            items: newItems,
            total: calculateTotal(newItems),
          };
        });
      },
      
      removeItem: (itemId, isBundle = false) => {
        set((state) => {
          const newItems = state.items.filter(
            (i) => !(i.itemId === itemId && Boolean(i.isBundle) === isBundle)
          );
          return {
            items: newItems,
            total: calculateTotal(newItems),
          };
        });
      },
      
      clearCart: () => {
        set({
          items: [],
          total: 0,
        });
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);

