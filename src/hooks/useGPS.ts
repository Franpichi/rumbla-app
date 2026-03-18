import { useState, useRef, useCallback } from 'react';
import * as Location from 'expo-location';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GPSLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
}

interface UseGPSReturn {
  currentLocation: GPSLocation | null;
  isTracking: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// Performance rule: poll every 5s, only on new hex entry (debounce in useHexConquest)
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS   = 5000;
const DISTANCE_FILTER_M  = 10; // minimum movement (metres) to trigger an update

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGPS(): UseGPSReturn {
  const [currentLocation, setCurrentLocation] = useState<GPSLocation | null>(null);
  const [isTracking, setIsTracking]           = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  // Hold a ref to the subscription so stop() can remove it
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const start = useCallback(async (): Promise<void> => {
    if (isTracking) return;

    setError(null);

    // Request foreground permission first (required before background)
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      setError('Location permission denied. Enable it in Settings to track your run.');
      return;
    }

    // Request background permission — needed to keep tracking when screen is off
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      setError('Background location permission denied. Tracking will pause when the screen turns off.');
      // Continue with foreground-only tracking — don't block the run entirely
    }

    try {
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy:       Location.Accuracy.BestForNavigation,
          timeInterval:   POLL_INTERVAL_MS,
          distanceInterval: DISTANCE_FILTER_M,
        },
        (location) => {
          setCurrentLocation({
            lat:       location.coords.latitude,
            lng:       location.coords.longitude,
            accuracy:  location.coords.accuracy,
            timestamp: location.timestamp,
          });
        },
      );

      setIsTracking(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start GPS tracking.');
    }
  }, [isTracking]);

  const stop = useCallback((): void => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setIsTracking(false);
    setCurrentLocation(null);
  }, []);

  return { currentLocation, isTracking, error, start, stop };
}
