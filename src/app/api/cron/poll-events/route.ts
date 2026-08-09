import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchItemRap, fetchItemRecentSales, fetchMarketplaceListings, fetchPublicEvents, UsbxOwnerRow } from '@/lib/usbxApi';
import { tokensToScrips } from '@/lib/currency';
import { sendRapUpdateWebhook, sendRecentSaleWebhook, sendDealWebhook } from '@/lib/discordWebhooks';
import { resolveListingsToDealRows } from '@/lib/dealsSync';
import { discoverNewItems } from '@/lib/catalogDiscovery';
import { syncItemOwners } from '@/lib/itemOwnersSync';

// One-shot version of src/scripts/market-worker.ts, meant to be triggered on
// a schedule (GitHub Actions cron, Vercel Cron, etc.) instead of running as
// a standalone always-on process. Vercel serverless functions can't keep a
// setTimeout loop alive between requests, so the "poll every N seconds"
// cursor has to live in the DB (site_settings.last_seen_event_id) instead of
// an in-memory variable — each invocation picks up where the last one left
// off, does one pass, and exits.

const LISTING_EVENT_TYPES = new Set(['RESALE_LISTED', 'RESALE_RELISTED', 'RESALE_PURCHASED']);
// Only alert on listings priced at least this far below RAP — matches the
// Deals page's own "good deal" framing, but a bit stricter to avoid
// spamming the webhook on every marginal discount.
const DEAL_ALERT_THRESHOLD_PCT = 15;

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

  // Respect the RAP endpoint's own currencyCode — some items trade in
  // SCRIPS directly, so unconditionally assuming tokens inflates their RAP
  // by 50x (the same bug fixed in refresh-all-items/route.ts).
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
  }

  if (!isPurchase) return;

  await supabase.from('item_price_history').insert({
    item_id: itemId,
    rap: rapScrips,
    value: null,
    price_best_resale: null,
    available_owners: isLimited ? uniqueOwners : null,
    copies_sold: null,
  });

  // The event payload itself doesn't carry buyer/seller/serial detail — pull
  // the freshest sale record. Dedup on eventId since the same sale can
  // surface again on the next poll.
  try {
    const sales = await fetchItemRecentSales(listingId);
    const latest = sales[0];
    if (!latest) return;

    const { data: existing } = await supabase
      .from('item_recent_sales')
      .select('id')
      .eq('event_id', latest.eventId)
      .maybeSingle();
    if (existing) return;

    const saleCurrency = latest.currency?.code;
    const salePriceScrips =
      latest.price != null ? (saleCurrency !== 'SCRIPS' ? tokensToScrips(latest.price) : Math.round(latest.price)) : null;

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
    if (saleErr) return;

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
  } catch (err: any) {
    console.warn(`Recent-sale tracking failed for item ${itemId}: ${err.message}`);
  }
}

// Mirrors the newest listings window into marketplace_listings (same as the
// worker did) and, for anything new or repriced that clears the discount
// threshold, fires the Deals webhook.
async function refreshListingsAndAlertDeals() {
  const { listings } = await fetchMarketplaceListings({ limit: 30, sort: 'listedAt' });
  const relevant = listings.filter(
    (l) => l.item.clothingType === null && l.item.normalDetails?.isLimited && l.price > 0
  );
  if (relevant.length === 0) return;

  const rows = await resolveListingsToDealRows(relevant);
  if (rows.length === 0) return;

  const itemIds = rows.map((r) => r.id);
  const [{ data: existingRows }, { data: pricing }] = await Promise.all([
    supabase.from('marketplace_listings').select('id, price').in('id', itemIds),
    supabase.from('items').select('id, rap').in('id', itemIds),
  ]);
  const existingPriceByItemId = new Map((existingRows || []).map((r) => [r.id, r.price]));
  const rapByItemId = new Map((pricing || []).map((p) => [p.id, p.rap]));

  const { error } = await supabase.from('marketplace_listings').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.warn(`Deals window refresh failed: ${error.message}`);
    return;
  }

  for (const row of rows) {
    const prevPrice = existingPriceByItemId.get(row.id);
    const isNewOrRepriced = prevPrice === undefined || prevPrice !== row.price;
    if (!isNewOrRepriced) continue;

    const rap = rapByItemId.get(row.id);
    if (!rap || rap <= 0) continue;

    const discountPct = ((rap - row.price) / rap) * 100;
    if (discountPct >= DEAL_ALERT_THRESHOLD_PCT) {
      await sendDealWebhook({
        itemId: row.id,
        itemName: row.item_name,
        imageUrl: row.item_image_url,
        price: row.price,
        rap,
        discountPct,
        storeName: row.store_name,
        sellerUsername: row.listed_by_username,
      });
    }
  }
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from('site_settings')
    .select('last_seen_event_id')
    .eq('id', 1)
    .maybeSingle();

  const startingCursor = settings?.last_seen_event_id ?? 0;
  let lastSeenEventId = startingCursor;
  let processed = 0;
  let listingsDirty = false;
  let discovered = 0;

  try {
    const rawEvents = await fetchPublicEvents({
      eventTypes: ['RESALE_PURCHASED', 'RESALE_LISTED', 'RESALE_RELISTED'],
      limit: 50,
    });

    // Process oldest-first so the cursor advances monotonically.
    const events: any[] = [...rawEvents].sort((a: any, b: any) => a.id - b.id);

    for (const event of events) {
      if (event.id <= lastSeenEventId) continue;
      lastSeenEventId = event.id;
      processed++;

      if (LISTING_EVENT_TYPES.has(event.eventType)) {
        listingsDirty = true;
      }

      // Events carry the catalog item ID, NOT our own `id` — resolve via
      // catalog_item_id, never assume they're the same value.
      const catalogItemId: number | undefined = event.item?.id;
      if (!catalogItemId) continue;

      const { data: dbItem } = await supabase
        .from('items')
        .select('id, listing_id, is_limited, name, item_image_url, rap')
        .eq('catalog_item_id', catalogItemId)
        .maybeSingle();
      if (!dbItem) continue;

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
        console.error(`Failed to update item ${dbItem.id}: ${err.message}`);
      }
    }

    if (listingsDirty) {
      await refreshListingsAndAlertDeals();
    }

    // New items don't reliably fire a RESALE_* event (their first activity
    // is often a STORE_PURCHASE), so discovery can't rely on the event loop
    // above — check the newest listings window every run instead.
    discovered = await discoverNewItems();
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Poll failed' }, { status: 502 });
  }

  if (lastSeenEventId !== startingCursor) {
    const { error } = await supabase
      .from('site_settings')
      .update({ last_seen_event_id: lastSeenEventId })
      .eq('id', 1);
    if (error) console.error('Failed to persist event cursor:', error.message);
  }

  return NextResponse.json({ success: true, processed, discovered, lastSeenEventId });
}
