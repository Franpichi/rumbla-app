import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ListRenderItem,
} from 'react-native';

import { useAuthStore } from '@/store/authStore';
import {
  getWeeklyRankings,
  getAllTimeRankings,
  RankedUser,
} from '@/services/rankingsService';
import { colors, typography, spacing, radius } from '@/utils/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RankingsTab = 'weekly' | 'alltime';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(displayName: string | null, username: string): string {
  return (displayName ?? username).slice(0, 2).toUpperCase();
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

// ---------------------------------------------------------------------------
// User row
// ---------------------------------------------------------------------------

interface RowProps {
  user:         RankedUser;
  isCurrentUser: boolean;
}

function RankRow({ user, isCurrentUser }: RowProps): React.ReactElement {
  return (
    <View style={[rowStyles.row, isCurrentUser && rowStyles.rowHighlighted]}>
      {/* Rank */}
      <Text style={[rowStyles.rank, user.rank <= 3 && rowStyles.rankMedal]}>
        {rankLabel(user.rank)}
      </Text>

      {/* Avatar */}
      <View style={rowStyles.avatar}>
        <Text style={rowStyles.avatarInitials}>
          {getInitials(user.displayName, user.username)}
        </Text>
      </View>

      {/* Name */}
      <View style={rowStyles.nameBlock}>
        <Text style={rowStyles.displayName} numberOfLines={1}>
          {user.displayName ?? user.username}
        </Text>
        {user.displayName && (
          <Text style={rowStyles.username} numberOfLines={1}>
            @{user.username}
          </Text>
        )}
      </View>

      {/* Hex count */}
      <Text style={[rowStyles.hexCount, isCurrentUser && rowStyles.hexCountOwn]}>
        {user.hexCount}
      </Text>

      {/* YOU badge */}
      {isCurrentUser && (
        <View style={rowStyles.youBadge}>
          <Text style={rowStyles.youBadgeText}>YOU</Text>
        </View>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: spacing.md,
    paddingVertical:  spacing.sm + 4,
    gap:              spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowHighlighted: {
    backgroundColor: colors.accentDim,
  },
  rank: {
    width:      36,
    fontFamily: typography.fontFamily,
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
    color:      colors.textSecondary,
    textAlign:  'center',
  },
  rankMedal: {
    fontSize: typography.md,
  },
  avatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.bgOverlay,
    borderWidth:     1,
    borderColor:     colors.borderStrong,
    justifyContent:  'center',
    alignItems:      'center',
  },
  avatarInitials: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.sm,
    fontWeight:  typography.semibold,
    color:       colors.textSecondary,
  },
  nameBlock: {
    flex: 1,
    gap:  1,
  },
  displayName: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.base,
    fontWeight:  typography.medium,
    color:       colors.textPrimary,
  },
  username: {
    fontFamily: typography.fontFamily,
    fontSize:   typography.xs,
    color:      colors.textDisabled,
  },
  hexCount: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.base,
    fontWeight:  typography.semibold,
    color:       colors.textSecondary,
    minWidth:    40,
    textAlign:   'right',
  },
  hexCountOwn: {
    color: colors.accent,
  },
  youBadge: {
    backgroundColor: colors.accent,
    borderRadius:    radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  youBadgeText: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.xs,
    fontWeight:  typography.bold,
    color:       colors.textPrimary,
    letterSpacing: 0.5,
  },
});

// ---------------------------------------------------------------------------
// Current user callout — shown above the list
// ---------------------------------------------------------------------------

interface UserCalloutProps {
  user:      RankedUser;
  above:     RankedUser | null;  // the user ranked one above
  tab:       RankingsTab;
}

function UserCallout({ user, above, tab }: UserCalloutProps): React.ReactElement {
  const zonesNeeded = above ? above.hexCount - user.hexCount : 0;
  const label       = tab === 'weekly' ? 'this week' : 'all-time';

  let message: string;
  if (user.rank === 1) {
    message = `You're #1 ${label}. Defend your throne.`;
  } else if (above && zonesNeeded > 0) {
    message = `You are #${user.rank} ${label} — ${zonesNeeded} zone${zonesNeeded === 1 ? '' : 's'} from #${user.rank - 1}.`;
  } else {
    message = `You are #${user.rank} ${label}.`;
  }

  return (
    <View style={calloutStyles.container}>
      <Text style={calloutStyles.text}>{message}</Text>
    </View>
  );
}

const calloutStyles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom:     spacing.md,
    backgroundColor:  colors.accentDim,
    borderRadius:     radius.md,
    borderWidth:      1,
    borderColor:      colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm + 4,
  },
  text: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.sm,
    fontWeight:  typography.medium,
    color:       colors.accent,
    lineHeight:  20,
  },
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState(): React.ReactElement {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.text}>No rankings yet. Start running to claim your spot.</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    paddingHorizontal: spacing.xl,
    paddingTop:     spacing.xxl,
  },
  text: {
    fontFamily: typography.fontFamily,
    fontSize:   typography.base,
    color:      colors.textDisabled,
    textAlign:  'center',
    lineHeight: 22,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function RankingsScreen(): React.ReactElement {
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<RankingsTab>('weekly');
  const [rankings, setRankings]   = useState<RankedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentUserEntry = rankings.find((r) => r.userId === user?.id) ?? null;
  const entryAbove       = currentUserEntry && currentUserEntry.rank > 1
    ? rankings.find((r) => r.rank === currentUserEntry.rank - 1) ?? null
    : null;

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadRankings = useCallback(async (tab: RankingsTab): Promise<void> => {
    setIsLoading(true);
    try {
      const data = tab === 'weekly'
        ? await getWeeklyRankings('Copenhagen')
        : await getAllTimeRankings('Copenhagen');
      setRankings(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRankings(activeTab);
  }, [activeTab, loadRankings]);

  // ── Render ────────────────────────────────────────────────────────────────

  const renderItem: ListRenderItem<RankedUser> = useCallback(
    ({ item }) => (
      <RankRow
        user={item}
        isCurrentUser={item.userId === user?.id}
      />
    ),
    [user?.id],
  );

  const keyExtractor = useCallback((item: RankedUser) => item.userId, []);

  const ListHeader = useCallback(() => (
    currentUserEntry ? (
      <UserCallout
        user={currentUserEntry}
        above={entryAbove}
        tab={activeTab}
      />
    ) : null
  ), [currentUserEntry, entryAbove, activeTab]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.screenTitle}>Rankings</Text>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['weekly', 'alltime'] as RankingsTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'weekly' ? 'Weekly' : 'All-time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={rankings}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={rankings.length === 0 ? styles.flatListEmpty : undefined}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen-level styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.bgBase,
    paddingTop:      spacing.xl,
  },
  screenTitle: {
    fontFamily:       typography.fontFamily,
    fontSize:         typography.xl,
    fontWeight:       typography.bold,
    color:            colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom:     spacing.md,
  },
  tabBar: {
    flexDirection:    'row',
    marginHorizontal: spacing.md,
    marginBottom:     spacing.md,
    backgroundColor:  colors.bgSurface,
    borderRadius:     radius.pill,
    padding:          2,
  },
  tab: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    radius.pill,
    alignItems:      'center',
  },
  tabActive: {
    backgroundColor: colors.bgElevated,
  },
  tabText: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.sm,
    fontWeight:  typography.medium,
    color:       colors.textDisabled,
  },
  tabTextActive: {
    color:      colors.textPrimary,
    fontWeight: typography.semibold,
  },
  loadingContainer: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  flatListEmpty: {
    flex: 1,
  },
});
