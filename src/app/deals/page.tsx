import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import RarityBadge from '@/app/components/RarityBadge';

export const revalidate = 30;

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

function timeAgo(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const diff = Date.now() - new Date(dateString).getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor(diff / (1000 * 60));
  if (d > 1) return `${d} days ago`;
  if (d === 1) return '1 day ago';
  if (h > 1) return `${h} hours ago`;
  if (h === 1) return '1 hour ago';
  if (m > 1) return `${m} mins ago`;
  return 'Just now';
}

// Tiered coloring for how good a deal is — the bigger the discount off RAP,
// the hotter the color, topping out at gold for a steal.
function getDealTier(pct: number): { label: string; color: string; bg: string } {
  if (pct >= 70) return { label: `${pct.toFixed(0)}% off`, color: '#eab308', bg: 'rgba(234,179,8,0.18)' };
  if (pct >= 50) return { label: `${pct.toFixed(0)}% off`, color: '#a78bfa', bg: 'rgba(167,139,250,0.18)' };
  if (pct >= 30) return { label: `${pct.toFixed(0)}% off`, color: '#38bdf8', bg: 'rgba(56,189,248,0.18)' };
  return { label: `${pct.toFixed(0)}% off`, color: 'var(--success-color)', bg: 'rgba(34,197,94,0.18)' };
}

// Active listings now come from our own marketplace_listings table (mirrored
// from USBX by the market worker in real time, and backfillable via the
// "Resync Deals" admin button) instead of hitting USBX live on every page
// load — that live call was surfacing whatever USBX's own feed happened to
// return, including stale/demo store listings.
type DealRow = {
  id: number;
  itemName: string;
  imageUrl: string | null;
  priceScrips: number;
  rap: number | null;
  value: number | null;
  discountPct: number | null;
  availableOwners: number | null;
  storeName: string | null;
  listedByUsername: string | null;
  listedAt: string | null;
};

export default async function DealsPage(props: { searchParams: Promise<{ sort?: string }> }) {
  const searchParams = await props.searchParams;
  const sortMode = searchParams.sort === 'best' ? 'best' : 'newest';

  let deals: DealRow[] = [];
  let listingsTableMissing = false;
  try {
    const { data: listingRows, error: listingsErr } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('is_active', true)
      .order('listed_at', { ascending: false })
      .limit(100);

    if (listingsErr) throw listingsErr;

    const listingIds = (listingRows || []).map((l) => l.id);
    let dbById = new Map<number, { rap: number | null; value: number | null; available_owners: number | null }>();
    if (listingIds.length > 0) {
      const { data } = await supabase
        .from('items')
        .select('id, rap, value, available_owners')
        .in('id', listingIds);
      dbById = new Map((data || []).map((i) => [i.id, i]));
    }

    deals = (listingRows || []).map((listing): DealRow => {
      const db = dbById.get(listing.id);
      const rap = db?.rap ?? null;
      const discountPct = rap != null && rap > 0 ? ((rap - listing.price) / rap) * 100 : null;

      return {
        id: listing.id,
        itemName: listing.item_name,
        imageUrl: listing.item_image_url,
        priceScrips: listing.price,
        rap,
        value: db?.value ?? null,
        discountPct,
        availableOwners: db?.available_owners ?? null,
        storeName: listing.store_name,
        listedByUsername: listing.listed_by_username,
        listedAt: listing.listed_at,
      };
    });
  } catch (err: any) {
    if (err?.message?.includes('marketplace_listings')) {
      listingsTableMissing = true;
    }
    console.error('Failed to load active listings:', err instanceof Error ? err.message : err);
  }

  if (sortMode === 'best') {
    deals.sort((a, b) => (b.discountPct ?? -999) - (a.discountPct ?? -999));
  }

  // Showcase the best recent sales (already-completed purchases well below
  // RAP), tracked live by the market worker — distinct from the still-open
  // listings above.
  type BestSaleRow = {
    id: number;
    itemId: number;
    itemName: string;
    imageUrl: string | null;
    price: number;
    rap: number | null;
    discountPct: number | null;
    buyerUsername: string | null;
    sellerUsername: string | null;
    serialNumber: string | null;
    purchasedAt: string | null;
  };

  let bestSales: BestSaleRow[] = [];
  try {
    const { data: recentSales, error: salesErr } = await supabase
      .from('item_recent_sales')
      .select('id, item_id, price, buyer_username, seller_username, serial_number, purchased_at, created_at')
      .order('created_at', { ascending: false })
      .limit(60);

    if (salesErr) throw salesErr;

    const saleItemIds = [...new Set((recentSales || []).map((s) => s.item_id))];
    let saleItemsById = new Map<number, { name: string; item_image_url: string | null; rap: number | null }>();
    if (saleItemIds.length > 0) {
      const { data: saleItems } = await supabase
        .from('items')
        .select('id, name, item_image_url, rap')
        .in('id', saleItemIds);
      saleItemsById = new Map((saleItems || []).map((i) => [i.id, i]));
    }

    bestSales = (recentSales || [])
      .map((s): BestSaleRow | null => {
        const item = saleItemsById.get(s.item_id);
        if (!item || s.price == null) return null;
        const rap = item.rap ?? null;
        const discountPct = rap != null && rap > 0 ? ((rap - s.price) / rap) * 100 : null;
        return {
          id: s.id,
          itemId: s.item_id,
          itemName: item.name,
          imageUrl: item.item_image_url,
          price: s.price,
          rap,
          discountPct,
          buyerUsername: s.buyer_username,
          sellerUsername: s.seller_username,
          serialNumber: s.serial_number,
          purchasedAt: s.purchased_at,
        };
      })
      .filter((s): s is BestSaleRow => s !== null && s.discountPct !== null && s.discountPct >= 15)
      .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0))
      .slice(0, 8);
  } catch (err) {
    console.error('Failed to load recent sales for deals page:', err instanceof Error ? err.message : err);
  }

  return (
    <div className="container" style={{ padding: '0', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Deals</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.25rem' }}>
            Recent marketplace listings compared to RAP
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link
            href="/deals"
            className="btn"
            style={{ padding: '0.4rem 1rem', background: sortMode === 'newest' ? 'var(--accent-color)' : 'var(--bg-tertiary)', color: sortMode === 'newest' ? '#fff' : 'inherit' }}
          >
            Newest
          </Link>
          <Link
            href="/deals?sort=best"
            className="btn"
            style={{ padding: '0.4rem 1rem', background: sortMode === 'best' ? 'var(--accent-color)' : 'var(--bg-tertiary)', color: sortMode === 'best' ? '#fff' : 'inherit' }}
          >
            Best Deals
          </Link>
        </div>
      </div>

      {bestSales.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>🔥 Best Recent Sales</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {bestSales.map((sale) => {
              const tier = getDealTier(sale.discountPct!);
              return (
                <Link key={sale.id} href={`/items/${sale.itemId}`} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ position: 'relative', height: '140px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: tier.bg, border: `1px solid ${tier.color}`, color: tier.color, fontWeight: 700, fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {tier.label}
                    </div>
                    {sale.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sale.imageUrl} alt={sale.itemName} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                    )}
                  </div>
                  <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {sale.itemName}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Sold for</span>
                      <span style={{ color: tier.color, fontWeight: 700 }}>{formatNumber(sale.price)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>RAP</span>
                      <span>{formatNumber(sale.rap)}</span>
                    </div>
                    {sale.buyerUsername && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Buyer</span>
                        <span>{sale.buyerUsername}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{timeAgo(sale.purchasedAt)}</span>
                      {sale.serialNumber && <span style={{ color: 'var(--accent-color)' }}>#{sale.serialNumber}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Active Listings</h2>

      {deals.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {listingsTableMissing ? (
            <>No listings synced yet — run &quot;Resync Deals&quot; in the Admin panel to pull the current marketplace.</>
          ) : (
            <>No active listings right now. The market worker picks up new listings automatically as they&apos;re posted.</>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {deals.map((deal) => {
            const isDeal = deal.discountPct != null && deal.discountPct > 0;
            const isOverpay = deal.discountPct != null && deal.discountPct < 0;
            const tier = isDeal ? getDealTier(deal.discountPct!) : null;

            return (
              <Link key={deal.id} href={`/items/${deal.id}`} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ position: 'relative', height: '140px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RarityBadge owners={deal.availableOwners} />
                  {deal.discountPct != null && (
                    <div style={{
                      position: 'absolute', top: '0.5rem', right: '0.5rem',
                      background: tier ? tier.bg : isOverpay ? 'rgba(239,68,68,0.18)' : 'var(--bg-secondary)',
                      border: tier ? `1px solid ${tier.color}` : isOverpay ? '1px solid var(--danger-color)' : 'none',
                      color: tier ? tier.color : isOverpay ? 'var(--danger-color)' : 'var(--text-secondary)',
                      fontWeight: 700, fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem', borderRadius: '4px',
                    }}>
                      {tier ? tier.label : isOverpay ? `${Math.abs(deal.discountPct).toFixed(0)}% over` : 'At RAP'}
                    </div>
                  )}
                  {deal.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={deal.imageUrl} alt={deal.itemName} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                  )}
                </div>

                <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {deal.itemName}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Listed</span>
                    <span style={{ color: 'var(--success-color)' }}>{formatNumber(deal.priceScrips)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>RAP</span>
                    <span>{deal.rap != null ? formatNumber(deal.rap) : '—'}</span>
                  </div>
                  {deal.value != null && deal.value > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Value</span>
                      <span style={{ color: 'var(--rare-color)' }}>{formatNumber(deal.value)}</span>
                    </div>
                  )}

                  {deal.listedByUsername && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Seller</span>
                      <span style={{ color: 'var(--accent-color)' }}>{deal.listedByUsername}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{timeAgo(deal.listedAt)}</span>
                    {deal.storeName && (
                      <span style={{ color: 'var(--text-secondary)' }}>{deal.storeName}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
