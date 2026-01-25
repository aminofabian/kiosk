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

export interface Cart {
  id: string;
  name: string;
  items: CartItem[];
  total: number;
  createdAt: number;
}

// Generate a unique cart key for an item (differentiates bundles from regular)
const getCartKey = (item: { itemId: string; isBundle?: boolean }): string => {
  return item.isBundle ? `${item.itemId}:bundle` : item.itemId;
};

const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

const generateCartId = (): string => {
  return `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateCartName = (carts: Cart[]): string => {
  const cartNumbers = carts
    .map(c => {
      const match = c.name.match(/^Cart (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);
  
  const maxNumber = cartNumbers.length > 0 ? Math.max(...cartNumbers) : 0;
  return `Cart ${maxNumber + 1}`;
};

interface CartStore {
  // Multi-cart state
  carts: Cart[];
  activeCartId: string | null;
  
  // Computed getters for backward compatibility
  items: CartItem[];
  total: number;
  
  // Cart management
  createCart: () => string;
  switchCart: (cartId: string) => void;
  deleteCart: (cartId: string) => void;
  renameCart: (cartId: string, name: string) => void;
  
  // Item operations (operate on active cart)
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  updateQuantity: (itemId: string, quantity: number, isBundle?: boolean) => void;
  removeItem: (itemId: string, isBundle?: boolean) => void;
  clearCart: () => void;
}

const createEmptyCart = (name: string): Cart => ({
  id: generateCartId(),
  name,
  items: [],
  total: 0,
  createdAt: Date.now(),
});

// Helper to get active cart items
const getActiveCartItems = (state: { carts: Cart[]; activeCartId: string | null }): CartItem[] => {
  const activeCart = state.carts.find(c => c.id === state.activeCartId);
  if (!activeCart && state.carts.length > 0) {
    return state.carts[0].items;
  }
  return activeCart?.items || [];
};

// Helper to get active cart total
const getActiveCartTotal = (state: { carts: Cart[]; activeCartId: string | null }): number => {
  const activeCart = state.carts.find(c => c.id === state.activeCartId);
  if (!activeCart && state.carts.length > 0) {
    return state.carts[0].total;
  }
  return activeCart?.total || 0;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      carts: [createEmptyCart('Cart 1')],
      activeCartId: null, // Will be set on first access
      
      // Computed items - returns active cart's items (reactive)
      get items() {
        return getActiveCartItems(get());
      },
      
      // Computed total - returns active cart's total (reactive)
      get total() {
        return getActiveCartTotal(get());
      },
      
      createCart: () => {
        const state = get();
        const newCart = createEmptyCart(generateCartName(state.carts));
        set({
          carts: [...state.carts, newCart],
          activeCartId: newCart.id,
        });
        return newCart.id;
      },
      
      switchCart: (cartId) => {
        const state = get();
        if (state.carts.some(c => c.id === cartId)) {
          set({ activeCartId: cartId });
        }
      },
      
      deleteCart: (cartId) => {
        const state = get();
        const remainingCarts = state.carts.filter(c => c.id !== cartId);
        
        // Ensure at least one cart exists
        if (remainingCarts.length === 0) {
          const newCart = createEmptyCart('Cart 1');
          set({
            carts: [newCart],
            activeCartId: newCart.id,
          });
          return;
        }
        
        // If deleting active cart, switch to another
        let newActiveId = state.activeCartId;
        if (state.activeCartId === cartId) {
          newActiveId = remainingCarts[0].id;
        }
        
        set({
          carts: remainingCarts,
          activeCartId: newActiveId,
        });
      },
      
      renameCart: (cartId, name) => {
        set((state) => ({
          carts: state.carts.map(c =>
            c.id === cartId ? { ...c, name } : c
          ),
        }));
      },
      
      addItem: (item, quantity) => {
        set((state) => {
          let activeCartId = state.activeCartId;
          
          // Ensure we have an active cart
          if (!activeCartId && state.carts.length > 0) {
            activeCartId = state.carts[0].id;
          }
          
          if (!activeCartId) {
            // Create a new cart if none exists
            const newCart = createEmptyCart('Cart 1');
            activeCartId = newCart.id;
            return {
              carts: [{ ...newCart, items: [{ ...item, quantity }], total: item.price * quantity }],
              activeCartId,
            };
          }
          
          const updatedCarts = state.carts.map(cart => {
            if (cart.id !== activeCartId) return cart;
            
            // Find existing item with same itemId AND same type (bundle vs regular)
            const existingItemIndex = cart.items.findIndex(
              (i) => i.itemId === item.itemId && Boolean(i.isBundle) === Boolean(item.isBundle)
            );
            
            let newItems: CartItem[];
            if (existingItemIndex >= 0) {
              // Update existing item quantity
              newItems = cart.items.map((i, idx) =>
                idx === existingItemIndex
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              );
            } else {
              // Add new item
              newItems = [...cart.items, { ...item, quantity }];
            }
            
            return {
              ...cart,
              items: newItems,
              total: calculateTotal(newItems),
            };
          });
          
          return { carts: updatedCarts, activeCartId };
        });
      },
      
      updateQuantity: (itemId, quantity, isBundle = false) => {
        set((state) => {
          const activeCartId = state.activeCartId || state.carts[0]?.id;
          if (!activeCartId) return state;
          
          const updatedCarts = state.carts.map(cart => {
            if (cart.id !== activeCartId) return cart;
            
            if (quantity <= 0) {
              // Remove item if quantity is 0 or less
              const newItems = cart.items.filter(
                (i) => !(i.itemId === itemId && Boolean(i.isBundle) === isBundle)
              );
              return {
                ...cart,
                items: newItems,
                total: calculateTotal(newItems),
              };
            }
            
            const newItems = cart.items.map((i) =>
              i.itemId === itemId && Boolean(i.isBundle) === isBundle
                ? { ...i, quantity }
                : i
            );
            
            return {
              ...cart,
              items: newItems,
              total: calculateTotal(newItems),
            };
          });
          
          return { carts: updatedCarts };
        });
      },
      
      removeItem: (itemId, isBundle = false) => {
        set((state) => {
          const activeCartId = state.activeCartId || state.carts[0]?.id;
          if (!activeCartId) return state;
          
          const updatedCarts = state.carts.map(cart => {
            if (cart.id !== activeCartId) return cart;
            
            const newItems = cart.items.filter(
              (i) => !(i.itemId === itemId && Boolean(i.isBundle) === isBundle)
            );
            return {
              ...cart,
              items: newItems,
              total: calculateTotal(newItems),
            };
          });
          
          return { carts: updatedCarts };
        });
      },
      
      clearCart: () => {
        set((state) => {
          const activeCartId = state.activeCartId || state.carts[0]?.id;
          if (!activeCartId) return state;
          
          const updatedCarts = state.carts.map(cart => {
            if (cart.id !== activeCartId) return cart;
            return {
              ...cart,
              items: [],
              total: 0,
            };
          });
          
          return { carts: updatedCarts };
        });
      },
    }),
    {
      name: 'cart-storage',
      // Migration to handle existing single-cart data
      migrate: (persistedState: any, version: number) => {
        if (persistedState && !persistedState.carts) {
          // Migrate from old single-cart format
          const oldItems = persistedState.items || [];
          const oldTotal = persistedState.total || 0;
          const newCart: Cart = {
            id: generateCartId(),
            name: 'Cart 1',
            items: oldItems,
            total: oldTotal,
            createdAt: Date.now(),
          };
          return {
            carts: [newCart],
            activeCartId: newCart.id,
          };
        }
        return persistedState;
      },
      version: 1,
    }
  )
);

// Selector hooks for reactive access to computed values
export const useCartItems = () => useCartStore((state) => {
  const activeCart = state.carts.find(c => c.id === state.activeCartId) || state.carts[0];
  return activeCart?.items || [];
});

export const useCartTotal = () => useCartStore((state) => {
  const activeCart = state.carts.find(c => c.id === state.activeCartId) || state.carts[0];
  return activeCart?.total || 0;
});

export const useActiveCart = () => useCartStore((state) => {
  return state.carts.find(c => c.id === state.activeCartId) || state.carts[0];
});
