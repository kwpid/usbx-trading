'use server'

import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/roles';
import { fetchItemFullDetails, extractUsbxItemId } from '@/lib/usbxApi';
import { revalidatePath } from 'next/cache';

export async function scrapeItemFromLink(url: string) {
  if (!(await requireAdmin())) {
    return { success: false as const, error: 'Admins only.' };
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return { success: false as const, error: 'Enter an item link.' };
  }

  const itemId = extractUsbxItemId(trimmedUrl);
  if (!itemId) {
    return { success: false as const, error: 'That doesn\'t look like a valid USBX marketplace item URL.' };
  }

  try {
    const details = await fetchItemFullDetails(itemId);
    return { success: true as const, ...details, usbxItemId: itemId, sourceUrl: trimmedUrl };
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Could not load that item.' };
  }
}

export async function saveScrapedItem(item: {
  name: string;
  item_image_url: string;
  copies_sold: number | null;
  available_owners: number | null;
  rap: number;
  value: number;
  price_best_resale: number;
  is_limited: boolean;
  source_url: string;
}) {
  if (!(await requireAdmin())) {
    return { error: 'Admins only.' };
  }

  if (!item.name?.trim()) {
    return { error: 'Item name is required.' };
  }

  // Use the real USBX item id as our own row id — keeps /items/{id} on our
  // site aligned with USBX's own /marketplace/{id}, and lets refresh logic
  // find the item without re-parsing source_url every time.
  const usbxItemId = extractUsbxItemId(item.source_url);
  const insertPayload = usbxItemId ? { id: Number(usbxItemId), ...item } : item;

  const { data, error } = await supabase
    .from('items')
    .insert([insertPayload])
    .select();

  if (error) {
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/');
  revalidatePath('/market');

  return { success: true, item: data[0] };
}
