'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { BADGES, BadgeCollectible } from "@/lib/badges";
import { SnapshotItem } from "@/lib/snapshot";

// One row per player per UTC calendar day — lets the profile chart offer a
// real "what did they own on this date" history without the table growing
// unbounded from repeat same-day visits. If today's row already exists it's
// refreshed in place (latest data for the day wins); otherwise a new row is
// inserted.
export async function recordPlayerSnapshot(
  userId: string,
  totalRap: number,
  totalValue: number,
  inventorySnapshot: SnapshotItem[]
) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: todaySnapshot } = await supabase
    .from('player_value_history')
    .select('id, total_rap, total_value')
    .eq('usbx_user_id', userId)
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (todaySnapshot) {
    const changed = todaySnapshot.total_rap !== totalRap || todaySnapshot.total_value !== totalValue;
    if (changed) {
      const { error } = await supabase
        .from('player_value_history')
        .update({ total_rap: totalRap, total_value: totalValue, inventory_snapshot: inventorySnapshot })
        .eq('id', todaySnapshot.id);
      if (error) {
        console.error('Failed to update player snapshot:', error.message);
        return;
      }
      revalidatePath('/leaderboards');
    }
    return;
  }

  const { error } = await supabase.from('player_value_history').insert({
    usbx_user_id: userId,
    total_rap: totalRap,
    total_value: totalValue,
    inventory_snapshot: inventorySnapshot,
  });
  if (error) {
    console.error('Failed to insert player snapshot:', error.message);
    return;
  }
  revalidatePath('/leaderboards');
}

// Evaluates every badge definition against this player's current inventory
// and grants any newly-eligible ones. Badges are permanent once granted —
// this only ever adds rows, never removes them (that's the admin reset
// action's job). Safe to call on every profile visit.
export async function checkAndAwardBadges(userId: string, totalValue: number, collectibles: BadgeCollectible[]) {
  const { data: existing } = await supabase
    .from('player_badges')
    .select('badge_id')
    .eq('usbx_user_id', userId);

  const owned = new Set((existing || []).map((r) => r.badge_id));
  const ctx = { usbxUserId: Number(userId), totalValue, collectibles };
  const toAward = BADGES.filter((b) => !owned.has(b.id) && b.check(ctx));

  if (toAward.length === 0) return;

  const { error } = await supabase
    .from('player_badges')
    .insert(toAward.map((b) => ({ usbx_user_id: userId, badge_id: b.id })));

  if (error) {
    console.error('Failed to award badges:', error.message);
    return;
  }

  revalidatePath(`/player/${userId}`);
}
