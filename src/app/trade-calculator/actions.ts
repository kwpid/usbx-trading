'use server'

import { supabase } from '@/lib/supabase';

export async function searchTradeItems(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('items')
    .select('id, name, item_image_url, rap, value')
    .ilike('name', `%${trimmed}%`)
    .order('value', { ascending: false, nullsFirst: false })
    .limit(15);

  if (error) {
    console.error('searchTradeItems error:', error.message);
    return [];
  }
  return data ?? [];
}
