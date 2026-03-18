import { useEffect, useRef, useCallback } from 'react';

import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { useRunStore } from '@/store/runStore';
import { gpsToHexId } from '@/utils/hex';
import { GPSLocation } from '@/hooks/useGPS';
import { Hexagon } from '@/types/models';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Security rule: min 3s between adjacent hex conquests (anti-spoofing)
const MIN_CONQUEST_INTERVAL_MS = 3000;

// Velocity threshold above which GPS is flagged as potentially spoofed (12 m/s ≈ 43 km/h)
const MAX_VELOCITY_MS = 12;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConquestResult {
  hexId:      string;
  wasStolen:  boolean;             // true if hex was owned by a different user
  stolenFrom: string | null;       // display_name of previous owner, if stolen
}

interface UseHexConquestReturn {
  processLocation: (location: GPSLocation) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHexConquest(): UseHexConquestReturn {
  const { user } = useAuthStore();
  const { isRunning, activeHexIds, addConqueredHex, updateLocation } = useRunStore();

  // Track the last hex processed to debounce same-hex entries
  const lastHexRef           = useRef<string | null>(null);
  const lastConquestTimeRef  = useRef<number>(0);
  const lastLocationRef      = useRef<GPSLocation | null>(null);

  // Reset on run start/stop
  useEffect(() => {
    if (!isRunning) {
      lastHexRef.current          = null;
      lastConquestTimeRef.current = 0;
      lastLocationRef.current     = null;
    }
  }, [isRunning]);

  const processLocation = useCallback(async (location: GPSLocation): Promise<void> => {
    if (!isRunning || !user) return;

    // Always update position in store regardless of hex conquest
    updateLocation(location);

    // ── Velocity anti-spoofing ─────────────────────────────────────────────
    if (lastLocationRef.current) {
      const prev      = lastLocationRef.current;
      const dtSeconds = (location.timestamp - prev.timestamp) / 1000;

      if (dtSeconds > 0) {
        const dLat  = (location.lat - prev.lat) * 111_000; // rough metres per degree
        const dLng  = (location.lng - prev.lng) * 111_000 * Math.cos((location.lat * Math.PI) / 180);
        const dist  = Math.sqrt(dLat * dLat + dLng * dLng);
        const speed = dist / dtSeconds;

        if (speed > MAX_VELOCITY_MS) {
          console.warn('[useHexConquest] Velocity too high — skipping conquest.', { speed });
          lastLocationRef.current = location;
          return;
        }
      }
    }

    lastLocationRef.current = location;

    // ── Convert GPS to H3 ─────────────────────────────────────────────────
    const hexId = gpsToHexId(location.lat, location.lng);

    // Debounce: skip if still in the same hex
    if (hexId === lastHexRef.current) return;

    // Debounce: enforce minimum time between conquest attempts
    const now = Date.now();
    if (now - lastConquestTimeRef.current < MIN_CONQUEST_INTERVAL_MS) return;

    // Skip if already conquered this hex in the current run
    if (activeHexIds.has(hexId)) {
      lastHexRef.current = hexId;
      return;
    }

    lastHexRef.current          = hexId;
    lastConquestTimeRef.current = now;

    // ── Upsert to Supabase ────────────────────────────────────────────────
    try {
      // Fetch current hex state to detect theft
      const { data: existing } = await supabase
        .from('hexagons')
        .select('owner_id, conquest_count, profiles(display_name)')
        .eq('h3_index', hexId)
        .maybeSingle();

      const isTheft = existing !== null && existing.owner_id !== user.id;

      const upsertPayload: Partial<Hexagon> & { h3_index: string } = {
        h3_index:     hexId,
        owner_id:     user.id,
        conquered_at: new Date().toISOString(),
        city:         user.city,
        conquest_count: existing ? (existing.conquest_count as number) + 1 : 1,
        ...(isTheft && { previous_owner_id: existing.owner_id as string }),
      };

      const { error } = await supabase
        .from('hexagons')
        .upsert(upsertPayload, { onConflict: 'h3_index' });

      if (error) {
        console.error('[useHexConquest] Upsert failed:', error.message);
        return;
      }

      // Extract stolen-from display name if available
      let stolenFrom: string | null = null;
      if (isTheft && existing?.profiles) {
        // Supabase returns joined rows as an array when using .select('profiles(field)')
        const profilesRaw = existing.profiles as unknown;
        const profileRow  = Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw;
        const profile     = profileRow as { display_name: string | null } | null;
        stolenFrom        = profile?.display_name ?? null;
      }

      addConqueredHex(hexId, isTheft);

      const result: ConquestResult = { hexId, wasStolen: isTheft, stolenFrom };
      console.log('[useHexConquest] Conquered:', result);
    } catch (err: unknown) {
      console.error('[useHexConquest] Unexpected error:', err instanceof Error ? err.message : err);
    }
  }, [isRunning, user, activeHexIds, addConqueredHex, updateLocation]);

  return { processLocation };
}
