import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/roles';
import { fetchItemFullDetails, extractUsbxItemId } from '@/lib/usbxApi';
import { revalidatePath } from 'next/cache';

// Bulk-refreshes RAP/Price/owners for every item that has a saved
// USBX source link. Two ways in:
// - Logged-in admin hitting this in a browser (session cookie).
// - An external scheduler (Vercel Cron, cron-job.org, etc.) calling with
//   ?secret=REFRESH_PRICES_SECRET, since a cron job has no browser session.
//
// After updating each item's core fields, we also insert a timestamped
// snapshot into item_price_history so that charts have real timeseries data.
// Non-limited items won't have RAP, but we still capture copies_sold so
// popularity trends are visible over time.
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const secretOk = Boolean(secret) && secret === process.env.REFRESH_PRICES_SECRET;

  if (!secretOk && !(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all items with a source link (both limited and non-limited)
  const { data: items, error } = await supabase
    .from('items')
    .select('id, source_url, is_limited')
    .not('source_url', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;
  const failures: { id: number; error: string }[] = [];

  for (const item of items ?? []) {
    const usbxItemId = extractUsbxItemId(item.source_url);
    if (!usbxItemId) continue;

    try {
      const details = await fetchItemFullDetails(usbxItemId);

      // Build the updates object — only set fields that the API returned data for.
      // Value is never overwritten here; it's managed manually via value-changes.
      const updates: Record<string, any> = {};
      if (details.rapScrips !== null) updates.rap = details.rapScrips;
      if (details.priceScrips !== null) updates.price_best_resale = details.priceScrips;
      if (details.copiesSold !== null) updates.copies_sold = details.copiesSold;
      if (item.is_limited) updates.available_owners = details.uniqueOwners;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from('items').update(updates).eq('id', item.id);
        if (updateError) throw new Error(updateError.message);
      }

      // Persist a historical snapshot for charting, regardless of whether
      // the item is limited — even non-limiteds benefit from copies_sold tracking.
      const snapshot = {
        item_id: item.id,
        rap: details.rapScrips,
        value: null as number | null, // managed manually; don't overwrite
        price_best_resale: details.priceScrips,
        available_owners: item.is_limited ? details.uniqueOwners : null,
        copies_sold: details.copiesSold,
      };
      const { error: snapshotError } = await supabase.from('item_price_history').insert(snapshot);
      if (snapshotError) {
        // Non-fatal: if the table doesn't exist yet, skip silently with a warning
        console.warn(`Snapshot insert failed for item ${item.id}:`, snapshotError.message);
      }

      revalidatePath(`/items/${item.id}`);
      updated++;
    } catch (err: any) {
      failures.push({ id: item.id, error: err.message || 'Unknown error' });
    }
  }

  revalidatePath('/');
  revalidatePath('/market');

  return NextResponse.json({ updated, failed: failures.length, failures });
}
