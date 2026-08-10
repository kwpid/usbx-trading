import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const BASE_URL = 'https://usbx.trade';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 1. Static Routes
  const staticRoutes = [
    '',
    '/market',
    '/trade-calculator',
    '/trade-ads',
    '/leaderboards',
    '/player-lookup',
    '/item-value-changes',
    '/recent-sales',
    '/projected-items',
    '/badges',
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // 2. Dynamic Routes (Items)
  // Fetch all limited items to index their detail pages
  let itemRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data: items } = await supabase
      .from('items')
      .select('id, updated_at')
      .eq('is_limited', true);

    if (items) {
      itemRoutes = items.map((item) => ({
        url: `${BASE_URL}/items/${item.id}`,
        lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
        changeFrequency: 'hourly' as const,
        priority: 0.9, // High priority for item pages since they are the core content
      }));
    }
  } catch (err) {
    console.error("Sitemap item fetch error:", err);
  }

  // Combine and return
  return [...staticRoutes, ...itemRoutes];
}
