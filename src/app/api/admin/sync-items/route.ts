import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/roles';
import { fetchItemsPage, fetchItemRap } from '@/lib/usbxApi';
import { tokensToScrips } from '@/lib/currency';
import { syncItemOwners } from '@/lib/itemOwnersSync';
import { revalidatePath } from 'next/cache';

// ─── ID SYSTEM EXPLANATION (corrected) ───────────────────────────────────────
//
// USBX's own marketplace URL — /marketplace/{id} — and every enrichment
// endpoint (/rap, /owners, /recent-sales, /resellers) all use entry.id (the
// store listing ID), NOT entry.item.id (the catalog item ID). Confirmed by
// testing live: /marketplace/547 → "Mahjong Crown", whose catalog item.id is
// 668 — the URL uses 547, not 668. So entry.id is what we mirror as our own
// `id` (and therefore our own /items/{id} URL), matching USBX 1:1.
//
// entry.item.id is kept only as descriptive metadata if ever needed later;
// it is NOT our primary key and NOT used in URLs or API calls.
//
// ─────────────────────────────────────────────────────────────────────────────
//
// This endpoint walks the USBX marketplace one page at a time (10 items/page
// to avoid serverless timeouts). For every non-clothing item it finds it:
//   1. Filters by clothingType === null
//   2. Fetches /rap and /owners using entry.id
//   3. Upserts into `items` and writes a price-history snapshot
//
// Call repeatedly with the returned nextCursor until done === true.
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const secretOk = Boolean(secret) && secret === process.env.REFRESH_PRICES_SECRET;

  if (!secretOk && !(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cursorParam = request.nextUrl.searchParams.get('cursor');
  const cursor = cursorParam ? Number(cursorParam) : undefined;
  const sort = request.nextUrl.searchParams.get('sort') || undefined;

  let page;
  try {
    page = await fetchItemsPage({ cursor, limit: 10, sort });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Could not reach USBX marketplace.' },
      { status: 502 }
    );
  }

  let upserted = 0;
  let skipped = 0;
  const errors: { id: number; error: string }[] = [];

  for (const entry of page.items) {
    // Strict clothing gate — null clothingType = real USBX item; anything else = skip
    if (entry.item.clothingType !== null) {
      skipped++;
      continue;
    }

    const itemId = entry.id;           // matches USBX's /marketplace/{id} URL — our primary key
    const listingId = entry.id;        // same id — all enrichment endpoints use it too

    try {
      const rapData = await fetchItemRap(listingId).catch(() => null);

      const isLimited = entry.item.normalDetails?.isLimited ?? false;
      const isTokens = entry.currencyUsed?.code !== 'SCRIPS';
      const toScrips = (n: number | null | undefined) =>
        n == null ? null : isTokens ? tokensToScrips(n) : Math.round(n);

      const rapScrips = rapData?.rap ? toScrips(rapData.rap) : null;
      const listingPriceScrips = entry.price != null ? toScrips(entry.price) : null;

      // The items row must exist before item_owners can be written — that
      // table has a foreign key on item_id, so syncItemOwners has to run
      // AFTER this upsert, not concurrently with it (a brand-new item's
      // ownership insert would silently fail on the FK constraint
      // otherwise — exactly the bug where a freshly-published limited
      // never shows up in anyone's profile inventory).
      const { error } = await supabase.from('items').upsert(
        {
          id: itemId,
          listing_id: listingId,
          // The stable catalog item id, distinct from our own `id` (the
          // listing id). Resale listings of this same item keep this value
          // constant while getting their own listing id — this is how the
          // Deals feature resolves reseller listings back to this row.
          catalog_item_id: entry.item.id,
          name: entry.item.name,
          description: entry.item.description,
          item_image_url: entry.item.resolvedPreviewUrl,
          is_limited: isLimited,
          copies_sold: entry.stockSold,
          price_best_resale: listingPriceScrips,
          rap: rapScrips,
          total_sales: rapData?.totalSales ?? null,
          source_url: `https://beta.untitled-sandbox.com/marketplace/${itemId}`,
          data_refreshed_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (error) {
        errors.push({ id: itemId, error: error.message });
        console.error(`Sync upsert failed for item ${itemId}:`, error.message);
        continue;
      }

      const { uniqueOwners } = await syncItemOwners(itemId, listingId);
      if (isLimited && uniqueOwners > 0) {
        await supabase.from('items').update({ available_owners: uniqueOwners }).eq('id', itemId);
      }

      upserted++;

      // Price history snapshot for charts
      const { error: snapErr } = await supabase.from('item_price_history').insert({
        item_id: itemId,
        rap: rapScrips,
        value: null,
        price_best_resale: listingPriceScrips,
        available_owners: isLimited ? uniqueOwners : null,
        copies_sold: entry.stockSold,
      });
      if (snapErr) {
        console.warn(`Snapshot insert failed for item ${itemId}:`, snapErr.message);
      }
    } catch (err: any) {
      errors.push({ id: itemId, error: err.message || 'Unknown error' });
      console.error(`Deep sync failed for item ${itemId}:`, err.message);
    }
  }

  revalidatePath('/');
  revalidatePath('/market');

  return NextResponse.json({
    upserted,
    skipped,
    count: page.items.length,
    nextCursor: page.nextCursor,
    errors: errors.length > 0 ? errors : undefined,
  });
}
