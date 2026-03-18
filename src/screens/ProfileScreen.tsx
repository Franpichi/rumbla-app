import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { getWeeklyRankings } from '@/services/rankingsService';
import { colors, typography, spacing, radius } from '@/utils/constants';
import { UserProfile } from '@/types/models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileStats {
  totalRuns:      number;
  totalDistanceM: number;
  friendsCount:   number;
  weeklyRank:     number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function getInitials(displayName: string | null, username: string): string {
  return (displayName ?? username).slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  value:   string | number;
  label:   string;
}

function StatCard({ value, label }: StatCardProps): React.ReactElement {
  return (
    <View style={statCardStyles.card}>
      <Text style={statCardStyles.value}>{value}</Text>
      <Text style={statCardStyles.label}>{label}</Text>
    </View>
  );
}

const statCardStyles = StyleSheet.create({
  card: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.md,
    gap:             spacing.xs,
  },
  value: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.xl,
    fontWeight:  typography.bold,
    color:       colors.textPrimary,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize:   typography.xs,
    color:      colors.textSecondary,
    textAlign:  'center',
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ProfileScreen(): React.ReactElement {
  const { user, setUser } = useAuthStore();

  const [profile, setProfile]   = useState<UserProfile | null>(user);
  const [stats, setStats]       = useState<ProfileStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // ── Fetch profile + derived stats ─────────────────────────────────────────

  const loadProfile = useCallback(async (): Promise<void> => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch latest profile row (hex_count_total, streak_current etc may have updated)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('[ProfileScreen] profile fetch error:', profileError.message);
      } else if (profileData) {
        const updated = profileData as UserProfile;
        setProfile(updated);
        setUser(updated); // keep authStore in sync
      }

      // Total runs
      const { count: runsCount, error: runsError } = await supabase
        .from('runs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (runsError) console.error('[ProfileScreen] runs count error:', runsError.message);

      // Total distance across all runs
      const { data: distanceData, error: distanceError } = await supabase
        .from('runs')
        .select('distance_meters')
        .eq('user_id', user.id)
        .not('distance_meters', 'is', null);

      if (distanceError) console.error('[ProfileScreen] distance error:', distanceError.message);

      const totalDistanceM = (distanceData ?? []).reduce(
        (sum, row) => sum + ((row as { distance_meters: number }).distance_meters ?? 0),
        0,
      );

      // Friends count (people this user follows)
      const { count: friendsCount, error: friendsError } = await supabase
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      if (friendsError) console.error('[ProfileScreen] friends count error:', friendsError.message);

      // Weekly rank — find this user in the current week's rankings
      const weeklyRankings = await getWeeklyRankings(user.city ?? 'Copenhagen');
      const weeklyEntry    = weeklyRankings.find((r) => r.userId === user.id);

      setStats({
        totalRuns:      runsCount      ?? 0,
        totalDistanceM: totalDistanceM ?? 0,
        friendsCount:   friendsCount   ?? 0,
        weeklyRank:     weeklyEntry?.rank ?? null,
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, setUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ── Sign out ───────────────────────────────────────────────────────────────

  async function handleSignOut(): Promise<void> {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          const { error } = await supabase.auth.signOut();
          if (error) {
            console.error('[ProfileScreen] signOut error:', error.message);
            setIsSigningOut(false);
          }
          // On success the useAuth listener fires SIGNED_OUT and clears authStore,
          // which causes RootNavigator to unmount MainTabs and show OnboardingNavigator.
        },
      },
    ]);
  }

  // ── Placeholder actions ───────────────────────────────────────────────────

  function handleFindFriends(): void {
    Alert.alert('Coming soon', 'Find friends by contacts or username — coming in the next update.');
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const displayName = profile.display_name ?? profile.username;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>
            {getInitials(profile.display_name, profile.username)}
          </Text>
        </View>

        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        <Text style={styles.city}>{profile.city}</Text>
      </View>

      {/* Stats row 1 — zones, rank, streak */}
      <View style={styles.statsRow}>
        <StatCard
          value={profile.hex_count_total}
          label="Zones conquered"
        />
        <View style={styles.statDivider} />
        <StatCard
          value={stats?.weeklyRank ? `#${stats.weeklyRank}` : '—'}
          label="Weekly rank"
        />
        <View style={styles.statDivider} />
        <StatCard
          value={profile.streak_current > 0 ? `${profile.streak_current}d` : '—'}
          label={profile.streak_current === 1 ? '1-day streak' : 'Day streak'}
        />
      </View>

      {/* Territory map placeholder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Territory</Text>
        <View style={styles.territoryPlaceholder}>
          <Text style={styles.territoryPlaceholderText}>
            Your territory map coming soon
          </Text>
        </View>
      </View>

      {/* Stats row 2 — runs, distance */}
      <View style={styles.statsRow}>
        <StatCard
          value={stats?.totalRuns ?? 0}
          label={stats?.totalRuns === 1 ? 'Run' : 'Runs'}
        />
        <View style={styles.statDivider} />
        <StatCard
          value={formatDistance(stats?.totalDistanceM ?? 0)}
          label="Total distance"
        />
      </View>

      {/* Friends */}
      <View style={styles.section}>
        <View style={styles.friendsRow}>
          <View style={styles.friendsLeft}>
            <Text style={styles.sectionTitle}>Friends</Text>
            <Text style={styles.friendsCount}>
              {stats?.friendsCount ?? 0}{' '}
              {stats?.friendsCount === 1 ? 'friend' : 'friends'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.findFriendsButton}
            onPress={handleFindFriends}
            activeOpacity={0.8}
          >
            <Text style={styles.findFriendsButtonText}>Find Friends</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign out */}
      <TouchableOpacity
        style={[styles.signOutButton, isSigningOut && styles.signOutButtonDisabled]}
        onPress={handleSignOut}
        disabled={isSigningOut}
        activeOpacity={0.8}
      >
        {isSigningOut ? (
          <ActivityIndicator size="small" color={colors.hexEnemy} />
        ) : (
          <Text style={styles.signOutButtonText}>Sign out</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loadingContainer: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: colors.bgBase,
  },
  container: {
    flex:            1,
    backgroundColor: colors.bgBase,
  },
  content: {
    paddingTop:    spacing.xl,
    paddingBottom: spacing.xxl,
    gap:           spacing.md,
  },

  // ── Avatar section ─────────────────────────────────────────────────────────
  avatarSection: {
    alignItems:       'center',
    paddingHorizontal: spacing.xl,
    gap:              spacing.xs,
    marginBottom:     spacing.sm,
  },
  avatarCircle: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: colors.bgOverlay,
    borderWidth:     2,
    borderColor:     colors.borderStrong,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    spacing.sm,
  },
  avatarInitials: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.xl,
    fontWeight:  typography.bold,
    color:       colors.textSecondary,
  },
  displayName: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.lg,
    fontWeight:  typography.bold,
    color:       colors.textPrimary,
  },
  username: {
    fontFamily: typography.fontFamily,
    fontSize:   typography.sm,
    color:      colors.textSecondary,
  },
  city: {
    fontFamily: typography.fontFamily,
    fontSize:   typography.sm,
    color:      colors.textDisabled,
  },

  // ── Stats rows ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection:    'row',
    marginHorizontal: spacing.md,
    backgroundColor:  colors.bgSurface,
    borderRadius:     radius.lg,
    borderWidth:      1,
    borderColor:      colors.borderSubtle,
  },
  statDivider: {
    width:            1,
    backgroundColor:  colors.borderSubtle,
    marginVertical:   spacing.md,
  },

  // ── Section ────────────────────────────────────────────────────────────────
  section: {
    marginHorizontal: spacing.md,
  },
  sectionTitle: {
    fontFamily:   typography.fontFamily,
    fontSize:     typography.sm,
    fontWeight:   typography.semibold,
    color:        colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  spacing.sm,
  },

  // ── Territory placeholder ──────────────────────────────────────────────────
  territoryPlaceholder: {
    height:          180,
    backgroundColor: colors.bgElevated,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.borderSubtle,
    justifyContent:  'center',
    alignItems:      'center',
  },
  territoryPlaceholderText: {
    fontFamily: typography.fontFamily,
    fontSize:   typography.sm,
    color:      colors.textDisabled,
  },

  // ── Friends ────────────────────────────────────────────────────────────────
  friendsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSurface,
    borderRadius:   radius.lg,
    borderWidth:    1,
    borderColor:    colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
  },
  friendsLeft: {
    gap: spacing.xs,
  },
  friendsCount: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.base,
    fontWeight:  typography.medium,
    color:       colors.textPrimary,
  },
  findFriendsButton: {
    backgroundColor: colors.bgElevated,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  findFriendsButtonText: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.sm,
    fontWeight:  typography.semibold,
    color:       colors.textPrimary,
  },

  // ── Sign out ───────────────────────────────────────────────────────────────
  signOutButton: {
    marginHorizontal: spacing.md,
    marginTop:        spacing.md,
    paddingVertical:  spacing.md,
    borderRadius:     radius.md,
    borderWidth:      1,
    borderColor:      colors.hexEnemy,
    alignItems:       'center',
  },
  signOutButtonDisabled: {
    opacity: 0.5,
  },
  signOutButtonText: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.base,
    fontWeight:  typography.semibold,
    color:       colors.hexEnemy,
  },
});
