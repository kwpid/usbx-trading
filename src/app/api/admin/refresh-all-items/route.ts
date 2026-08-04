import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/roles';
import { fetchItemRap, fetchItemOwners } from '@/lib/usbxApi';
import { tokensToScrips } from '@/lib/currency';
import { revalidatePath } from 'next/cache';

// Bulk-enriches ALL items in the database with the latest RAP, owner count,
// and price data. Use this after a catalog sync to fill in the fields that
// the initial sync may have missed (e.g. items synced before the listing_id
// fix, or items where the enrichment calls timed out).
//
// Uses listing_id (the store listing id, entry.id from the marketplace listing)
// for enrichment API calls. Falls back to the item's own catalog id if
// listing_id is not set.
//
// Returns pagination so the admin panel can poll repeatedly.
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const secretOk = Boolean(secret) && secret === process.env.REFRESH_PRICES_SECRET;

  if (!secretOk && !(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Page through DB items in batches to avoid holding a large result set
  const pageParam = request.nextUrl.searchParams.get('page');
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  const batchSize = 10;
  const offset = (page - 1) * batchSize;

  const { data: items, error: fetchError, count } = await supabase
    .from('items')
    .select('id, listing_id, is_limited', { count: 'exact' })
    .range(offset, offset + batchSize - 1);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let updated = 0;
  const failures: { id: number; error: string }[] = [];
  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / batchSize);

  for (const item of items ?? []) {
    // Use listing_id when available (correct enrichment ID); fall back to catalog id
    const enrichId = item.listing_id ?? item.id;

    try {
      const [rapData, owners] = await Promise.all([
        fetchItemRap(enrichId).catch(() => null),
        fetchItemOwners(enrichId).catch(() => []),
      ]);

      // We don't know the currency from the DB alone; assume tokens (most common)
      // The RAP endpoint returns the value in its own unit, then we convert
      const rapRaw = rapData?.rap ?? null;
      const rapScrips = rapRaw != null ? tokensToScrips(rapRaw) : null;

      const uniqueOwners = new Set(
        owners.map((r) => r.owner?.id).filter(Boolean)
      ).size;

      const updates: Record<string, any> = {
        rap: rapScrips,
        available_owners: item.is_limited ? uniqueOwners : null,
        copies_sold: owners.length > 0 ? owners.length : undefined,
      };
      // Remove undefined fields
      Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

      const { error: updateErr } = await supabase
        .from('items')
        .update(updates)
        .eq('id', item.id);

      if (updateErr) throw new Error(updateErr.message);

      // Write a price history snapshot
      const { error: snapErr } = await supabase.from('item_price_history').insert({
        item_id: item.id,
        rap: rapScrips,
        value: null,
        price_best_resale: null,
        available_owners: item.is_limited ? uniqueOwners : null,
        copies_sold: owners.length > 0 ? owners.length : null,
      });
      if (snapErr) console.warn(`Snapshot failed for item ${item.id}:`, snapErr.message);

      revalidatePath(`/items/${item.id}`);
      updated++;
    } catch (err: any) {
      failures.push({ id: item.id, error: err.message || 'Unknown' });
      console.error(`Refresh failed for item ${item.id}:`, err.message);
    }
  }

  revalidatePath('/');
  revalidatePath('/market');

  return NextResponse.json({
    updated,
    failed: failures.length,
    failures: failures.length > 0 ? failures : undefined,
    page,
    totalPages,
    totalItems,
    done: page >= totalPages,
  });
}
