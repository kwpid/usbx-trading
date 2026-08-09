'use server'

import { searchSite } from '@/lib/usbxApi';
import { resolveUsbxAssetUrl } from '@/lib/usbxAssets';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getInlineBadges } from '@/lib/inlineBadge';

export async function searchPlayers(query: string) {
  if (!query.trim()) return [];
  try {
    // This hits the live USBX search API (via our proxy) on every call, so
    // it's rate-limited tighter than the DB-only item search above.
    const ip = await getClientIp();
    if (!(await checkRateLimit(`search-players:${ip}`, 60, 30))) return [];

    const results = await searchSite(query);
    const players = results
      .filter((r) => r.type === 'user')
      .map((r) => ({ id: r.id, username: r.title, avatarUrl: resolveUsbxAssetUrl(r.imageUrl) }));

    if (players.length === 0) return [];

    const inlineBadges = await getInlineBadges(players.map((p) => p.id));

    // Enrich with rank/value/RAP from our own leaderboard snapshot, same
    // data source and ranking the leaderboards page itself uses — cards
    // read the same everywhere on the site instead of a bare list here.
    const { data: leaderData } = await supabase.rpc('get_latest_player_snapshots');
    if (!leaderData) {
      return players.map((p) => ({ ...p, inlineBadge: inlineBadges.get(p.id) ?? null }));
    }

    const sorted = [...leaderData].sort((a: any, b: any) => (b.total_value ?? 0) - (a.total_value ?? 0));
    const rankById = new Map<number, number>();
    const statsById = new Map<number, { totalValue: number; totalRap: number }>();
    sorted.forEach((row: any, idx: number) => {
      rankById.set(row.usbx_user_id, idx + 1);
      statsById.set(row.usbx_user_id, { totalValue: row.total_value ?? 0, totalRap: row.total_rap ?? 0 });
    });

    return players.map((p) => ({
      ...p,
      rank: rankById.get(p.id) ?? null,
      totalValue: statsById.get(p.id)?.totalValue ?? null,
      totalRap: statsById.get(p.id)?.totalRap ?? null,
      inlineBadge: inlineBadges.get(p.id) ?? null,
    }));
  } catch (err) {
    console.error('searchPlayers error:', err);
    return [];
  }
}
