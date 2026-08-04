'use server'

import { searchSite } from '@/lib/usbxApi';
import { resolveUsbxAssetUrl } from '@/lib/usbxAssets';

export async function searchPlayers(query: string) {
  if (!query.trim()) return [];
  try {
    const results = await searchSite(query);
    return results
      .filter((r) => r.type === 'user')
      .map((r) => ({ ...r, imageUrl: resolveUsbxAssetUrl(r.imageUrl) }));
  } catch (err) {
    console.error('searchPlayers error:', err);
    return [];
  }
}
