'use server';

import { supabase } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { escapePostgrestValue } from '@/lib/searchSanitize';

export async function searchLimitedsAction(query: string) {
  const q = query.trim();
  if (!q) return [];

  const ip = await getClientIp();
  if (!(await checkRateLimit(`search-limiteds:${ip}`, 60, 60))) return [];

  const esc = escapePostgrestValue(q);
  const { data, error } = await supabase
    .from('items')
    .select('id, name, item_image_url, rap, value, available_owners')
    .or(`name.ilike."%${esc}%",acronym.ilike."%${esc}%"`)
    .order('value', { ascending: false })
    .limit(15);

  if (error) {
    console.error('searchLimitedsAction error:', error.message);
    return [];
  }

  return data || [];
}
