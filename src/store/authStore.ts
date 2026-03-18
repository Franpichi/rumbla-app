import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';

import { UserProfile } from '@/types/models';

interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: UserProfile | null) => void;
  setSession: (session: Session | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true, // true until the initial auth listener fires
  isAuthenticated: false,

  setUser: (user) => set({ user }),

  setSession: (session) =>
    set({ session, isAuthenticated: session !== null }),

  setIsLoading: (isLoading) => set({ isLoading }),

  signOut: () =>
    set({ user: null, session: null, isAuthenticated: false }),
}));
