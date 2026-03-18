import { supabase } from '@/services/supabase';
import { WeeklyRankingWithProfile } from '@/types/models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RankedUser {
  rank:         number;
  userId:       string;
  username:     string;
  displayName:  string | null;
  avatarUrl:    string | null;
  hexCount:     number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISO date string for the most recent Monday (start of current week). */
function currentWeekStart(): string {
  const now  = new Date();
  const day  = now.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Weekly rankings — from rankings_weekly table
// ---------------------------------------------------------------------------

export async function getWeeklyRankings(
  city  = 'Copenhagen',
  limit = 50,
): Promise<RankedUser[]> {
  const weekStart = currentWeekStart();

  const { data, error } = await supabase
    .from('rankings_weekly')
    .select(`
      rank,
      hexagons_conquered,
      user_id,
      profiles ( id, username, display_name, avatar_url )
    `)
    .eq('city', city)
    .eq('week_start', weekStart)
    .order('rank', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[rankingsService] getWeeklyRankings error:', error.message);
    return [];
  }

  type WeeklyRow = {
    rank:               number | null;
    hexagons_conquered: number;
    user_id:            string;
    profiles:           unknown;  // Supabase returns joined rows as array; cast below
  };

  return ((data ?? []) as unknown as WeeklyRow[]).map((row, idx) => {
    const profilesRaw = row.profiles;
    const profile     = (Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw) as
      { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
    return {
      rank:        row.rank ?? idx + 1,
      userId:      row.user_id,
      username:    profile?.username     ?? 'unknown',
      displayName: profile?.display_name ?? null,
      avatarUrl:   profile?.avatar_url   ?? null,
      hexCount:    row.hexagons_conquered,
    };
  });
}

// ---------------------------------------------------------------------------
// All-time rankings — from profiles table ordered by hex_count_total
// ---------------------------------------------------------------------------

export async function getAllTimeRankings(
  city  = 'Copenhagen',
  limit = 50,
): Promise<RankedUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, hex_count_total')
    .eq('city', city)
    .order('hex_count_total', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[rankingsService] getAllTimeRankings error:', error.message);
    return [];
  }

  return ((data ?? []) as Array<{
    id:              string;
    username:        string;
    display_name:    string | null;
    avatar_url:      string | null;
    hex_count_total: number;
  }>).map((row, idx) => ({
    rank:        idx + 1,
    userId:      row.id,
    username:    row.username,
    displayName: row.display_name,
    avatarUrl:   row.avatar_url,
    hexCount:    row.hex_count_total,
  }));
}
