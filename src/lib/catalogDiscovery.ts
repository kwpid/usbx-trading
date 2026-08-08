import { supabase } from './supabase';
import { fetchMarketplaceListings, fetchItemRap, UsbxMarketplaceListing } from './usbxApi';
import { tokensToScrips } from './currency';
import { syncItemOwners } from './itemOwnersSync';

function toScrips(amount: number, currencyCode: string | null | undefined) {
  return currencyCode !== 'SCRIPS' ? tokensToScrips(amount) : Math.round(amount);
}

async function catalogOneListing(listing: UsbxMarketplaceListing): Promise<boolean> {
  const itemId = listing.id; // our primary key = the store listing id, matches USBX's own /marketplace/{id} URL
  const isLimited = listing.item.normalDetails?.isLimited ?? false;

  try {
    const [rapData, { uniqueOwners }] = await Promise.all([
      fetchItemRap(itemId).catch(() => null),
      syncItemOwners(itemId, itemId),
    ]);

    const rapScrips = rapData?.rap != null ? toScrips(rapData.rap, rapData.currencyCode) : null;
    const priceScrips = listing.price != null ? toScrips(listing.price, listing.currencyUsed?.code) : null;

    const { error } = await supabase.from('items').upsert(
      {
        id: itemId,
        listing_id: itemId,
        catalog_item_id: listing.item.id,
        name: listing.item.name,
        item_image_url: listing.item.resolvedPreviewUrl,
        is_limited: isLimited,
        price_best_resale: priceScrips,
        rap: rapScrips,
        total_sales: rapData?.totalSales ?? null,
        available_owners: isLimited ? uniqueOwners : null,
        source_url: `https://beta.untitled-sandbox.com/marketplace/${itemId}`,
        data_refreshed_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) throw new Error(error.message);
    return true;
  } catch (err: any) {
    console.warn(`Failed to catalog new item ${listing.id}: ${err.message}`);
    return false;
  }
}

// Checks the newest ~50 live marketplace listings for anything not yet in
// our catalog and syncs it immediately. This is what makes a freshly
// published limited show up on the site within one poll cycle (~5 min)
// instead of waiting on the much slower full-catalog-walk safety net
// (full-sync.yml) — new items don't reliably fire the resale event types
// the worker already listens for (a brand-new item's first activity is
// often a STORE_PURCHASE, not a RESALE_*), so discovery can't rely on the
// event stream alone.
export async function discoverNewItems(): Promise<number> {
  const { listings } = await fetchMarketplaceListings({ limit: 50, sort: 'listedAt' });
  const relevant = listings.filter((l) => l.item.clothingType === null);
  if (relevant.length === 0) return 0;

  const catalogIds = [...new Set(relevant.map((l) => l.item.id))];
  const { data: known } = await supabase.from('items').select('catalog_item_id').in('catalog_item_id', catalogIds);
  const knownSet = new Set((known || []).map((k) => k.catalog_item_id).filter((id) => id != null));

  const seen = new Set<number>();
  let discovered = 0;

  for (const listing of relevant) {
    if (knownSet.has(listing.item.id) || seen.has(listing.item.id)) continue;
    seen.add(listing.item.id);
    const ok = await catalogOneListing(listing);
    if (ok) discovered++;
  }

  return discovered;
}
