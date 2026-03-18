import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';

import { useRunStore } from '@/store/runStore';
import { useGPS } from '@/hooks/useGPS';
import { useHexConquest } from '@/hooks/useHexConquest';
import { useAuthStore } from '@/store/authStore';
import { colors, typography, spacing, radius } from '@/utils/constants';
import { RunStackParamList } from '@/types/navigation';

type Props = StackScreenProps<RunStackParamList, 'RunHome'>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RunScreen({ navigation }: Props): React.ReactElement {
  const { user } = useAuthStore();

  const {
    isRunning,
    startedAt,
    conqueredCount,
    stolenCount,
    startRun,
    endRun,
  } = useRunStore();

  const { currentLocation, isTracking, error, start, stop } = useGPS();
  const { processLocation } = useHexConquest();

  const [elapsed, setElapsed]   = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Elapsed timer ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (isRunning && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, isPaused]);

  // ── Process GPS location → hex conquest ───────────────────────────────────

  useEffect(() => {
    if (!currentLocation || !isRunning || isPaused) return;
    processLocation(currentLocation);
  }, [currentLocation, isRunning, isPaused, processLocation]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleStartRun = useCallback(async (): Promise<void> => {
    if (!user) return;
    setElapsed(0);
    setIsPaused(false);
    startRun();
    await start();
  }, [user, startRun, start]);

  const handlePause = useCallback((): void => {
    if (isPaused) {
      setIsPaused(false);
      start(); // resume GPS
    } else {
      setIsPaused(true);
      stop();  // pause GPS — saves battery
    }
  }, [isPaused, start, stop]);

  const handleStopRun = useCallback((): void => {
    const finalElapsed   = elapsed;
    const finalConquered = conqueredCount;
    const finalStolen    = stolenCount;

    stop();
    endRun();
    setElapsed(0);
    setIsPaused(false);

    navigation.navigate('RunSummary', {
      conqueredCount:  finalConquered,
      stolenCount:     finalStolen,
      distanceMeters:  0,     // distance tracking via GPS to be wired in Phase 4
      durationSeconds: finalElapsed,
    });
  }, [stop, endRun, elapsed, conqueredCount, stolenCount, navigation]);

  // ── Render — idle ──────────────────────────────────────────────────────────

  if (!isRunning) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.idleInner}>
          <Text style={styles.idleTitle}>Ready to run?</Text>
          <Text style={styles.idleSubtitle}>
            Start your run to conquer hexagons and battle for your city.
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartRun}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>Start Run</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render — active run ────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.activeInner}>

        {/* Status pill */}
        <View style={[styles.statusPill, isPaused ? styles.statusPillPaused : styles.statusPillActive]}>
          <Text style={styles.statusPillText}>{isPaused ? 'PAUSED' : 'RUNNING'}</Text>
        </View>

        {/* Elapsed time */}
        <Text style={styles.elapsedTime}>{formatElapsed(elapsed)}</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{conqueredCount}</Text>
            <Text style={styles.statLabel}>Conquered</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Text style={[styles.statValue, stolenCount > 0 && styles.statValueStolen]}>
              {stolenCount}
            </Text>
            <Text style={styles.statLabel}>Stolen</Text>
          </View>
        </View>

        {/* GPS accuracy indicator */}
        {currentLocation?.accuracy !== null && currentLocation?.accuracy !== undefined && (
          <Text style={styles.accuracyText}>
            GPS ±{Math.round(currentLocation.accuracy)}m
          </Text>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.pauseButton}
            onPress={handlePause}
            activeOpacity={0.8}
          >
            <Text style={styles.pauseButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopRun}
            activeOpacity={0.8}
          >
            <Text style={styles.stopButtonText}>Stop Run</Text>
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

  // ── Idle ──────────────────────────────────────────────────────────────────
  idleInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  idleTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  idleSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    fontWeight: typography.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  startButton: {
    width: '100%',
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  startButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },

  // ── Active run ─────────────────────────────────────────────────────────────
  activeInner: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  statusPillActive: {
    backgroundColor: colors.accentDim,
  },
  statusPillPaused: {
    backgroundColor: colors.bgOverlay,
  },
  statusPillText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.accent,
    letterSpacing: 1.5,
  },
  elapsedTime: {
    fontFamily: typography.fontFamily,
    fontSize: 64,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    width: '100%',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.md,
  },
  statValue: {
    fontFamily: typography.fontFamily,
    fontSize: typography.xxl,
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
  accuracyText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.xs,
    color: colors.textDisabled,
  },
  errorText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    color: colors.hexEnemy,
    textAlign: 'center',
  },

  // ── Controls ───────────────────────────────────────────────────────────────
  controls: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: spacing.xl,
    right: spacing.xl,
    gap: spacing.sm,
  },
  pauseButton: {
    paddingVertical: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  pauseButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  stopButton: {
    paddingVertical: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hexEnemy,
    alignItems: 'center',
  },
  stopButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.hexEnemy,
  },
});
