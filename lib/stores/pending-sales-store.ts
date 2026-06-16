import { create } from 'zustand';
import {
  fetchPendingSales,
  type PendingSale,
} from '@/lib/pos/pending-sales';

interface PendingSalesState {
  sales: PendingSale[];
  loading: boolean;
  error: string | null;
  refresh: (isOnline?: boolean) => Promise<void>;
  removeSale: (saleId: string) => void;
}

export const usePendingSalesStore = create<PendingSalesState>((set, get) => ({
  sales: [],
  loading: false,
  error: null,

  refresh: async (isOnline = true) => {
    if (!isOnline) {
      set({ sales: [], loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const data = await fetchPendingSales();
      set({ sales: data, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load saved sales',
        loading: false,
      });
    }
  },

  removeSale: (saleId) => {
    set((state) => ({
      sales: state.sales.filter((s) => s.id !== saleId),
    }));
  },
}));
