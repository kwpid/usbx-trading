import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/roles';
import { fetchAllProfileInventory, fetchRapLeaderboard, UsbxApiError, UsbxRapLeaderboardEntry } from '@/lib/usbxApi';
import { resolveUsbxAssetUrl } from '@/lib/usbxAssets';
import { BADGES, BadgeCollectible } from '@/lib/badges';
import { SnapshotItem } from '@/lib/snapshot';

// Admin-triggered sync always force-writes snapshots — no cooldown.
// The 6-hour cooldown only applies to lazy profile-visit snapshots in page.tsx.

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
  let entries: UsbxRapLeaderboardEntry[];
  let nextCursor: number | null;
  try {
    const result = await fetchRapLeaderboard(BATCH_SIZE, cursor);
    entries = result.entries;
    nextCursor = result.nextCursor;
  } catch (err: any) {
    return NextResponse.json({ error: `Leaderboard fetch failed: ${err.message}` }, { status: 502 });
  }

  const totalOnLeaderboard: number | null = null; // USBX doesn't expose a total count

  // ── 2. Load our item catalog once for this batch ───────────────────────────
  const { data: allItems } = await supabase
    .from('items')
    .select('id, name, rap, value, available_owners, copies_sold, item_image_url')
    .eq('is_limited', true);

  const itemPricingById = new Map<
    number,
    { rap: number; value: number; name: string; availableOwners: number | null; copiesSold: number | null; imageUrl: string | null }
  >(
    (allItems ?? []).map((i) => [
      i.id,
      { rap: i.rap ?? 0, value: i.value ?? 0, name: i.name, availableOwners: i.available_owners, copiesSold: i.copies_sold, imageUrl: i.item_image_url },
    ])
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

  // Badges each of these players already have, fetched once for the whole
  // batch. Grants collected here and inserted in one query at the end.
  const ownedBadgesByUser = new Map<number, Set<string>>();
  if (entries.length > 0) {
    const { data: existingBadgeRows } = await supabase
      .from('player_badges')
      .select('usbx_user_id, badge_id')
      .in('usbx_user_id', entries.map((e) => e.userId));

    for (const row of existingBadgeRows || []) {
      const set = ownedBadgesByUser.get(row.usbx_user_id) ?? new Set<string>();
      set.add(row.badge_id);
      ownedBadgesByUser.set(row.usbx_user_id, set);
    }
  }

  const badgeRowsToInsert: { usbx_user_id: number; badge_id: string }[] = [];

  for (const entry of entries) {
    const userId = entry.userId;
    const avatarUrl = resolveUsbxAssetUrl(entry.headshotUrl) ?? null;

    let total_rap = entry.rapFreemium; // Use USBX's authoritative RAP (in scrips)
    let total_value = 0;
    let status: 'ok' | 'private' | 'error' = 'ok';
    const collectiblesMap = new Map<number, BadgeCollectible>();
    const snapshotItemsMap = new Map<number, SnapshotItem>();

    try {
      const inventory = await fetchAllProfileInventory(userId);

      for (const row of inventory) {
        const storeItemId = row.item.storeItemId;
        if (storeItemId == null) continue;
        const pricing = itemPricingById.get(storeItemId);
        if (!pricing) continue;
        total_value += pricing.value;

        const serialNumber = row.serialNumber || '?';
        const copy = { serialNumber };
        const existing = collectiblesMap.get(storeItemId);
        if (existing) {
          existing.copies.push(copy);
        } else {
          collectiblesMap.set(storeItemId, {
            name: pricing.name || row.item.name,
            copiesSold: pricing.copiesSold,
            copies: [copy],
          });
        }

        const existingSnapshot = snapshotItemsMap.get(storeItemId);
        if (existingSnapshot) {
          existingSnapshot.copies += 1;
          existingSnapshot.serials.push(serialNumber);
        } else {
          snapshotItemsMap.set(storeItemId, {
            id: storeItemId,
            name: pricing.name || row.item.name,
            imageUrl: pricing.imageUrl || row.item.resolvedPreviewUrl || null,
            rap: pricing.rap,
            value: pricing.value,
            copies: 1,
            serials: [serialNumber],
          });
        }
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
      inventory_snapshot: [...snapshotItemsMap.values()],
    });

    // ── 6. Check badge eligibility against this refreshed data ──────────────
    const ownedBadges = ownedBadgesByUser.get(userId) ?? new Set<string>();
    const badgeCtx = { usbxUserId: userId, totalValue: total_value, collectibles: [...collectiblesMap.values()] };
    for (const badge of BADGES) {
      if (!ownedBadges.has(badge.id) && badge.check(badgeCtx)) {
        badgeRowsToInsert.push({ usbx_user_id: userId, badge_id: badge.id });
      }
    }

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

  let badgesAwarded = 0;
  if (badgeRowsToInsert.length > 0) {
    const { error: badgeInsertErr } = await supabase.from('player_badges').insert(badgeRowsToInsert);
    if (badgeInsertErr) {
      console.error('Failed to insert badges during player sync:', badgeInsertErr.message);
    } else {
      badgesAwarded = badgeRowsToInsert.length;
    }
  }

  return NextResponse.json({
    players: results,
    nextCursor,
    done: nextCursor === null || entries.length === 0,
    processedCount: results.length,
    badgesAwarded,
  });
}
