'use server'

import { supabase } from '@/lib/supabase';
import { escapePostgrestValue } from '@/lib/searchSanitize';

export async function searchTradeItems(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const esc = escapePostgrestValue(trimmed);
  const { data, error } = await supabase
    .from('items')
    .select('id, name, item_image_url, rap, value, available_owners, copies_sold, is_limited')
    .or(`name.ilike."%${esc}%",acronym.ilike."%${esc}%"`)
    .order('value', { ascending: false, nullsFirst: false })
    .limit(30);

  if (error) {
    console.error('searchTradeItems error:', error.message);
    return [];
  }
  return data ?? [];
}
