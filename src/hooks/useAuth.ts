import { useEffect } from 'react';

import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { UserProfile } from '@/types/models';

// Fetches (or creates a stub for) the profile row matching the authenticated user.
async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // PGRST116 = row not found — profile hasn't been created yet (handled in AuthScreen)
    if (error.code !== 'PGRST116') {
      console.error('[useAuth] fetchProfile error:', error.message);
    }
    return null;
  }

  return data as UserProfile;
}

export function useAuth(): void {
  const { setUser, setSession, setIsLoading, signOut } = useAuthStore();

  useEffect(() => {
    // 1. Hydrate from the existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      }

      setIsLoading(false);
    });

    // 2. Keep store in sync with every subsequent auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);

        if (event === 'SIGNED_OUT' || !session) {
          signOut();
          return;
        }

        if (session.user) {
          const profile = await fetchProfile(session.user.id);
          setUser(profile);
        }

        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
