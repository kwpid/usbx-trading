import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/roles';
import { fetchAllProfileInventory, UsbxApiError } from '@/lib/usbxApi';
import { resolveUsbxAssetUrl } from '@/lib/usbxAssets';

// Admin-triggered sync always force-writes snapshots — no cooldown.
// The 6-hour cooldown only applies to lazy profile-visit snapshots in page.tsx.

const USBX_ORIGIN = 'https://beta.untitled-sandbox.com';
const BATCH_SIZE = 10; // how many players to enrich per API call to this route

// Sync strategy:
//  1. Walk the USBX RAP leaderboard (/api/leaderboards/?type=rap) using cursor
//     pagination. This gives us every player who has ever owned a limited,
//     ordered by their RAP — a much larger set than just our verified profiles.
//  2. For each batch, fetch their public inventory via /api/profiles/{id}/inventory
//     and cross-reference our item catalog to compute our custom Value metric.
//  3. Save a snapshot to player_value_history (skipping if one was already
//     taken in the last 6 hours to avoid thrashing on repeated syncs).
//  4. Upsert the player into our profiles table so the leaderboard page can
//     display their username/avatar without a separate lookup.

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // `cursor` is the USBX leaderboard cursor, not a page number.
  // The client passes back whatever nextCursor we returned.
  const cursorParam = request.nextUrl.searchParams.get('cursor');
  const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;

  // ── 1. Fetch a batch from the USBX RAP leaderboard ────────────────────────
  const lbUrl = new URL(`${USBX_ORIGIN}/api/leaderboards/`);
  lbUrl.searchParams.set('type', 'rap');
  lbUrl.searchParams.set('take', String(BATCH_SIZE));
  if (cursor !== undefined) lbUrl.searchParams.set('cursor', String(cursor));

  let lbJson: any;
  try {
    const res = await fetch(lbUrl.toString(), { cache: 'no-store' });
    lbJson = await res.json();
    if (lbJson.status !== 'success') throw new Error('Bad leaderboard response');
  } catch (err: any) {
    return NextResponse.json({ error: `Leaderboard fetch failed: ${err.message}` }, { status: 502 });
  }

  const entries: {
    rank: number;
    userId: number;
    username: string;
    headshotUrl: string | null;
    rapFreemium: number; // RAP in scrips
    limitedItemCount: number;
  }[] = lbJson.data?.entries ?? [];

  const nextCursor: number | null = lbJson.data?.nextCursor ?? null;
  const totalOnLeaderboard: number | null = null; // USBX doesn't expose a total count

  // ── 2. Load our item catalog once for this batch ───────────────────────────
  const { data: allItems } = await supabase
    .from('items')
    .select('id, rap, value')
    .eq('is_limited', true);

  const itemPricingById = new Map<number, { rap: number; value: number }>(
    (allItems ?? []).map((i) => [i.id, { rap: i.rap ?? 0, value: i.value ?? 0 }])
  );

  // ── 3. Enrich each player ──────────────────────────────────────────────────
  const results: {
    usbx_user_id: number;
    username: string;
    avatar_url: string | null;
    rank: number;
    total_rap: number;
    total_value: number;
    status: 'ok' | 'private' | 'error';
  }[] = [];

  for (const entry of entries) {
    const userId = entry.userId;
    const avatarUrl = resolveUsbxAssetUrl(entry.headshotUrl) ?? null;

    let total_rap = entry.rapFreemium; // Use USBX's authoritative RAP (in scrips)
    let total_value = 0;
    let status: 'ok' | 'private' | 'error' = 'ok';

    try {
      const inventory = await fetchAllProfileInventory(userId);

      for (const row of inventory) {
        const storeItemId = row.item.storeItemId;
        if (storeItemId == null) continue;
        const pricing = itemPricingById.get(storeItemId);
        if (!pricing) continue;
        total_value += pricing.value;
      }
    } catch (err) {
      if (err instanceof UsbxApiError && err.status === 403) {
        status = 'private';
        // Still use the RAP from the leaderboard even if inventory is private
      } else {
        status = 'error';
        total_rap = entry.rapFreemium; // Fall back to leaderboard RAP
      }
    }

    // ── 4. Upsert into profiles so leaderboard can render username/avatar ───
    await supabase
      .from('profiles')
      .upsert(
        {
          usbx_user_id: userId,
          usbx_username: entry.username,
          usbx_avatar_url: avatarUrl,
        },
        { onConflict: 'usbx_user_id' }
      );

    // ── 5. Always save a fresh snapshot — admin syncs must overwrite stale data
    await supabase.from('player_value_history').insert({
      usbx_user_id: userId,
      total_rap,
      total_value,
    });

    results.push({
      usbx_user_id: userId,
      username: entry.username,
      avatar_url: avatarUrl,
      rank: entry.rank,
      total_rap,
      total_value,
      status,
    });
  }

  return NextResponse.json({
    players: results,
    nextCursor,
    done: nextCursor === null || entries.length === 0,
    processedCount: results.length,
  });
}
