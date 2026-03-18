import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  ListRenderItem,
} from 'react-native';

import { useAuthStore } from '@/store/authStore';
import { getFriendsFeed, getGlobalFeed, toggleReaction } from '@/services/feedService';
import { FeedPostWithMeta } from '@/types/models';
import { colors, typography, spacing, radius } from '@/utils/constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REACTION_EMOJIS = ['🔥', '💪', '👑', '⚡️'];

type FeedTab = 'friends' | 'global';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getInitials(displayName: string | null, username: string): string {
  const name = displayName ?? username;
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface AvatarProps {
  displayName: string | null;
  username:    string;
}

function Avatar({ displayName, username }: AvatarProps): React.ReactElement {
  return (
    <View style={avatarStyles.circle}>
      <Text style={avatarStyles.initials}>
        {getInitials(displayName, username)}
      </Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  circle: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.bgOverlay,
    borderWidth:     1,
    borderColor:     colors.borderStrong,
    justifyContent:  'center',
    alignItems:      'center',
  },
  initials: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.sm,
    fontWeight:  typography.semibold,
    color:       colors.textSecondary,
  },
});

// ---------------------------------------------------------------------------

interface PostCardProps {
  post:       FeedPostWithMeta;
  onReact:    (postId: string, emoji: string, current: string | null) => void;
}

function PostCard({ post, onReact }: PostCardProps): React.ReactElement {
  const conquered = post.hexagons_conquered ?? 0;
  const stolen    = post.hexagons_stolen    ?? 0;
  const name      = post.author.display_name ?? post.author.username;

  return (
    <View style={cardStyles.card}>
      {/* Header */}
      <View style={cardStyles.header}>
        <Avatar displayName={post.author.display_name} username={post.author.username} />

        <View style={cardStyles.headerText}>
          <Text style={cardStyles.authorName}>{name}</Text>
          <Text style={cardStyles.timeAgo}>{timeAgo(post.created_at)}</Text>
        </View>
      </View>

      {/* Map snapshot placeholder */}
      <View style={cardStyles.mapPlaceholder}>
        <Text style={cardStyles.mapPlaceholderText}>Map snapshot coming soon</Text>
      </View>

      {/* Run stats — microcopy follows CLAUDE.md section 14 */}
      <View style={cardStyles.stats}>
        {conquered > 0 && (
          <Text style={cardStyles.statText}>
            Conquered {conquered} {conquered === 1 ? 'zone' : 'zones'}
          </Text>
        )}
        {stolen > 0 && (
          <Text style={[cardStyles.statText, cardStyles.statTextStolen]}>
            Stole {stolen} {stolen === 1 ? 'zone' : 'zones'}
          </Text>
        )}
      </View>

      {/* Reaction bar */}
      <View style={cardStyles.reactionBar}>
        {REACTION_EMOJIS.map((emoji) => {
          const isActive = post.viewer_reaction === emoji;
          return (
            <TouchableOpacity
              key={emoji}
              style={[cardStyles.reactionBtn, isActive && cardStyles.reactionBtnActive]}
              onPress={() => onReact(post.id, emoji, post.viewer_reaction)}
              activeOpacity={0.7}
            >
              <Text style={cardStyles.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}

        {post.reaction_count > 0 && (
          <Text style={cardStyles.reactionCount}>{post.reaction_count}</Text>
        )}

        <Text style={cardStyles.commentCount}>
          {post.comment_count > 0
            ? `${post.comment_count} comment${post.comment_count === 1 ? '' : 's'}`
            : 'No comments'}
        </Text>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.borderSubtle,
    marginHorizontal: spacing.md,
    marginBottom:    spacing.md,
    overflow:        'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    padding:       spacing.md,
  },
  headerText: {
    flex: 1,
    gap:  2,
  },
  authorName: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.base,
    fontWeight:  typography.semibold,
    color:       colors.textPrimary,
  },
  timeAgo: {
    fontFamily: typography.fontFamily,
    fontSize:   typography.xs,
    color:      colors.textDisabled,
  },
  mapPlaceholder: {
    height:          160,
    backgroundColor: colors.bgElevated,
    justifyContent:  'center',
    alignItems:      'center',
  },
  mapPlaceholderText: {
    fontFamily: typography.fontFamily,
    fontSize:   typography.sm,
    color:      colors.textDisabled,
  },
  stats: {
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.sm,
    gap:               spacing.xs,
  },
  statText: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.sm,
    fontWeight:  typography.medium,
    color:       colors.textSecondary,
  },
  statTextStolen: {
    color: colors.teal,
  },
  reactionBar: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.xs,
    padding:        spacing.md,
    paddingTop:     spacing.sm,
  },
  reactionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.pill,
    backgroundColor:   colors.bgElevated,
  },
  reactionBtnActive: {
    backgroundColor: colors.accentDim,
    borderWidth:     1,
    borderColor:     colors.accent,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontFamily:  typography.fontFamily,
    fontSize:    typography.sm,
    fontWeight:  typography.medium,
    color:       colors.textSecondary,
    marginLeft:  spacing.xs,
  },
  commentCount: {
    fontFamily: typography.fontFamily,
    fontSize:   typography.sm,
    color:      colors.textDisabled,
    marginLeft: 'auto',
  },
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState(): React.ReactElement {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.text}>
        No runs yet. Be the first to conquer Copenhagen.
      </Text>
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
    fontFamily:  typography.fontFamily,
    fontSize:    typography.base,
    color:       colors.textDisabled,
    textAlign:   'center',
    lineHeight:  22,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function FeedScreen(): React.ReactElement {
  const { user } = useAuthStore();

  const [activeTab, setActiveTab]   = useState<FeedTab>('friends');
  const [posts, setPosts]           = useState<FeedPostWithMeta[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadFeed = useCallback(async (tab: FeedTab, refreshing = false): Promise<void> => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      let fetched: FeedPostWithMeta[];
      if (tab === 'friends' && user) {
        fetched = await getFriendsFeed(user.id, user.id);
      } else {
        fetched = await getGlobalFeed('Copenhagen', user?.id ?? null);
      }
      setPosts(fetched);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadFeed(activeTab);
  }, [activeTab, loadFeed]);

  // ── Reaction handler ──────────────────────────────────────────────────────

  const handleReact = useCallback(async (
    postId:  string,
    emoji:   string,
    current: string | null,
  ): Promise<void> => {
    if (!user) return;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const removing         = current === emoji;
        const viewer_reaction  = removing ? null : emoji;
        const reaction_count   = p.reaction_count + (removing ? -1 : current ? 0 : 1);
        return { ...p, viewer_reaction, reaction_count };
      }),
    );

    await toggleReaction(postId, user.id, emoji, current);
  }, [user]);

  // ── Render ────────────────────────────────────────────────────────────────

  const renderItem: ListRenderItem<FeedPostWithMeta> = useCallback(
    ({ item }) => <PostCard post={item} onReact={handleReact} />,
    [handleReact],
  );

  const keyExtractor = useCallback((item: FeedPostWithMeta) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['friends', 'global'] as FeedTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'friends' ? 'Friends' : 'Global'}
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
          data={posts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={posts.length === 0 ? styles.flatListEmpty : styles.flatListContent}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadFeed(activeTab, true)}
              tintColor={colors.accent}
            />
          }
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
  tabBar: {
    flexDirection:   'row',
    marginHorizontal: spacing.md,
    marginBottom:    spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius:    radius.pill,
    padding:         spacing.xs / 2,
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
    color:       colors.textPrimary,
    fontWeight:  typography.semibold,
  },
  loadingContainer: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  flatListContent: {
    paddingTop: spacing.xs,
  },
  flatListEmpty: {
    flex: 1,
  },
});
