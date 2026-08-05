import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { fetchMarketplaceListings } from "@/lib/usbxApi";
import RarityBadge from "@/app/components/RarityBadge";

export const revalidate = 60;

function formatNumber(num: number | null | undefined) {
  if (!num) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString();
}

const QUICK_LINKS = [
  {
    href: '/market',
    label: 'Market',
    desc: 'Browse every tracked limited',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
    ),
  },
  {
    href: '/deals',
    label: 'Deals',
    desc: 'Listings priced below RAP',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
    ),
  },
  {
    href: '/leaderboards',
    label: 'Leaderboards',
    desc: 'The wealthiest players',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
    ),
  },
  {
    href: '/trade-calculator',
    label: 'Trade Calculator',
    desc: 'Check if a trade is fair',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
    ),
  },
];

export default async function Home() {
  let recentItems: any[] = [];
  let limitedCount = 0;
  let playerCount = 0;
  let salesTracked = 0;

  try {
    const [limitedCountRes, playerCountRes, salesCountRes] = await Promise.all([
      supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_limited', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('item_recent_sales').select('*', { count: 'exact', head: true }),
    ]);

    limitedCount = limitedCountRes.count || 0;
    playerCount = playerCountRes.count || 0;
    salesTracked = salesCountRes.count || 0;
  } catch (err) {
    console.error("Home page fetch error:", err);
  }

  // "Recently uploaded" = newest live marketplace listings, resolved back to
  // our own catalog via catalog_item_id (not our created_at, which just
  // reflects sync order — could be ancient items synced last). Falls back to
  // created_at ordering if the live feed comes back empty (API hiccup, or
  // items not yet backfilled with catalog_item_id).
  try {
    const { listings } = await fetchMarketplaceListings({ limit: 40, sort: 'listedAt' });
    const relevant = listings.filter((l) => l.item.clothingType === null && l.item.normalDetails?.isLimited);
    const catalogIds = [...new Set(relevant.map((l) => l.item.id))];

    if (catalogIds.length > 0) {
      const { data: matched } = await supabase
        .from('items')
        .select('*')
        .in('catalog_item_id', catalogIds)
        .eq('is_limited', true);

      const byCatalogId = new Map((matched || []).map((i: any) => [i.catalog_item_id, i]));
      const seen = new Set<number>();
      for (const listing of relevant) {
        const dbItem = byCatalogId.get(listing.item.id);
        if (dbItem && !seen.has(dbItem.id)) {
          seen.add(dbItem.id);
          recentItems.push(dbItem);
        }
        if (recentItems.length >= 6) break;
      }
    }
  } catch (err) {
    console.error("Live listings fetch failed for homepage:", err instanceof Error ? err.message : err);
  }

  if (recentItems.length === 0) {
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('is_limited', true)
      .order('created_at', { ascending: false })
      .limit(6);
    if (data) recentItems = data;
  }

  const stats = [
    { label: 'Limiteds Tracked', value: formatNumber(limitedCount) },
    { label: 'Players Tracked', value: formatNumber(playerCount) },
    { label: 'Sales Tracked', value: formatNumber(salesTracked) },
  ];

  return (
    <div>
      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '4.5rem 0 3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Know what your limiteds are actually worth.
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', marginBottom: '2rem', maxWidth: '560px', margin: '0 auto 2.5rem auto', lineHeight: 1.6 }}>
          <span style={{ color: '#e2b955', fontWeight: 700 }}>usbx</span><span style={{ color: '#8353e4', fontWeight: 700 }}>.</span><span style={{ fontWeight: 700 }}>trade</span> tracks live RAP, values, and market activity for every limited in untitled-sandbox, so you&apos;re not just guessing.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/market" className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
            Explore the Market
          </Link>
          <Link href="/deals" className="btn btn-secondary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
            See Today&apos;s Deals
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
        {stats.map((stat) => (
          <div key={stat.label} className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--rare-color)', marginBottom: '0.25rem' }}>{stat.value}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Quick links */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="card"
              style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}
            >
              <div style={{ color: 'var(--accent-color)', flexShrink: 0 }}>{link.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{link.label}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{link.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recently uploaded */}
      <section className="page-surface fade-in">
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ fontSize: '1.6rem' }}>Recently Uploaded Limiteds</h2>
          <Link href="/market" style={{ color: 'var(--accent-color)' }}>View all &rarr;</Link>
        </div>

        {recentItems.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No items found. Run the scraper in the Admin panel to add some!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
            {recentItems.map((item: any) => (
              <Link href={`/items/${item.id}`} key={item.id} className="card" style={{ display: 'block', textDecoration: 'none' }}>
                <div style={{ position: 'relative', height: '200px', backgroundColor: 'var(--bg-tertiary)' }}>
                  {item.is_limited && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #EF4444', color: '#EF4444', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '4px', zIndex: 10 }}>
                      LIMITED
                    </div>
                  )}

                  <RarityBadge owners={item.available_owners} />

                  {item.item_image_url ? (
                    <Image src={item.item_image_url} alt={item.name} fill style={{ objectFit: 'contain', padding: '1rem' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>No Image</div>
                  )}
                </div>
                <div style={{ padding: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
