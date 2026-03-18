import { supabase } from '@/services/supabase';
import { FeedPostWithMeta } from '@/types/models';

// ---------------------------------------------------------------------------
// Types for raw Supabase rows
// ---------------------------------------------------------------------------

interface RawProfile {
  id:           string;
  username:     string;
  display_name: string | null;
  avatar_url:   string | null;
}

interface RawReaction {
  emoji:   string;
  user_id: string;
}

interface RawComment {
  id: string;
}

interface RawFeedRow {
  id:                 string;
  user_id:            string;
  run_id:             string | null;
  map_snapshot_url:   string | null;
  distance_meters:    number | null;
  hexagons_conquered: number | null;
  hexagons_stolen:    number | null;
  created_at:         string;
  profiles:           RawProfile | null;
  reactions:          RawReaction[];
  comments:           RawComment[];
}

// ---------------------------------------------------------------------------
// Row → FeedPostWithMeta
// ---------------------------------------------------------------------------

function mapRow(row: RawFeedRow, viewerId: string | null): FeedPostWithMeta {
  const reactions  = row.reactions  ?? [];
  const comments   = row.comments   ?? [];

  const viewerReaction = viewerId
    ? (reactions.find((r) => r.user_id === viewerId)?.emoji ?? null)
    : null;

  const profile = row.profiles;

  return {
    id:                 row.id,
    user_id:            row.user_id,
    run_id:             row.run_id,
    map_snapshot_url:   row.map_snapshot_url,
    distance_meters:    row.distance_meters,
    hexagons_conquered: row.hexagons_conquered,
    hexagons_stolen:    row.hexagons_stolen,
    created_at:         row.created_at,
    author: {
      id:           profile?.id           ?? row.user_id,
      username:     profile?.username     ?? 'unknown',
      display_name: profile?.display_name ?? null,
      avatar_url:   profile?.avatar_url   ?? null,
    },
    reaction_count: reactions.length,
    comment_count:  comments.length,
    viewer_reaction: viewerReaction,
  };
}

// Supabase select fragment shared by both queries
const FEED_SELECT = `
  id,
  user_id,
  run_id,
  map_snapshot_url,
  distance_meters,
  hexagons_conquered,
  hexagons_stolen,
  created_at,
  profiles ( id, username, display_name, avatar_url ),
  reactions ( emoji, user_id ),
  comments ( id )
`.trim();

// ---------------------------------------------------------------------------
// Friends feed — posts from users that userId follows
// ---------------------------------------------------------------------------

export async function getFriendsFeed(
  userId:   string,
  viewerId: string | null = userId,
  limit     = 30,
): Promise<FeedPostWithMeta[]> {
  // Fetch the IDs of users that userId follows
  const { data: followRows, error: followError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (followError) {
    console.error('[feedService] getFriendsFeed follows error:', followError.message);
    return [];
  }

  const followingIds: string[] = (followRows ?? []).map((r) => r.following_id as string);
  // Always include the viewer's own posts in their friends feed
  const authorIds = [...new Set([...followingIds, userId])];

  const { data, error } = await supabase
    .from('feed_posts')
    .select(FEED_SELECT)
    .in('user_id', authorIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[feedService] getFriendsFeed error:', error.message);
    return [];
  }

  return ((data ?? []) as unknown as RawFeedRow[]).map((row) => mapRow(row, viewerId));
}

// ---------------------------------------------------------------------------
// Global feed — all recent posts in a city
// ---------------------------------------------------------------------------

export async function getGlobalFeed(
  city:     string  = 'Copenhagen',
  viewerId: string | null = null,
  limit     = 50,
): Promise<FeedPostWithMeta[]> {
  // Join feed_posts → profiles → filter by profiles.city
  const { data, error } = await supabase
    .from('feed_posts')
    .select(`${FEED_SELECT}, profiles!inner ( city )`)
    .eq('profiles.city', city)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[feedService] getGlobalFeed error:', error.message);
    return [];
  }

  return ((data ?? []) as unknown as RawFeedRow[]).map((row) => mapRow(row, viewerId));
}

// ---------------------------------------------------------------------------
// Toggle reaction — upsert or delete based on current viewer reaction
// ---------------------------------------------------------------------------

export async function toggleReaction(
  postId:  string,
  userId:  string,
  emoji:   string,
  current: string | null,   // viewer's existing reaction emoji, or null
): Promise<void> {
  if (current === emoji) {
    // Same emoji tapped again — remove the reaction
    await supabase
      .from('reactions')
      .delete()
      .match({ post_id: postId, user_id: userId });
  } else {
    // New or different emoji — upsert (unique constraint: post_id + user_id)
    await supabase
      .from('reactions')
      .upsert(
        { post_id: postId, user_id: userId, emoji },
        { onConflict: 'post_id,user_id' },
      );
  }
}
