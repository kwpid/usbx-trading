import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/roles';
import { fetchMarketplaceListings } from '@/lib/usbxApi';
import { resolveListingsToDealRows } from '@/lib/dealsSync';
import { revalidatePath } from 'next/cache';

// Walks the entire live marketplace listings feed and mirrors it into our
// own marketplace_listings table, so the Deals page reads instantly from
// the DB instead of hitting USBX live on every page load. Call repeatedly
// with the returned nextCursor until done=true, passing the same startedAt
// on every call — the final page uses it to retire any listing we didn't
// see this run (sold out, delisted, or expired).
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const secretOk = Boolean(secret) && secret === process.env.REFRESH_PRICES_SECRET;

  if (!secretOk && !(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cursorParam = request.nextUrl.searchParams.get('cursor');
  const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;
  const startedAt = request.nextUrl.searchParams.get('startedAt') || new Date().toISOString();

  let listings: Awaited<ReturnType<typeof fetchMarketplaceListings>>['listings'] = [];
  let nextCursor: number | null = null;
  try {
    const page = await fetchMarketplaceListings({ cursor, limit: 50, sort: 'listedAt' });
    listings = page.listings;
    nextCursor = page.nextCursor;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch listings' }, { status: 502 });
  }

  const relevant = listings.filter(
    (l) => l.item.clothingType === null && l.item.normalDetails?.isLimited && l.price > 0
  );

  let upserted = 0;
  try {
    const rows = await resolveListingsToDealRows(relevant);
    if (rows.length > 0) {
      const { error } = await supabase.from('marketplace_listings').upsert(rows, { onConflict: 'id' });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      upserted = rows.length;
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to resolve listings' }, { status: 500 });
  }

  const done = !nextCursor;
  if (done) {
    const { error: cleanupErr } = await supabase
      .from('marketplace_listings')
      .update({ is_active: false })
      .lt('updated_at', startedAt)
      .eq('is_active', true);
    if (cleanupErr) console.warn('Deals cleanup failed:', cleanupErr.message);
    revalidatePath('/deals');
  }

  return NextResponse.json({
    upserted,
    skipped: listings.length - relevant.length,
    nextCursor,
    startedAt,
    done,
  });
}
