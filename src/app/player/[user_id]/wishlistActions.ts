'use server';

import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { escapePostgrestValue } from '@/lib/searchSanitize';
import { revalidatePath } from 'next/cache';

const MAX_WISHLIST_ITEMS = 6;

const WISHLIST_ITEM_FIELDS = 'id, name, item_image_url, rap, value, available_owners';

export async function addToWishlist(itemId: number) {
  const session = await getSession();
  if (!session) return { error: 'You must be logged in.' };

  // Only limited items can be wishlisted — check server-side too, not just
  // in the picker UI, since this is a server action anyone could call directly.
  const { data: item } = await supabase.from('items').select('is_limited').eq('id', itemId).single();
  if (!item?.is_limited) {
    return { error: 'Only limited items can be added to your wishlist.' };
  }

  const { count } = await supabase
    .from('player_wishlist')
    .select('*', { count: 'exact', head: true })
    .eq('usbx_user_id', session.usbxUserId);

  if ((count ?? 0) >= MAX_WISHLIST_ITEMS) {
    return { error: `Wishlist is limited to ${MAX_WISHLIST_ITEMS} items.` };
  }

  const { error } = await supabase
    .from('player_wishlist')
    .insert({ usbx_user_id: session.usbxUserId, item_id: itemId });

  if (error) {
    // Already on the wishlist — not a real failure, just a no-op.
    if (error.code === '23505') return { success: true };
    return { error: error.message };
  }

  revalidatePath(`/player/${session.usbxUserId}`);
  return { success: true };
}

// Highest-value limiteds, shown in the picker before the player types
// anything so there's always something to browse.
export async function getTopWishlistCandidates() {
  const { data, error } = await supabase
    .from('items')
    .select(WISHLIST_ITEM_FIELDS)
    .eq('is_limited', true)
    .order('value', { ascending: false })
    .limit(12);
  if (error) {
    console.error('getTopWishlistCandidates error:', error.message);
    return [];
  }
  return data || [];
}

// Same shape as searchLimitedsAction but restricted to limited items only,
// since those are the only items allowed on a wishlist.
export async function searchWishlistCandidates(query: string) {
  const q = query.trim();
  if (!q) return getTopWishlistCandidates();

  const esc = escapePostgrestValue(q);
  const { data, error } = await supabase
    .from('items')
    .select(WISHLIST_ITEM_FIELDS)
    .eq('is_limited', true)
    .or(`name.ilike."%${esc}%",acronym.ilike."%${esc}%"`)
    .order('value', { ascending: false })
    .limit(15);

  if (error) {
    console.error('searchWishlistCandidates error:', error.message);
    return [];
  }
  return data || [];
}

export async function removeFromWishlist(itemId: number) {
  const session = await getSession();
  if (!session) return { error: 'You must be logged in.' };

  const { error } = await supabase
    .from('player_wishlist')
    .delete()
    .eq('usbx_user_id', session.usbxUserId)
    .eq('item_id', itemId);

  if (error) return { error: error.message };

  revalidatePath(`/player/${session.usbxUserId}`);
  return { success: true };
}
