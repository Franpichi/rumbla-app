import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Text,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapboxGL from '@rnmapbox/maps';
import { cellToBoundary, polygonToCells } from 'h3-js';

import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { useMapStore } from '@/store/mapStore';
import { colors, typography, spacing, radius, MAX_HEX_RENDER_COUNT } from '@/utils/constants';
import { HexagonWithOwner } from '@/types/models';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

const MAPBOX_TOKEN   = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
const MAPBOX_STYLE   = process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/rumbla/cmmwdbrnl001u01sia4i8e69f';
console.log('[MapScreen] Mapbox style URL:', MAPBOX_STYLE);
const COPENHAGEN_CENTER: [number, number] = [12.5683, 55.6761];
const DEFAULT_ZOOM   = 14;

// ---------------------------------------------------------------------------
// Feature 1 — Static background hex grid (computed once at module load)
// ---------------------------------------------------------------------------

const BG_HEX_CELLS = polygonToCells(
  [[55.62, 12.45], [55.62, 12.70], [55.75, 12.70], [55.75, 12.45]],
  9,
);

const BG_HEX_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: BG_HEX_CELLS.map((cell) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [cellToBoundary(cell, true)],
    },
    properties: { id: cell },
  })),
};

// ---------------------------------------------------------------------------
// Feature 2 — Search types
// ---------------------------------------------------------------------------

interface GeocodingFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface GeocodingResponse {
  features: GeocodingFeature[];
}

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
}

type SearchResult =
  | { type: 'place'; id: string; name: string; center: [number, number] }
  | { type: 'user';  id: string; username: string; display_name: string | null };

// ---------------------------------------------------------------------------
// Ownership hex GeoJSON
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// MapScreen
// ---------------------------------------------------------------------------

export default function MapScreen(): React.ReactElement {
  const { user } = useAuthStore();
  const { hexagons, setHexagons, updateHex, currentUserId, followedUserIds, setCurrentUserId } =
    useMapStore();
  const [isLoading, setIsLoading] = useState(true);

  // Camera ref for programmatic pan/zoom
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // Search state
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // ── Auth sync ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setCurrentUserId(user?.id ?? null);
  }, [user?.id, setCurrentUserId]);

  // ── Initial hex load ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadHexagons() {
      setIsLoading(true);
      const { data } = await supabase
        .from('hexagons')
        .select('*, owner:owner_id(id, username, display_name, avatar_url)')
        .eq('city', 'Copenhagen')
        .limit(MAX_HEX_RENDER_COUNT);

      if (!cancelled && data) setHexagons(data as HexagonWithOwner[]);
      if (!cancelled) setIsLoading(false);
    }

    loadHexagons();
    return () => { cancelled = true; };
  }, [setHexagons]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      const subscription = supabase
        .channel('hex-updates-map')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'hexagons', filter: 'city=eq.Copenhagen' },
          (payload) => { updateHex(payload.new as HexagonWithOwner); },
        )
        .subscribe();

      return () => { supabase.removeChannel(subscription); };
    }, [updateHex]),
  );

  // ── Search logic ──────────────────────────────────────────────────────────

  const runSearch = useCallback(async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      if (trimmed.startsWith('@')) {
        const q = trimmed.slice(1);
        if (!q) { setResults([]); setShowDropdown(false); return; }

        const { data } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .ilike('username', `%${q}%`)
          .limit(5);

        const userResults: SearchResult[] = ((data ?? []) as ProfileRow[]).map((p) => ({
          type: 'user',
          id: p.id,
          username: p.username,
          display_name: p.display_name,
        }));
        setResults(userResults);
        setShowDropdown(userResults.length > 0);
      } else {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json` +
          `?access_token=${MAPBOX_TOKEN}&limit=5&proximity=12.5683,55.6761`;

        const response = await fetch(url);
        const json = (await response.json()) as GeocodingResponse;
        const placeResults: SearchResult[] = json.features.map((f) => ({
          type: 'place',
          id: f.id,
          name: f.place_name,
          center: f.center,
        }));
        setResults(placeResults);
        setShowDropdown(placeResults.length > 0);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce: fire search 350ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => { runSearch(query); }, 350);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const handleSelectResult = useCallback((result: SearchResult): void => {
    if (result.type === 'place') {
      cameraRef.current?.setCamera({
        centerCoordinate: result.center,
        zoomLevel: 15,
        animationDuration: 800,
      });
    }
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    Keyboard.dismiss();
  }, []);

  const handleClear = useCallback((): void => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  }, []);

  const dismissSearch = useCallback((): void => {
    setShowDropdown(false);
    Keyboard.dismiss();
  }, []);

  // ── Ownership GeoJSON ─────────────────────────────────────────────────────

  const geoJSON = useMemo(
    () => hexesToGeoJSON(hexagons, currentUserId, followedUserIds),
    [hexagons, currentUserId, followedUserIds],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MAPBOX_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        onPress={dismissSearch}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: COPENHAGEN_CENTER, zoomLevel: DEFAULT_ZOOM }}
        />

        {/* Feature 1 — Background hex grid at 10% opacity (always visible) */}
        <MapboxGL.ShapeSource id="hex-grid-bg" shape={BG_HEX_GEOJSON}>
          <MapboxGL.FillLayer
            id="hex-grid-bg-fill"
            style={{
              fillColor: colors.teal,
              fillOpacity: 0.10,
              fillOutlineColor: colors.teal,
            }}
          />
        </MapboxGL.ShapeSource>

        {/* Ownership hexagons (renders on top of background grid) */}
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

      {/* Feature 2 — Floating search bar */}
      <View style={styles.searchWrapper} pointerEvents="box-none">
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search places or players..."
            placeholderTextColor={colors.textDisabled}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {isSearching && (
            <ActivityIndicator size="small" color={colors.teal} style={styles.searchSpinner} />
          )}
          {query.length > 0 && !isSearching && (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {showDropdown && results.length > 0 && (
          <View style={styles.dropdown}>
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    index < results.length - 1 && styles.dropdownItemBorder,
                  ]}
                  onPress={() => handleSelectResult(item)}
                  activeOpacity={0.7}
                >
                  {item.type === 'place' ? (
                    <Text style={styles.dropdownItemText} numberOfLines={1}>
                      {item.name}
                    </Text>
                  ) : (
                    <View>
                      <Text style={styles.dropdownItemText}>@{item.username}</Text>
                      {item.display_name ? (
                        <Text style={styles.dropdownItemSub}>{item.display_name}</Text>
                      ) : null}
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  map: { flex: 1 },

  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 15, 20, 0.6)',
  },

  // ── Search ────────────────────────────────────────────────────────────────
  searchWrapper: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchIcon: {
    fontSize: typography.base,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.base,
    fontFamily: typography.fontFamily,
    paddingVertical: 0, // remove default Android padding
  },
  searchSpinner: {
    marginLeft: spacing.xs,
  },
  clearIcon: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },

  // ── Dropdown ──────────────────────────────────────────────────────────────
  dropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  dropdownItemText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontFamily: typography.fontFamily,
  },
  dropdownItemSub: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontFamily: typography.fontFamily,
    marginTop: 2,
  },
});
