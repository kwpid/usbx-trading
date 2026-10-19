'use server';

import { supabase } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { escapePostgrestValue } from '@/lib/searchSanitize';
import { fetchMissingItemById } from '@/lib/itemAutoFetch';
import { revalidatePath } from 'next/cache';

const ITEM_FIELDS = 'id, name, item_image_url, rap, value, available_owners, copies_sold';

export async function searchLimitedsAction(query: string) {
  const q = query.trim();
  if (!q) return [];

  const ip = await getClientIp();
  if (!(await checkRateLimit(`search-limiteds:${ip}`, 60, 60))) return [];

  const esc = escapePostgrestValue(q);
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_FIELDS)
    .or(`name.ilike."%${esc}%",acronym.ilike."%${esc}%"`)
    .order('value', { ascending: false })
    .limit(15);

  if (error) {
    console.error('searchLimitedsAction error:', error.message);
    return [];
  }

  return data || [];
}

// Fallback for when the catalog sync hasn't picked an item up yet (new
// release, missed poll cycle). Only reachable when a search for a numeric id
// comes back empty, so this stays rare enough that the per-IP limit below is
// plenty generous for a real user and still bounds the cost of someone
// scripting sequential ids at us.
export async function fetchMissingItemAction(rawId: string) {
  const result = await fetchMissingItemById(rawId);
  if ('item' in result) {
    // Safe here (a real server action, not render) unlike inside the item
    // page's own render path, where calling this throws.
    revalidatePath('/');
    revalidatePath('/market');
  }
  return result;
}
