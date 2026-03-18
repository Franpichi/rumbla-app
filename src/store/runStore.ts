import { create } from 'zustand';

import { GPSLocation } from '@/hooks/useGPS';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunState {
  isRunning:       boolean;
  startedAt:       string | null;  // ISO 8601
  activeHexIds:    Set<string>;    // hexes conquered in the current run
  conqueredCount:  number;         // new hexes claimed this run
  stolenCount:     number;         // hexes stolen from others this run
  currentLocation: GPSLocation | null;

  startRun:        () => void;
  endRun:          () => void;
  addConqueredHex: (hexId: string, wasStolen: boolean) => void;
  updateLocation:  (location: GPSLocation) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRunStore = create<RunState>((set) => ({
  isRunning:       false,
  startedAt:       null,
  activeHexIds:    new Set<string>(),
  conqueredCount:  0,
  stolenCount:     0,
  currentLocation: null,

  startRun: () =>
    set({
      isRunning:      true,
      startedAt:      new Date().toISOString(),
      activeHexIds:   new Set<string>(),
      conqueredCount: 0,
      stolenCount:    0,
      currentLocation: null,
    }),

  endRun: () =>
    set({
      isRunning:      false,
      startedAt:      null,
      activeHexIds:   new Set<string>(),
      conqueredCount: 0,
      stolenCount:    0,
      currentLocation: null,
    }),

  addConqueredHex: (hexId, wasStolen) =>
    set((state) => {
      const activeHexIds = new Set(state.activeHexIds);
      activeHexIds.add(hexId);
      return {
        activeHexIds,
        conqueredCount: state.conqueredCount + 1,
        stolenCount:    wasStolen ? state.stolenCount + 1 : state.stolenCount,
      };
    }),

  updateLocation: (location) =>
    set({ currentLocation: location }),
}));
