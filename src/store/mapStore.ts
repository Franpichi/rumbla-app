import { create } from 'zustand';

import { HexagonWithOwner } from '@/types/models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapState {
  hexagons:        HexagonWithOwner[];
  currentUserId:   string | null;
  followedUserIds: string[];           // populated by friend system — used for hex coloring

  setHexagons:       (hexagons: HexagonWithOwner[]) => void;
  updateHex:         (updated: HexagonWithOwner) => void;
  setCurrentUserId:  (id: string | null) => void;
  setFollowedUserIds:(ids: string[]) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMapStore = create<MapState>((set) => ({
  hexagons:        [],
  currentUserId:   null,
  followedUserIds: [],

  setHexagons: (hexagons) => set({ hexagons }),

  updateHex: (updated) =>
    set((state) => {
      const idx = state.hexagons.findIndex((h) => h.h3_index === updated.h3_index);
      if (idx === -1) {
        // New hex — prepend so it appears immediately on the map
        return { hexagons: [updated, ...state.hexagons] };
      }
      const hexagons = [...state.hexagons];
      hexagons[idx] = updated;
      return { hexagons };
    }),

  setCurrentUserId:   (currentUserId) => set({ currentUserId }),
  setFollowedUserIds: (followedUserIds) => set({ followedUserIds }),
}));
