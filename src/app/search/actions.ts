'use server';

import { supabase } from '@/lib/supabase';

export async function searchLimitedsAction(query: string) {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from('items')
    .select('id, name, item_image_url, rap, value, available_owners')
    .or(`name.ilike.%${q}%,acronym.ilike.%${q}%`)
    .order('value', { ascending: false })
    .limit(15);

  if (error) {
    console.error('searchLimitedsAction error:', error.message);
    return [];
  }

  return data || [];
}
