import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapboxGL from '@rnmapbox/maps';
import { cellToBoundary } from 'h3-js';

import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { useMapStore } from '@/store/mapStore';
import { colors, MAX_HEX_RENDER_COUNT } from '@/utils/constants';
import { HexagonWithOwner } from '@/types/models';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

const MAPBOX_STYLE = process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/mapbox/dark-v11';
const COPENHAGEN_CENTER: [number, number] = [12.5683, 55.6761];
const DEFAULT_ZOOM = 14;

function hexesToGeoJSON(
  hexagons: HexagonWithOwner[],
  currentUserId: string | null,
  followedUserIds: string[],
) {
  return {
    type: 'FeatureCollection' as const,
    features: hexagons.map((hex) => {
      let fillColor = colors.hexNeutral;
      if (hex.owner_id === currentUserId) {
        fillColor = colors.hexOwn;
      } else if (hex.owner_id && followedUserIds.includes(hex.owner_id)) {
        fillColor = colors.hexFriend;
      } else if (hex.owner_id) {
        fillColor = colors.hexEnemy;
      }
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [cellToBoundary(hex.h3_index, true)],
        },
        properties: { id: hex.h3_index, fillColor },
      };
    }),
  };
}

export default function MapScreen(): React.ReactElement {
  const { user } = useAuthStore();
  const { hexagons, setHexagons, updateHex, currentUserId, followedUserIds, setCurrentUserId } =
    useMapStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setCurrentUserId(user?.id ?? null);
  }, [user?.id, setCurrentUserId]);

  useEffect(() => {
    let cancelled = false;

    async function loadHexagons() {
      setIsLoading(true);
      const { data } = await supabase
        .from('hexagons')
        .select('*, owner:owner_id(id, username, display_name, avatar_url)')
        .eq('city', 'Copenhagen')
        .limit(MAX_HEX_RENDER_COUNT);

      if (!cancelled && data) {
        setHexagons(data as HexagonWithOwner[]);
      }
      if (!cancelled) setIsLoading(false);
    }

    loadHexagons();
    return () => {
      cancelled = true;
    };
  }, [setHexagons]);

  useFocusEffect(
    useCallback(() => {
      const subscription = supabase
        .channel('hex-updates-map')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'hexagons', filter: 'city=eq.Copenhagen' },
          (payload) => {
            updateHex(payload.new as HexagonWithOwner);
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }, [updateHex]),
  );

  const geoJSON = useMemo(
    () => hexesToGeoJSON(hexagons, currentUserId, followedUserIds),
    [hexagons, currentUserId, followedUserIds],
  );

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MAPBOX_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        <MapboxGL.Camera
          defaultSettings={{ centerCoordinate: COPENHAGEN_CENTER, zoomLevel: DEFAULT_ZOOM }}
        />
        <MapboxGL.ShapeSource id="hexagons" shape={geoJSON}>
          <MapboxGL.FillLayer
            id="hex-fill"
            style={{
              fillColor: ['get', 'fillColor'],
              fillOpacity: 0.6,
            }}
          />
          <MapboxGL.LineLayer
            id="hex-border"
            style={{
              lineColor: colors.borderSubtle,
              lineWidth: 0.5,
              lineOpacity: 0.4,
            }}
          />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>

      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  map: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 15, 20, 0.6)',
  },
});
