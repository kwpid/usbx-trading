import 'server-only';
import { supabase } from './supabase';
import { BADGES_BY_ID, BadgeDef, INLINE_BADGE_PRIORITY } from './badges';

// BadgeDef.check is a function, which can't cross a server action / Server
// Component boundary into a Client Component (searchPlayers() results get
// stored in client state via PlayerResultCard). Strip it here at the source
// so nothing downstream has to remember to do it.
export type InlineBadgeInfo = Omit<BadgeDef, 'check'>;

function toInlineBadgeInfo(def: BadgeDef): InlineBadgeInfo {
  const { id, name, description, icon, tier, category } = def;
  return { id, name, description, icon, tier, category };
}

// The single highest-priority badge to show inline next to each player's
// name (developer > value_mod > verified). Developer/value_mod are manual
// grants read from player_badges. Verified is read straight off
// profiles.is_verified instead — that column is only ever set true inside
// completeVerification(), whereas a player_badges "verified" row could in
// theory get out of sync with it, and profiles.is_verified is the one
// source nothing else writes to.
export async function getInlineBadges(usbxUserIds: (number | string)[]): Promise<Map<number, InlineBadgeInfo>> {
  const ids = [...new Set(usbxUserIds.map((id) => Number(id)))].filter((id) => !Number.isNaN(id));
  if (ids.length === 0) return new Map();

  const manualBadgeIds = INLINE_BADGE_PRIORITY.filter((id) => id !== 'verified');

  const [{ data: badgeRows }, { data: verifiedRows }] = await Promise.all([
    supabase
      .from('player_badges')
      .select('usbx_user_id, badge_id')
      .in('usbx_user_id', ids)
      .in('badge_id', manualBadgeIds),
    supabase
      .from('profiles')
      .select('usbx_user_id')
      .in('usbx_user_id', ids)
      .eq('is_verified', true),
  ]);

  const badgesByUser = new Map<number, Set<string>>();
  for (const row of badgeRows || []) {
    const set = badgesByUser.get(row.usbx_user_id) ?? new Set<string>();
    set.add(row.badge_id);
    badgesByUser.set(row.usbx_user_id, set);
  }
  const verifiedIds = new Set((verifiedRows || []).map((r) => r.usbx_user_id));

  const result = new Map<number, InlineBadgeInfo>();
  for (const id of ids) {
    const owned = badgesByUser.get(id);
    for (const badgeId of INLINE_BADGE_PRIORITY) {
      const has = badgeId === 'verified' ? verifiedIds.has(id) : Boolean(owned?.has(badgeId));
      if (has) {
        const def = BADGES_BY_ID.get(badgeId);
        if (def) result.set(id, toInlineBadgeInfo(def));
        break;
      }
    }
  }
  return result;
}

export async function getInlineBadge(usbxUserId: number | string): Promise<InlineBadgeInfo | null> {
  const map = await getInlineBadges([usbxUserId]);
  return map.get(Number(usbxUserId)) ?? null;
}
