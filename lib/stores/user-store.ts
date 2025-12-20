import { create } from 'zustand';
import type { UserRole } from '@/lib/constants';

export interface User {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

interface UserStore {
  user: User | null;
  setUser: (user: User | null) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  
  setUser: (user) => {
    set({ user });
  },
  
  clearUser: () => {
    set({ user: null });
  },
}));

