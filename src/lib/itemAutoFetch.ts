import 'server-only';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { fetchItem, fetchItemFullDetails, fetchItemRecentSales, isClothingItem } from '@/lib/usbxApi';
import { tokensToScrips } from '@/lib/currency';
import { syncItemOwners } from '@/lib/itemOwnersSync';

type ItemRow = Record<string, unknown> & { id: number; name: string };

export type AutoFetchResult = { item: ItemRow } | { error: string };

// Catalog sync walks USBX page by page and can miss a brand new release or
// lag behind for a while. This lets any page that looks up an item by id
// self-heal: if it's missing from our DB, fetch it from USBX once and
// insert it, same shape the admin scrape flow uses.
export async function fetchMissingItemById(rawId: string | number): Promise<AutoFetchResult> {
  const ip = await getClientIp();
  if (!(await checkRateLimit(`item-autofetch:${ip}`, 60, 10))) {
    return { error: 'Too many lookups, try again in a minute.' };
  }

  const id = typeof rawId === 'number' ? rawId : Number(rawId.trim());
  if (!Number.isInteger(id) || id <= 0) {
    return { error: 'Not a valid item id.' };
  }

  const { data: existing } = await supabase.from('items').select('*').eq('id', id).maybeSingle();
  if (existing) return { item: existing };

  let storeItem;
  try {
    storeItem = await fetchItem(id);
  } catch {
    return { error: `No item with id ${id} exists on USBX.` };
  }

  if (isClothingItem(storeItem)) {
    return { error: 'That is a clothing item, not a limited, so it can\'t be auto-added here.' };
  }

  const details = await fetchItemFullDetails(id);
  if (!details.isLimited) {
    return { error: 'USBX reports that item as non-limited, so it can\'t be auto-added here.' };
  }

  const { data: inserted, error } = await supabase
    .from('items')
    .insert([
      {
        id,
        name: details.name || `Item ${id}`,
        item_image_url: details.imageUrl,
        copies_sold: details.copiesSold,
        available_owners: details.uniqueOwners,
        rap: details.rapScrips ?? 0,
        // Value is managed manually via this site's own tracking, not
        // whatever USBX reports, same as the admin scrape flow.
        value: 0,
        price_best_resale: details.priceScrips ?? 0,
        is_limited: true,
        source_url: `https://untitled-sandbox.com/marketplace/${id}`,
      },
    ])
    .select('*')
    .single();

  if (error) {
    return { error: `Found it on USBX but couldn't save it: ${error.message}` };
  }

  // Normally owners/sales only get backfilled by the background sync jobs,
  // which haven't seen this item yet since it just got inserted — do a
  // one-time deep fetch here so the page isn't sitting empty for days until
  // the next full refresh happens to reach it.
  try {
    const { uniqueOwners } = await syncItemOwners(id, id);
    if (uniqueOwners > 0) {
      await supabase.from('items').update({ available_owners: uniqueOwners }).eq('id', id);
      inserted.available_owners = uniqueOwners;
    }
  } catch (err) {
    console.warn(`Owner backfill failed for newly-added item ${id}:`, err);
  }

  try {
    const sales = await fetchItemRecentSales(id);
    const rows = sales
      .filter((s) => s.purchasedAt)
      .map((s) => ({
        event_id: s.eventId,
        item_id: id,
        sale_type: s.type,
        price: s.price != null ? (s.currency?.code !== 'SCRIPS' ? tokensToScrips(s.price) : Math.round(s.price)) : null,
        serial_number: s.serial?.serialNumber ?? null,
        buyer_username: s.buyer?.username ?? null,
        buyer_usbx_id: s.buyer?.id ?? null,
        seller_username: s.seller?.username ?? null,
        seller_usbx_id: s.seller?.id ?? null,
        purchased_at: s.purchasedAt,
      }));

    if (rows.length > 0) {
      // No unique constraint on event_id (poll-events dedupes the same
      // way), so check what's already there instead of upserting.
      const { data: already } = await supabase
        .from('item_recent_sales')
        .select('event_id')
        .in('event_id', rows.map((r) => r.event_id));
      const knownIds = new Set((already || []).map((r) => r.event_id));
      const newRows = rows.filter((r) => !knownIds.has(r.event_id));
      if (newRows.length > 0) {
        await supabase.from('item_recent_sales').insert(newRows);
      }
    }
  } catch (err) {
    console.warn(`Recent sales backfill failed for newly-added item ${id}:`, err);
  }

  return { item: inserted };
}
