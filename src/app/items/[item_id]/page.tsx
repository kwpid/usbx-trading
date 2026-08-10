import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { UsbxSale } from "@/lib/usbxApi";
import { getRarity, RARITY_EMOJI, RARITY_LABEL } from "@/lib/rarity";
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

// Rough trend from recent sale prices — sales come in newest-first, so
// reverse to chronological order and compare the earlier half's average
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

type OwnerRowWithAvatar = {
  serialId: number;
  serialNumber: string;
  acquiredAt: string | null;
  owner: { id: number; username: string } | null;
  avatarUrl: string | null;
};

type HoarderEntry = { id: number; username: string; avatarUrl: string | null; count: number; latestAcquiredAt: string | null };

function buildHoarders(rows: OwnerRowWithAvatar[]): HoarderEntry[] {
  const map = new Map<number, HoarderEntry>();
  for (const row of rows) {
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
        avatarUrl: row.avatarUrl,
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

  // Everything on this page is a plain DB read — no live USBX calls here at
  // all. Ownership, sales, and RAP/owner counts are all kept fresh by
  // background jobs (the event poller, catalog discovery, the daily full
  // refresh), same model Rolimons uses: the site serves from its own
  // database, background workers are what keep that database current.
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

  // Persisted per-serial ownership snapshot (item_owners), refreshed in the
  // background — not fetched live here.
  const { data: ownerRows } = await supabase
    .from('item_owners')
    .select('serial_id, serial_number, owner_usbx_id, owner_username, owner_avatar_url, acquired_at')
    .eq('item_id', item.id)
    .order('acquired_at', { ascending: false });

  const ownerIds = [...new Set((ownerRows || []).map((r) => r.owner_usbx_id).filter((id): id is number => id != null))];
  let avatarByUserId = new Map<number, string | null>();
  if (ownerIds.length > 0) {
    const { data: ownerProfiles } = await supabase
      .from('profiles')
      .select('usbx_user_id, usbx_avatar_url')
      .in('usbx_user_id', ownerIds);
    avatarByUserId = new Map((ownerProfiles || []).map((p) => [p.usbx_user_id, p.usbx_avatar_url]));
  }

  const ownersWithAvatar: OwnerRowWithAvatar[] = (ownerRows || []).map((row) => ({
    serialId: row.serial_id,
    serialNumber: row.serial_number || '?',
    acquiredAt: row.acquired_at,
    owner: row.owner_usbx_id ? { id: row.owner_usbx_id, username: row.owner_username || 'Unknown' } : null,
    avatarUrl: (row.owner_usbx_id ? avatarByUserId.get(row.owner_usbx_id) : null) || row.owner_avatar_url || null,
  }));

  // Persisted sales feed (item_recent_sales), populated by the event poller
  // — price is already stored in scrips, so tag currency as SCRIPS to skip
  // ItemCharts' token->scrips conversion.
  const { data: saleRows } = await supabase
    .from('item_recent_sales')
    .select('event_id, sale_type, price, serial_number, buyer_username, buyer_usbx_id, seller_username, seller_usbx_id, purchased_at')
    .eq('item_id', item.id)
    .order('purchased_at', { ascending: false })
    .limit(50);

  const recentSales: UsbxSale[] = (saleRows || []).map((s) => ({
    eventId: s.event_id,
    type: s.sale_type || '',
    price: s.price,
    purchasedAt: s.purchased_at,
    currency: { code: 'SCRIPS' },
    serial: s.serial_number ? { serialNumber: s.serial_number } : null,
    buyer: s.buyer_usbx_id && s.buyer_username ? { id: s.buyer_usbx_id, username: s.buyer_username } : null,
    seller: s.seller_usbx_id && s.seller_username ? { id: s.seller_usbx_id, username: s.seller_username } : null,
  }));

  // Simulates the next sale happening at the current lowest resale price,
  // then recomputes the trailing average RAP with that sale folded in
  // (RAP is just the average of every recorded sale, so
  // newRap = (rap * totalSales + nextSalePrice) / (totalSales + 1)).
  let rapAfterSale: number | null = null;
  if (item.total_sales != null && item.rap != null && item.price_best_resale != null) {
    rapAfterSale = Math.round((item.rap * item.total_sales + item.price_best_resale) / (item.total_sales + 1));
  }

  const hoarders = buildHoarders(ownersWithAvatar);
  const knownOwners = hoarders.length;
  const totalCopies = item.copies_sold ?? ownersWithAvatar.length;
  const topHoarder = [...hoarders].sort((a, b) => b.count - a.count)[0] ?? null;
  const accountedPct = totalCopies > 0 ? Math.min(100, Math.round((ownersWithAvatar.length / totalCopies) * 100)) : null;
  const topHoards = [...hoarders].sort((a, b) => b.count - a.count).slice(0, 5);

  // Derived variables
  const rarity = getRarity(totalCopies);
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

        {ownersWithAvatar.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Ownership data hasn&apos;t been synced for this item yet.
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

              <OwnersList owners={ownersWithAvatar} />

              {/* Top Hoards */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  Top Hoards
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {topHoards.map((hoard) => (
                    <div key={hoard.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                      <Link href={`/player/${hoard.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
                        {hoard.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hoard.avatarUrl} alt={hoard.username} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', backgroundColor: 'var(--bg-secondary)' }} />
                        ) : (
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }} />
                        )}
                        <span style={{ fontWeight: '500', color: 'var(--accent-hover)' }}>{hoard.username}</span>
                      </Link>
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
