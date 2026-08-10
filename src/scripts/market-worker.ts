// Run with: npm run worker (loads Supabase credentials from .env.local)
//
// catalog_item_id is the stable id nested on every listing (constant across
// resales); `id`/listing_id is our own primary key, matching a listing's
// USBX /marketplace/{id} URL. Public events carry catalog_item_id, not
// `id` — always resolve through catalog_item_id, never assume they're equal.

import { supabase } from '../lib/supabase';
import { fetchItemRap, fetchItemRecentSales, fetchMarketplaceListings, fetchPublicEvents, UsbxOwnerRow } from '../lib/usbxApi';
import { tokensToScrips } from '../lib/currency';
import { sendRapUpdateWebhook, sendRecentSaleWebhook } from '../lib/discordWebhooks';
import { resolveListingsToDealRows } from '../lib/dealsSync';
import { discoverNewItems } from '../lib/catalogDiscovery';
import { syncItemOwners } from '../lib/itemOwnersSync';

const LISTING_EVENT_TYPES = new Set(['RESALE_LISTED', 'RESALE_RELISTED', 'RESALE_PURCHASED']);

async function refreshListingsWindow() {
  try {
    const { listings } = await fetchMarketplaceListings({ limit: 30, sort: 'listedAt' });
    const relevant = listings.filter(
      (l) => l.item.clothingType === null && l.item.normalDetails?.isLimited && l.price > 0
    );
    if (relevant.length === 0) return;

    const rows = await resolveListingsToDealRows(relevant);
    if (rows.length === 0) return;

    const { error } = await supabase.from('marketplace_listings').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn(` ⚠ Deals window refresh failed: ${error.message}`);
    } else {
      console.log(` ✓ Deals window refreshed (${rows.length} listings)`);
    }
  } catch (err: any) {
    console.warn(` ⚠ Deals window refresh failed: ${err.message}`);
  }
}

const POLL_INTERVAL_MS = 5000;

let lastSeenEventId = 0;

async function updateItemInDb(
  itemId: number,
  listingId: number,
  isLimited: boolean,
  isPurchase: boolean,
  itemName: string,
  imageUrl: string | null,
  oldRap: number | null
) {
  const [rapData, ownersResult] = await Promise.all([
    fetchItemRap(listingId).catch(() => null),
    isLimited ? syncItemOwners(itemId, listingId).catch(() => ({ owners: [] as UsbxOwnerRow[], uniqueOwners: 0 })) : Promise.resolve({ owners: [] as UsbxOwnerRow[], uniqueOwners: 0 }),
  ]);
  const uniqueOwners = ownersResult.uniqueOwners;

  // currencyCode matters — assuming tokens unconditionally inflates
  // SCRIPS-denominated items by 50x.
  const rapRaw = rapData?.rap ?? null;
  const rapScrips = rapRaw != null
    ? (rapData?.currencyCode !== 'SCRIPS' ? tokensToScrips(rapRaw) : Math.round(rapRaw))
    : null;

  const updates: Record<string, any> = { data_refreshed_at: new Date().toISOString() };
  if (rapScrips !== null) updates.rap = rapScrips;
  if (rapData?.totalSales != null) updates.total_sales = rapData.totalSales;
  if (isLimited && uniqueOwners > 0) updates.available_owners = uniqueOwners;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('items').update(updates).eq('id', itemId);
    if (error) throw new Error(error.message);
    console.log(` ✓ Updated item ${itemId} — RAP: ${rapScrips}, Owners: ${uniqueOwners}`);
  }

  if (isPurchase) {
    const { error: snapErr } = await supabase.from('item_price_history').insert({
      item_id: itemId,
      rap: rapScrips,
      value: null,
      price_best_resale: null,
      available_owners: isLimited ? uniqueOwners : null,
      copies_sold: null,
    });
    if (snapErr) {
      console.warn(` ⚠ Snapshot failed for item ${itemId}: ${snapErr.message}`);
    } else {
      console.log(` ✓ Price history snapshot recorded for item ${itemId}`);
    }

    // Dedup on eventId since the same sale can surface again on the next poll.
    try {
      const sales = await fetchItemRecentSales(listingId);
      const latest = sales[0];
      if (latest) {
        const { data: existing } = await supabase
          .from('item_recent_sales')
          .select('id')
          .eq('event_id', latest.eventId)
          .maybeSingle();

        if (!existing) {
          const saleCurrency = latest.currency?.code;
          const salePriceScrips =
            latest.price != null
              ? saleCurrency !== 'SCRIPS'
                ? tokensToScrips(latest.price)
                : Math.round(latest.price)
              : null;

          const { error: saleErr } = await supabase.from('item_recent_sales').insert({
            event_id: latest.eventId,
            item_id: itemId,
            sale_type: latest.type,
            price: salePriceScrips,
            serial_number: latest.serial?.serialNumber ?? null,
            buyer_username: latest.buyer?.username ?? null,
            buyer_usbx_id: latest.buyer?.id ?? null,
            seller_username: latest.seller?.username ?? null,
            seller_usbx_id: latest.seller?.id ?? null,
            purchased_at: latest.purchasedAt,
          });

          if (saleErr) {
            console.warn(` ⚠ Sale log failed for item ${itemId}: ${saleErr.message}`);
          } else {
            console.log(` ✓ Recorded sale ${latest.eventId} for item ${itemId}`);
            if (salePriceScrips != null && latest.buyer) {
              await sendRecentSaleWebhook({
                itemId,
                itemName,
                imageUrl,
                price: salePriceScrips,
                rap: rapScrips,
                serialNumber: latest.serial?.serialNumber ?? null,
                buyerUsername: latest.buyer.username,
                buyerId: latest.buyer.id,
                sellerUsername: latest.seller?.username ?? null,
                sellerId: latest.seller?.id ?? null,
                saleType: latest.type,
              });
            }

            if (oldRap != null && rapScrips != null && rapScrips !== oldRap) {
              await sendRapUpdateWebhook({
                itemId,
                itemName,
                imageUrl,
                oldRap,
                newRap: rapScrips,
                salePrice: salePriceScrips,
                totalSales: rapData?.totalSales ?? null,
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(` ⚠ Recent-sale tracking failed for item ${itemId}: ${err.message}`);
    }
  }
}

async function pollEvents() {
  try {
    const rawEvents = await fetchPublicEvents({
      eventTypes: ['RESALE_PURCHASED', 'RESALE_LISTED', 'RESALE_RELISTED'],
      limit: 50,
    });

    const events: any[] = [...rawEvents].sort((a: any, b: any) => a.id - b.id);
    let listingsDirty = false;

    for (const event of events) {
      if (event.id <= lastSeenEventId) continue;
      lastSeenEventId = event.id;

      if (LISTING_EVENT_TYPES.has(event.eventType)) {
        listingsDirty = true;
      }

      const catalogItemId: number | undefined = event.item?.id;
      if (!catalogItemId) continue;

      console.log(`[Event ${event.id}] ${event.eventType} for catalog item ${catalogItemId}`);

      const { data: dbItem } = await supabase
        .from('items')
        .select('id, listing_id, is_limited, name, item_image_url, rap')
        .eq('catalog_item_id', catalogItemId)
        .maybeSingle();

      if (!dbItem) {
        console.log(` ⟳ Catalog item ${catalogItemId} not in DB yet — skipping`);
        continue;
      }

      const listingId: number = dbItem.listing_id ?? dbItem.id;

      try {
        await updateItemInDb(
          dbItem.id,
          listingId,
          dbItem.is_limited,
          event.eventType === 'RESALE_PURCHASED',
          dbItem.name,
          dbItem.item_image_url,
          dbItem.rap
        );
      } catch (err: any) {
        console.error(` ✗ Failed to update item ${dbItem.id}: ${err.message}`);
      }
    }

    if (listingsDirty) {
      await refreshListingsWindow();
    }

    const discovered = await discoverNewItems();
    if (discovered > 0) {
      console.log(` ✓ Discovered ${discovered} new item(s)`);
    }
  } catch (err: any) {
    console.error(`[Worker] Poll error: ${err.message}`);
  }

  setTimeout(pollEvents, POLL_INTERVAL_MS);
}

console.log('🚀 Market worker started. Polling for real-time events every 5s…');
pollEvents();
