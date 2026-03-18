// Core domain model interfaces — derived from the database schema in CLAUDE.md section 7.
// Keep these in sync with src/types/database.ts (Supabase generated types) when that file is created.

export interface UserProfile {
  id: string;                  // UUID — references auth.users(id)
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string;                // Default: 'Copenhagen'
  hex_count_total: number;
  hex_count_current: number;
  streak_current: number;
  streak_longest: number;
  created_at: string;          // ISO 8601 timestamptz
  updated_at: string;
}

export interface Hexagon {
  h3_index: string;            // Primary key — H3 cell index string
  owner_id: string | null;     // UUID — references profiles(id)
  city: string;                // Default: 'Copenhagen'
  conquered_at: string;        // ISO 8601 timestamptz
  previous_owner_id: string | null;
  conquest_count: number;
}

// Hexagon enriched with owner profile data — used for map rendering and notifications
export interface HexagonWithOwner extends Hexagon {
  owner: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
}

export interface Run {
  id: string;                  // UUID
  user_id: string;             // UUID — references profiles(id)
  started_at: string;          // ISO 8601 timestamptz
  ended_at: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  hexagons_conquered: number;
  hexagons_stolen: number;
  hexagons_lost: number;
  map_snapshot_url: string | null;
  created_at: string;
}

export interface FeedPost {
  id: string;                  // UUID
  user_id: string;             // UUID — references profiles(id)
  run_id: string | null;       // UUID — references runs(id)
  map_snapshot_url: string | null;
  distance_meters: number | null;
  hexagons_conquered: number | null;
  hexagons_stolen: number | null;
  created_at: string;
}

// FeedPost enriched with author + reaction/comment counts — used in FeedScreen
export interface FeedPostWithMeta extends FeedPost {
  author: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  reaction_count: number;
  comment_count: number;
  viewer_reaction: string | null; // emoji the current viewer reacted with, or null
}

export interface Reaction {
  id: string;                  // UUID
  post_id: string;             // UUID — references feed_posts(id)
  user_id: string;             // UUID — references profiles(id)
  emoji: string;
  created_at: string;
}

export interface Comment {
  id: string;                  // UUID
  post_id: string;             // UUID — references feed_posts(id)
  user_id: string;             // UUID — references profiles(id)
  content: string;
  created_at: string;
}

// Comment enriched with author data — used when rendering comment threads
export interface CommentWithAuthor extends Comment {
  author: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface WeeklyRanking {
  id: string;                  // UUID
  user_id: string;             // UUID — references profiles(id)
  city: string;                // Default: 'Copenhagen'
  week_start: string;          // ISO 8601 date (YYYY-MM-DD)
  hexagons_conquered: number;
  rank: number | null;
}

// WeeklyRanking enriched with profile data — used in RankingsScreen
export interface WeeklyRankingWithProfile extends WeeklyRanking {
  profile: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}
