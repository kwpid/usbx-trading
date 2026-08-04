import { supabase } from './supabase';
import { UsbxMarketplaceListing } from './usbxApi';
import { tokensToScrips } from './currency';

function toScrips(amount: number, currencyCode: string | null | undefined) {
  return currencyCode !== 'SCRIPS' ? tokensToScrips(amount) : Math.round(amount);
}

// Live marketplace listings can be admin-store OR reseller resale listings.
// Each has its own top-level listing `id`, which is a different, ever-
// changing value per resale listing and is never present in our `items`
// table (only the item's original admin listing was synced there). Linking
// a deal card straight to `/items/{listing.id}` for a resale listing 404s,
// and since resellers relist constantly, sorting by newest makes the feed
// dominated by one seller's repeated listing ids.
//
// The fix: resolve every listing back to our catalog via the STABLE
// `catalog_item_id` (the nested `item.id`, which stays constant across the
// original listing and every resale of the same item) rather than the
// listing's own id. Listings that don't resolve to a catalog item we've
// synced are skipped outright instead of linking to a 404.
export async function resolveListingsToDealRows(listings: UsbxMarketplaceListing[]) {
  const catalogIds = [...new Set(listings.map((l) => l.item.id))];
  if (catalogIds.length === 0) return [];

  const { data: catalogItems, error } = await supabase
    .from('items')
    .select('id, catalog_item_id')
    .in('catalog_item_id', catalogIds);
  if (error) throw new Error(error.message);

  const itemIdByCatalogId = new Map<number, number>(
    (catalogItems || [])
      .filter((i) => i.catalog_item_id != null)
      .map((i) => [i.catalog_item_id as number, i.id as number])
  );

  // Several resale listings can point at the same catalog item — keep only
  // the cheapest one as "the deal" for that item.
  const bestByItemId = new Map<number, { listing: UsbxMarketplaceListing; priceScrips: number }>();
  for (const listing of listings) {
    const itemId = itemIdByCatalogId.get(listing.item.id);
    if (itemId === undefined) continue;
    const priceScrips = toScrips(listing.price, listing.currencyUsed?.code);
    const existing = bestByItemId.get(itemId);
    if (!existing || priceScrips < existing.priceScrips) {
      bestByItemId.set(itemId, { listing, priceScrips });
    }
  }

  const now = new Date().toISOString();
  return [...bestByItemId.entries()].map(([itemId, { listing, priceScrips }]) => ({
    id: itemId,
    item_name: listing.item.name,
    item_image_url: listing.item.resolvedPreviewUrl,
    price: priceScrips,
    currency_code: listing.currencyUsed?.code ?? null,
    stock_total: listing.stockTotal,
    stock_sold: listing.stockSold,
    starts_at: listing.startsAt,
    ends_at: listing.endsAt,
    store_name: listing.store?.name ?? null,
    store_type: listing.store?.storeType ?? null,
    listed_by_username: listing.listedBy?.username ?? null,
    listed_by_id: listing.listedBy?.id ?? null,
    listed_at: listing.listedAt,
    is_active: true,
    updated_at: now,
  }));
}
