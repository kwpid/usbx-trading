'use server';

import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { WILDCARD_TAGS, WildcardTag } from '@/lib/tradeAdWildcards';
import { escapePostgrestValue } from '@/lib/searchSanitize';
import { revalidatePath } from 'next/cache';

const MAX_SLOTS = 6;
const COOLDOWN_MINUTES = 30;
const ITEM_FIELDS = 'id, name, item_image_url, rap, value, available_owners, copies_sold, price_best_resale, is_limited';

export type RequestSlot = { type: 'item'; itemId: number } | { type: 'wildcard'; tag: WildcardTag };

async function requireVerifiedSession() {
  const session = await getSession();
  if (!session) return { error: 'You must be logged in.' as const };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_verified')
    .eq('usbx_user_id', session.usbxUserId)
    .maybeSingle();

  if (!profile?.is_verified) {
    return { error: 'You need a verified USBX account to post trade ads.' as const };
  }
  return { usbxUserId: session.usbxUserId };
}

// The player's own limited inventory, grouped by item (with how many
// copies they hold) — this is the only source for Offer slots, since you
// can only offer what you actually own.
export async function getMyTradeAdInventory() {
  const auth = await requireVerifiedSession();
  if ('error' in auth) return [];

  const { data: ownedRows } = await supabase
    .from('item_owners')
    .select('item_id')
    .eq('owner_usbx_id', auth.usbxUserId);
  if (!ownedRows || ownedRows.length === 0) return [];

  const countByItem = new Map<number, number>();
  for (const row of ownedRows) countByItem.set(row.item_id, (countByItem.get(row.item_id) ?? 0) + 1);

  const { data: items } = await supabase
    .from('items')
    .select(ITEM_FIELDS)
    .in('id', [...countByItem.keys()])
    .eq('is_limited', true)
    .order('value', { ascending: false, nullsFirst: false });

  return (items || []).map((item) => ({ ...item, ownedCopies: countByItem.get(item.id) ?? 0 }));
}

// Catalog browse for the Request side — highest value first by default,
// same "only limiteds are tradeable" restriction as the wishlist picker.
export async function searchRequestCatalog(query: string) {
  const q = query.trim();
  let builder = supabase
    .from('items')
    .select(ITEM_FIELDS)
    .eq('is_limited', true)
    .order('value', { ascending: false, nullsFirst: false })
    .limit(30);

  if (q) {
    const esc = escapePostgrestValue(q);
    builder = builder.or(`name.ilike."%${esc}%",acronym.ilike."%${esc}%"`);
  }

  const { data, error } = await builder;
  if (error) {
    console.error('searchRequestCatalog error:', error.message);
    return [];
  }
  return data || [];
}

export type CreateTradeAdInput = {
  offerItemIds: number[];
  offerCurrencyType: 'token' | 'scrip' | null;
  offerCurrencyAmount: number | null;
  requestSlots: RequestSlot[];
  requestCurrencyType: 'token' | 'scrip' | null;
  requestCurrencyAmount: number | null;
};

// Minutes remaining before this player can post another trade ad, based on
// their own most recent ad (any status) rather than an IP — the IP-based
// rate limit below still guards against burst abuse, this is the per-person
// "one ad every 30 minutes" pace limit.
export async function getTradeAdCooldownRemaining(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;

  const { data: lastAd } = await supabase
    .from('trade_ads')
    .select('created_at')
    .eq('creator_usbx_id', session.usbxUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastAd) return 0;
  const elapsedMs = Date.now() - new Date(lastAd.created_at).getTime();
  const remainingMs = COOLDOWN_MINUTES * 60_000 - elapsedMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / 60_000) : 0;
}

export async function createTradeAd(input: CreateTradeAdInput) {
  const auth = await requireVerifiedSession();
  if ('error' in auth) return { error: auth.error };

  const ip = await getClientIp();
  if (!(await checkRateLimit(`trade-ad-create:${ip}`, 300, 5))) {
    return { error: 'Too many trade ads posted recently. Please wait a few minutes.' };
  }

  const cooldownRemaining = await getTradeAdCooldownRemaining();
  if (cooldownRemaining > 0) {
    return { error: `You can post another trade ad in ${cooldownRemaining} minute${cooldownRemaining === 1 ? '' : 's'}.` };
  }

  if (input.offerItemIds.length === 0 && !input.offerCurrencyAmount) {
    return { error: 'Add at least one item or a currency amount to your offer.' };
  }
  if (input.offerItemIds.length > MAX_SLOTS) {
    return { error: `Offer is limited to ${MAX_SLOTS} items.` };
  }
  if (input.requestSlots.length === 0 && !input.requestCurrencyAmount) {
    return { error: 'Add at least one item, wildcard, or a currency amount to your request.' };
  }
  if (input.requestSlots.length > MAX_SLOTS) {
    return { error: `Request is limited to ${MAX_SLOTS} slots.` };
  }
  for (const slot of input.requestSlots) {
    if (slot.type === 'wildcard' && !WILDCARD_TAGS.includes(slot.tag)) {
      return { error: `Unknown wildcard: ${slot.tag}` };
    }
  }

  // Verify every offered item is actually owned by this player — the offer
  // picker only ever shows owned items, but this is a server action anyone
  // could call directly with arbitrary item ids.
  if (input.offerItemIds.length > 0) {
    const { data: ownedRows } = await supabase
      .from('item_owners')
      .select('item_id')
      .eq('owner_usbx_id', auth.usbxUserId)
      .in('item_id', input.offerItemIds);
    const ownedSet = new Set((ownedRows || []).map((r) => r.item_id));
    const notOwned = input.offerItemIds.filter((id) => !ownedSet.has(id));
    if (notOwned.length > 0) {
      return { error: `You don't own one or more of the items you tried to offer.` };
    }
  }

  const { error } = await supabase.from('trade_ads').insert({
    creator_usbx_id: auth.usbxUserId,
    offer_item_ids: input.offerItemIds,
    offer_currency_type: input.offerCurrencyAmount ? input.offerCurrencyType : null,
    offer_currency_amount: input.offerCurrencyAmount || null,
    request_slots: input.requestSlots,
    request_currency_type: input.requestCurrencyAmount ? input.requestCurrencyType : null,
    request_currency_amount: input.requestCurrencyAmount || null,
  });

  if (error) return { error: error.message };

  revalidatePath('/trade-ads');
  return { success: true };
}

export async function closeTradeAd(adId: number) {
  const auth = await requireVerifiedSession();
  if ('error' in auth) return { error: auth.error };

  const { error } = await supabase
    .from('trade_ads')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', adId)
    .eq('creator_usbx_id', auth.usbxUserId);

  if (error) return { error: error.message };

  revalidatePath('/trade-ads');
  return { success: true };
}

const PAGE_SIZE = 20;

// Resolve every item and creator profile referenced across a batch of ads
// in one query each, rather than per-card.
async function resolveTradeAdRefs(ads: { offer_item_ids: number[]; request_slots: RequestSlot[]; creator_usbx_id: number }[]) {
  const itemIds = new Set<number>();
  const userIds = new Set<number>();
  for (const ad of ads) {
    for (const id of ad.offer_item_ids || []) itemIds.add(id);
    for (const slot of (ad.request_slots as RequestSlot[]) || []) {
      if (slot.type === 'item') itemIds.add(slot.itemId);
    }
    userIds.add(ad.creator_usbx_id);
  }

  // -1 is never a real id — keeps the query shape uniform instead of
  // branching on an empty array, which some PostgREST `in.()` filters choke on.
  const [{ data: items }, { data: profiles }] = await Promise.all([
    supabase.from('items').select(ITEM_FIELDS).in('id', itemIds.size > 0 ? [...itemIds] : [-1]),
    supabase.from('profiles').select('usbx_user_id, usbx_username, usbx_avatar_url').in('usbx_user_id', userIds.size > 0 ? [...userIds] : [-1]),
  ]);

  return {
    itemsById: new Map((items || []).map((i) => [i.id, i])),
    profilesById: new Map((profiles || []).map((p) => [p.usbx_user_id, p])),
  };
}

export async function getTradeAds(page: number) {
  const offset = (page - 1) * PAGE_SIZE;

  const { data: ads, count, error } = await supabase
    .from('trade_ads')
    .select('*', { count: 'exact' })
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error || !ads) {
    console.error('getTradeAds error:', error?.message);
    return { ads: [], total: 0, itemsById: new Map(), profilesById: new Map() };
  }

  const { itemsById, profilesById } = await resolveTradeAdRefs(ads);
  return { ads, total: count ?? 0, itemsById, profilesById };
}

// Every ad a given player has posted (both open and closed) — used on their
// /playertrades/[userid] page. Counts per player are small enough that we
// fetch everything and let the page filter/paginate client-side instead of
// pushing item-name search down into a jsonb query.
export async function getPlayerTradeAds(usbxUserId: number) {
  const { data: ads, error } = await supabase
    .from('trade_ads')
    .select('*')
    .eq('creator_usbx_id', usbxUserId)
    .order('created_at', { ascending: false });

  if (error || !ads) {
    console.error('getPlayerTradeAds error:', error?.message);
    return { ads: [], itemsById: new Map() };
  }

  const { itemsById } = await resolveTradeAdRefs(ads);
  return { ads, itemsById };
}
