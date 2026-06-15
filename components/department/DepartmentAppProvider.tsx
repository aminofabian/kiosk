'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { signOut } from 'next-auth/react';
import { useCartStore } from '@/lib/stores/cart-store';
import { useDepartmentTypes } from '@/lib/hooks/use-department-types';
import { apiPost } from '@/lib/utils/api-client';
import { resolveDepartmentShopType, SHOP_TYPE_ALL } from '@/lib/utils/shop-type';
import { toast } from 'sonner';
import { DepartmentMobileMoreSheet } from '@/components/department/DepartmentMobileMoreSheet';

interface DepartmentAppContextValue {
  assignedTypes: string[];
  shopType: string;
  setShopType: (type: string) => void;
  customerName: string;
  setCustomerName: Dispatch<SetStateAction<string>>;
  submitting: boolean;
  submitOrder: (forwarded: boolean) => Promise<void>;
  cartItemCount: number;
  moreSheetOpen: boolean;
  setMoreSheetOpen: (open: boolean) => void;
  businessName?: string;
  userName?: string;
  userId?: string;
}

const DepartmentAppContext = createContext<DepartmentAppContextValue | null>(null);

export function useDepartmentApp() {
  const ctx = useContext(DepartmentAppContext);
  if (!ctx) {
    throw new Error('useDepartmentApp must be used within DepartmentAppProvider');
  }
  return ctx;
}

export function DepartmentAppProvider({ children }: { children: ReactNode }) {
  const { assignedTypes, user } = useDepartmentTypes();
  const { clearCart, carts, activeCartId } = useCartStore();

  const [shopType, setShopTypeState] = useState(() =>
    resolveDepartmentShopType(assignedTypes),
  );
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  useEffect(() => {
    setShopTypeState(resolveDepartmentShopType(assignedTypes));
  }, [assignedTypes]);

  const activeCart = carts.find((c) => c.id === activeCartId) || carts[0];
  const cartItemCount = (activeCart?.items || []).reduce((sum, item) => sum + item.quantity, 0);

  const setShopType = useCallback(
    (newShopType: string) => {
      if (assignedTypes.length === 1) return;
      if (
        assignedTypes.length > 0 &&
        newShopType !== SHOP_TYPE_ALL &&
        !assignedTypes.includes(newShopType)
      ) {
        return;
      }
      setShopTypeState(newShopType);
    },
    [assignedTypes],
  );

  const submitOrder = useCallback(
    async (forwarded: boolean) => {
      const items = activeCart?.items || [];
      if (items.length === 0) {
        toast.error('Add items to the order first');
        return;
      }
      setSubmitting(true);
      try {
        const payload = {
          items: items.map((l) => ({
            itemId: l.itemId,
            name: l.name,
            price: l.price,
            quantity: l.quantity,
          })),
          customerName: customerName.trim() || null,
          originatedByUserId: user?.id,
        };

        const result = await apiPost<{ pendingSaleId: string }>('/api/sales/pending', payload);

        if (result.success) {
          toast.success(
            forwarded ? 'Order forwarded to cashier!' : 'Draft saved successfully',
          );
          clearCart();
          setCustomerName('');
        } else {
          toast.error(result.message || 'Failed to save order');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setSubmitting(false);
      }
    },
    [activeCart?.items, customerName, user?.id, clearCart],
  );

  const value = useMemo(
    () => ({
      assignedTypes,
      shopType,
      setShopType,
      customerName,
      setCustomerName,
      submitting,
      submitOrder,
      cartItemCount,
      moreSheetOpen,
      setMoreSheetOpen,
      businessName: user?.businessName,
      userName: user?.name,
      userId: user?.id,
    }),
    [
      assignedTypes,
      shopType,
      setShopType,
      customerName,
      submitting,
      submitOrder,
      cartItemCount,
      moreSheetOpen,
      user?.businessName,
      user?.name,
      user?.id,
    ],
  );

  return (
    <DepartmentAppContext.Provider value={value}>
      {children}
      <DepartmentMobileMoreSheet
        open={moreSheetOpen}
        onOpenChange={setMoreSheetOpen}
        businessName={user?.businessName ?? undefined}
        userName={user?.name ?? undefined}
        deptTypes={assignedTypes}
        onShopTypeChange={setShopType}
        onLogout={() => signOut({ callbackUrl: '/login' })}
      />
    </DepartmentAppContext.Provider>
  );
}
