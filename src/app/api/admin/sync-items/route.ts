import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/roles';
import { fetchItemsPage, fetchItemRap } from '@/lib/usbxApi';
import { tokensToScrips } from '@/lib/currency';
import { syncItemOwners } from '@/lib/itemOwnersSync';
import { revalidatePath } from 'next/cache';

// USBX's /marketplace/{id} URL and every enrichment endpoint use entry.id
// (the store listing id), not entry.item.id (the catalog item id) — entry.id
// is what we mirror as our own `id`/items/{id} URL.
//
// Walks the marketplace 10 items/page (serverless timeout headroom); call
// repeatedly with the returned nextCursor until done === true.
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
    if (entry.item.clothingType !== null) {
      skipped++;
      continue;
    }

    const itemId = entry.id;
    const listingId = entry.id;

    try {
      const rapData = await fetchItemRap(listingId).catch(() => null);

      const isLimited = entry.item.normalDetails?.isLimited ?? false;
      const isTokens = entry.currencyUsed?.code !== 'SCRIPS';
      const toScrips = (n: number | null | undefined) =>
        n == null ? null : isTokens ? tokensToScrips(n) : Math.round(n);

      const rapScrips = rapData?.rap ? toScrips(rapData.rap) : null;
      const listingPriceScrips = entry.price != null ? toScrips(entry.price) : null;

      // items row must exist before item_owners (FK on item_id) — this
      // upsert has to run before syncItemOwners, not concurrently with it.
      const { error } = await supabase.from('items').upsert(
        {
          id: itemId,
          listing_id: listingId,
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
