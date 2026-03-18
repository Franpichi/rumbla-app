import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapboxGL from '@rnmapbox/maps';
import { cellToBoundary } from 'h3-js';

import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { useMapStore } from '@/store/mapStore';
import { colors, MAX_HEX_RENDER_COUNT } from '@/utils/constants';
import { HexagonWithOwner } from '@/types/models';

// ---------------------------------------------------------------------------
// Mapbox initialisation — runs once at module load
// ---------------------------------------------------------------------------

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? null);

// ---------------------------------------------------------------------------
// Copenhagen centre
// ---------------------------------------------------------------------------

const COPENHAGEN: [number, number] = [12.5683, 55.6761]; // [lng, lat]
const DEFAULT_ZOOM = 12;

// ---------------------------------------------------------------------------
// GeoJSON builder — embeds fill_color as a feature property so a single
// FillLayer can colour every hex without multiple sources.
// ---------------------------------------------------------------------------

interface ColoredFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: [number[][]];
  };
  properties: {
    id:    string;
    color: string;
  };
}

interface ColoredFeatureCollection {
  type: 'FeatureCollection';
  features: ColoredFeature[];
}

function buildGeoJSON(
  hexagons:        HexagonWithOwner[],
  currentUserId:   string | null,
  followedUserIds: string[],
): ColoredFeatureCollection {
  // Cap at MAX_HEX_RENDER_COUNT — performance rule from CLAUDE.md section 11
  const visible = hexagons.slice(0, MAX_HEX_RENDER_COUNT);

  return {
    type: 'FeatureCollection',
    features: visible.map((hex): ColoredFeature => {
      let color: string;

      if (!hex.owner_id) {
        color = colors.hexNeutral;
      } else if (hex.owner_id === currentUserId) {
        color = colors.hexOwn;
      } else if (followedUserIds.includes(hex.owner_id)) {
        color = colors.hexFriend;
      } else {
        color = colors.hexEnemy;
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          // cellToBoundary with formatAsGeoJson=true → [lng, lat] pairs (GeoJSON order)
          coordinates: [cellToBoundary(hex.h3_index, true)],
        },
        properties: {
          id:    hex.h3_index,
          color,
        },
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MapScreen(): React.ReactElement {
  const { user }                                          = useAuthStore();
  const { hexagons, currentUserId, followedUserIds,
          setHexagons, updateHex, setCurrentUserId }      = useMapStore();

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const realtimeChannelRef            = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Sync currentUserId into mapStore whenever auth user changes ────────────

  useEffect(() => {
    setCurrentUserId(user?.id ?? null);
  }, [user?.id, setCurrentUserId]);

  // ── Initial data load ─────────────────────────────────────────────────────

  useEffect(() => {
    async function loadHexagons(): Promise<void> {
      const { data, error } = await supabase
        .from('hexagons')
        .select('*, profiles(id, username, display_name, avatar_url)')
        .eq('city', 'Copenhagen')
        .limit(MAX_HEX_RENDER_COUNT);

      if (error) {
        console.error('[MapScreen] loadHexagons error:', error.message);
        return;
      }

      if (data) {
        // Supabase returns the joined profiles row under the foreign key alias.
        // Remap it to match HexagonWithOwner.owner shape.
        const mapped: HexagonWithOwner[] = (data as Array<Record<string, unknown>>).map((row) => ({
          h3_index:          row['h3_index'] as string,
          owner_id:          row['owner_id'] as string | null,
          city:              row['city'] as string,
          conquered_at:      row['conquered_at'] as string,
          previous_owner_id: row['previous_owner_id'] as string | null,
          conquest_count:    row['conquest_count'] as number,
          owner:             (row['profiles'] as HexagonWithOwner['owner']) ?? null,
        }));
        setHexagons(mapped);
      }
    }

    loadHexagons();
  }, [setHexagons]);

  // ── Realtime subscription — active only while screen is focused ───────────

  const subscribeToRealtime = useCallback((): (() => void) => {
    const channel = supabase
      .channel('hex-updates-map')
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'hexagons',
          filter: 'city=eq.Copenhagen',
        },
        (payload) => {
          // payload.new contains the updated row; fetch the owner profile separately
          // if needed. For now, construct the HexagonWithOwner without nested profile.
          const row = payload.new as Record<string, unknown>;
          const updated: HexagonWithOwner = {
            h3_index:          row['h3_index'] as string,
            owner_id:          row['owner_id'] as string | null,
            city:              row['city'] as string,
            conquered_at:      row['conquered_at'] as string,
            previous_owner_id: row['previous_owner_id'] as string | null,
            conquest_count:    row['conquest_count'] as number,
            owner:             null, // profile arrives asynchronously; colour will still render
          };
          updateHex(updated);
        },
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [updateHex]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = subscribeToRealtime();
      return () => unsubscribe();
    }, [subscribeToRealtime]),
  );

  // ── GeoJSON — recomputed only when hexagons or user context changes ────────

  const geoJSON = useMemo(
    () => buildGeoJSON(hexagons, currentUserId, followedUserIds),
    [hexagons, currentUserId, followedUserIds],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? MapboxGL.StyleURL.Dark}
        onDidFinishLoadingMap={() => setIsMapLoaded(true)}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
      >
        <MapboxGL.Camera
          centerCoordinate={COPENHAGEN}
          zoomLevel={DEFAULT_ZOOM}
          animationMode="none"
        />

        {/* Hex layer — only rendered once the map is ready */}
        {isMapLoaded && (
          <MapboxGL.ShapeSource
            id="conquered-hexes"
            shape={geoJSON}
          >
            <MapboxGL.FillLayer
              id="hex-fill"
              style={{
                fillColor:   ['get', 'color'],
                fillOpacity: 0.65,
              }}
            />
            <MapboxGL.LineLayer
              id="hex-border"
              style={{
                lineColor:   ['get', 'color'],
                lineWidth:   1,
                lineOpacity: 0.4,
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {/* Loading overlay */}
      {!isMapLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems:     'center',
    backgroundColor: colors.bgBase,
  },
});
