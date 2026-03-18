import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { RunStackParamList, MainTabParamList } from '@/types/navigation';
import { colors, typography, spacing, radius } from '@/utils/constants';

// ---------------------------------------------------------------------------
// Navigation prop type — RunSummary lives inside RunStack inside MainTabs
// ---------------------------------------------------------------------------

type Props = CompositeScreenProps<
  StackScreenProps<RunStackParamList, 'RunSummary'>,
  BottomTabScreenProps<MainTabParamList>
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RunSummaryScreen({ route, navigation }: Props): React.ReactElement {
  const { conqueredCount, stolenCount, distanceMeters, durationSeconds } = route.params;

  function handleShare(): void {
    Alert.alert('Sharing coming soon', 'Stories export will be available in the next update.');
  }

  function handleBackToMap(): void {
    // Navigate to the Map tab — resets the Run stack back to RunHome as a side effect
    navigation.navigate('Map');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Run complete.</Text>
          <Text style={styles.subtitle}>
            {conqueredCount > 0
              ? `You conquered ${conqueredCount} zone${conqueredCount === 1 ? '' : 's'} today.`
              : 'No zones conquered this run — get out there again.'}
          </Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{conqueredCount}</Text>
            <Text style={styles.statLabel}>
              {conqueredCount === 1 ? 'Zone conquered' : 'Zones conquered'}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statValue, stolenCount > 0 && styles.statValueStolen]}>
              {stolenCount}
            </Text>
            <Text style={styles.statLabel}>
              {stolenCount === 1 ? 'Zone stolen' : 'Zones stolen'}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDistance(distanceMeters)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDuration(durationSeconds)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>

        </View>

        {/* Motivational microcopy */}
        {stolenCount > 0 && (
          <View style={styles.callout}>
            <Text style={styles.calloutText}>
              You stole {stolenCount} zone{stolenCount === 1 ? '' : 's'} this run.{' '}
              Their owners are going to want them back.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Text style={styles.shareButtonText}>Share to Stories</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapButton}
            onPress={handleBackToMap}
            activeOpacity={0.8}
          >
            <Text style={styles.mapButtonText}>Back to Map</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
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
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    fontWeight: typography.regular,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // ── Stats grid ─────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  statValue: {
    fontFamily: typography.fontFamily,
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  statValueStolen: {
    color: colors.teal,
  },
  statLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    fontWeight: typography.regular,
    color: colors.textSecondary,
  },

  // ── Callout ────────────────────────────────────────────────────────────────
  callout: {
    backgroundColor: colors.tealDim,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.teal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  calloutText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.teal,
    lineHeight: 20,
  },

  // ── Actions ────────────────────────────────────────────────────────────────
  actions: {
    marginTop: 'auto',
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  shareButton: {
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  shareButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  mapButton: {
    paddingVertical: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  mapButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
});
