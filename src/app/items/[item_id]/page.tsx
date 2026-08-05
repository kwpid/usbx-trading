import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchItem, fetchItemOwners, fetchItemRecentSales, fetchItemRap, UsbxOwnerRow, UsbxSale } from "@/lib/usbxApi";
import { getRarity, RARITY_EMOJI, RARITY_LABEL } from "@/lib/rarity";
import { tokensToScrips } from "@/lib/currency";
import ItemCharts from "./ItemCharts";
import ItemDetailsTabs from "./ItemDetailsTabs";
import OwnersList from "./OwnersList";

export const revalidate = 60;

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function timeAgo(iso: string | null) {
  if (!iso) return '-';
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function average(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Rough trend from recent sale prices — the API returns sales newest-first,
// so reverse to chronological order and compare the earlier half's average
// price to the later half's.
function computeTrend(sales: UsbxSale[]): string {
  const priced = sales.filter((s) => typeof s.price === 'number').slice().reverse();
  if (priced.length < 2) return '-';
  const mid = Math.floor(priced.length / 2);
  const earlierAvg = average(priced.slice(0, mid).map((s) => s.price as number));
  const laterAvg = average(priced.slice(mid).map((s) => s.price as number));
  if (laterAvg > earlierAvg * 1.05) return 'Rising';
  if (laterAvg < earlierAvg * 0.95) return 'Falling';
  return 'Stable';
}

type HoarderEntry = { id: number; username: string; headshotUrl: string | null; count: number; latestAcquiredAt: string | null };

function buildHoarders(owners: UsbxOwnerRow[]): HoarderEntry[] {
  const map = new Map<number, HoarderEntry>();
  for (const row of owners) {
    const owner = row.owner;
    if (!owner) continue;
    const existing = map.get(owner.id);
    if (existing) {
      existing.count += 1;
      if (row.acquiredAt && (!existing.latestAcquiredAt || row.acquiredAt > existing.latestAcquiredAt)) {
        existing.latestAcquiredAt = row.acquiredAt;
      }
    } else {
      map.set(owner.id, {
        id: owner.id,
        username: owner.username,
        headshotUrl: owner.profile?.headshotUrl ?? null,
        count: 1,
        latestAcquiredAt: row.acquiredAt,
      });
    }
  }
  return [...map.values()];
}

export default async function ItemPage(props: { params: Promise<{ item_id: string }> }) {
  const params = await props.params;
  const itemId = params.item_id;

  // Fetch item from our database (our source of truth for name/image/rap/value/etc.)
  let item = null;
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error) {
      console.error("Supabase error fetching item:", error);
    } else {
      item = data;
    }
  } catch (err) {
    console.error("Error:", err);
  }

  if (!item) {
    notFound();
  }

  // Live USBX data — ownership and sale history fetched using the store
  // listing_id (entry.id from the marketplace), NOT the catalog item id.
  // The /owners and /recent-sales endpoints require the listing id.
  // If listing_id is null (old data pre-fix), fall back to item.id.
  const enrichId: number = (item as any).listing_id ?? item.id;
  let owners: UsbxOwnerRow[] = [];
  let recentSales: UsbxSale[] = [];
  let liveRap: Awaited<ReturnType<typeof fetchItemRap>> = null;
  try {
    [owners, recentSales, liveRap] = await Promise.all([
      fetchItemOwners(enrichId),
      fetchItemRecentSales(enrichId),
      fetchItemRap(enrichId),
    ]);
  } catch (err) {
    console.error("USBX live data fetch failed:", err);
  }

  // Simulates the next sale happening at the current lowest resale price,
  // then recomputes the trailing average RAP with that sale folded in
  // (RAP is just the average of every recorded sale, so
  // newRap = (rap * totalSales + nextSalePrice) / (totalSales + 1)).
  let rapAfterSale: number | null = null;
  if (liveRap && liveRap.totalSales !== null && item.price_best_resale != null) {
    const rapScrips = liveRap.currencyCode === 'TOKENS' ? tokensToScrips(liveRap.rap) : Math.round(liveRap.rap);
    rapAfterSale = Math.round((rapScrips * liveRap.totalSales + item.price_best_resale) / (liveRap.totalSales + 1));
  }

  const hoarders = buildHoarders(owners);
  const knownOwners = hoarders.length;
  const totalCopies = item.copies_sold ?? owners.length;
  const topHoarder = [...hoarders].sort((a, b) => b.count - a.count)[0] ?? null;
  const accountedPct = totalCopies > 0 ? Math.min(100, Math.round((owners.length / totalCopies) * 100)) : null;
  const topHoards = [...hoarders].sort((a, b) => b.count - a.count).slice(0, 5);

  // Derived variables
  const rarity = getRarity(item.available_owners);
  const acronym = item.acronym || '';
  const typeText = (item as any).visual_category || 'Item';
  const trend = computeTrend(recentSales);
  const hoarded = topHoarder && totalCopies > 0 ? `${((topHoarder.count / totalCopies) * 100).toFixed(1)}%` : '-';

  const itemForTabs = { ...item, description: item.description || null };

  return (
    <div className="container" style={{ padding: '0', maxWidth: '1100px' }}>

      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            {item.name} {acronym && <span style={{ color: 'var(--text-secondary)', fontSize: '1.5rem', fontWeight: 'normal' }}>({acronym})</span>}
            {RARITY_EMOJI[rarity] && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--rare-color)', fontSize: '1.2rem', marginLeft: '0.5rem' }}>
                {RARITY_EMOJI[rarity]} <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{RARITY_LABEL[rarity]}</span>
              </span>
            )}
          </h1>
          {item.is_limited && (
            <div style={{ color: 'var(--rare-color)', fontSize: '1.2rem', marginTop: '0.25rem' }}>
              USBX Limited
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {item.source_url && (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              View on USBX
            </a>
          )}
          <Link href={`/items/${item.id}/edit`} className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', backgroundColor: 'var(--accent-hover)' }}>
            Edit Item
          </Link>
          <Link href={`/item-value-changes/${item.id}`} className="btn btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            Value Changes
          </Link>
        </div>
      </div>

      <div className="page-surface fade-in">

      {/* Main Overview Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', marginBottom: '1rem' }}>

        {/* Left: Image Box */}
        <div className="card" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', backgroundColor: 'var(--bg-tertiary)' }}>
           {item.item_image_url ? (
             <Image src={item.item_image_url} alt={item.name} fill style={{ objectFit: 'contain', padding: '1.5rem' }} />
           ) : (
             <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
           )}
        </div>

        {/* Right: Details Overview */}
        <ItemDetailsTabs
          item={itemForTabs}
          typeText={typeText}
          acronym={acronym}
          hoarded={hoarded}
          trend={trend}
          rapAfterSale={rapAfterSale}
        />
      </div>

      {/* 4 Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <div>
             <div style={{ fontSize: '0.85rem', color: 'var(--rare-color)' }}>Price</div>
             <div style={{ fontWeight: 'bold', fontSize: '1.3rem' }}>{formatNumber(item.price_best_resale)}</div>
           </div>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <div>
             <div style={{ fontSize: '0.85rem', color: 'var(--rare-color)' }}>RAP</div>
             <div style={{ fontWeight: 'bold', fontSize: '1.3rem' }}>{formatNumber(item.rap)}</div>
           </div>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <div>
             <div style={{ fontSize: '0.85rem', color: 'var(--rare-color)' }}>Value</div>
             <div style={{ fontWeight: 'bold', fontSize: '1.3rem' }}>{formatNumber(item.value)}</div>
           </div>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <div>
             <div style={{ fontSize: '0.85rem', color: 'var(--rare-color)' }}>Owners</div>
             <div style={{ fontWeight: 'bold', fontSize: '1.3rem' }}>{knownOwners || formatNumber(item.available_owners)}</div>
           </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Charts</h2>
        <ItemCharts item={item} recentSales={recentSales} />
      </div>

      {/* Ownership Summary */}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Ownership</h2>

        {owners.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Live ownership data isn&apos;t available for this item.
          </div>
        ) : (
          <>
            {/* Ownership Top Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Known Owners</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{knownOwners}</div>
              </div>
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Accounted Copies</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{accountedPct !== null ? `${accountedPct}%` : '-'}</div>
              </div>
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Top Hoarder</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--rare-color)' }}>
                  {topHoarder ? `${topHoarder.count} Copies` : '-'}
                </div>
              </div>
            </div>

            {/* Owner Lists */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>

              <OwnersList owners={owners} />

              {/* Top Hoards */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  Top Hoards
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {topHoards.map((hoard) => (
                    <div key={hoard.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                      <span style={{ fontWeight: '500', color: 'var(--accent-hover)' }}>{hoard.username}</span>
                      <span style={{ color: 'var(--rare-color)', fontWeight: 'bold' }}>{hoard.count} Copies</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </>
        )}
      </div>

      </div>

    </div>
  );
}
