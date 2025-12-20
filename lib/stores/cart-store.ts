import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnitType } from '@/lib/constants';

export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  unitType: UnitType;
}

interface CartStore {
  items: CartItem[];
  total: number;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
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
          const existingItemIndex = state.items.findIndex(
            (i) => i.itemId === item.itemId
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
      
      updateQuantity: (itemId, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            // Remove item if quantity is 0 or less
            const newItems = state.items.filter((i) => i.itemId !== itemId);
            return {
              items: newItems,
              total: calculateTotal(newItems),
            };
          }
          
          const newItems = state.items.map((i) =>
            i.itemId === itemId ? { ...i, quantity } : i
          );
          
          return {
            items: newItems,
            total: calculateTotal(newItems),
          };
        });
      },
      
      removeItem: (itemId) => {
        set((state) => {
          const newItems = state.items.filter((i) => i.itemId !== itemId);
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

