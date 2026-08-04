import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RarityBadge from "@/app/components/RarityBadge";

export const revalidate = 60;

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

// "Projected" (Roblox/Rolimons terminology): an item whose RAP has been
// pushed artificially high — usually by a small group of traders repeatedly
// reselling it to each other — well above what the wider trading community
// actually considers it worth. We don't have the trade graph to detect the
// "small circle of traders" signal directly, so we approximate it the way
// most trading sites surface a warning: RAP sitting meaningfully above the
// community-assessed Value. A real trade at that price is losing value the
// moment it lands, which is the practical harm projecting causes traders.
const PROJECTED_RATIO_THRESHOLD = 1.15; // RAP at least 15% above Value

export default async function ProjectedItemsPage() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('is_limited', true)
    .not('rap', 'is', null)
    .not('value', 'is', null)
    .gt('value', 0)
    .limit(500);

  if (error) {
    console.error('Error fetching items for projected list:', error.message);
  }

  const projected = (data || [])
    .map((item) => ({ ...item, ratio: item.rap / item.value }))
    .filter((item) => item.ratio >= PROJECTED_RATIO_THRESHOLD)
    .sort((a, b) => b.ratio - a.ratio);

  return (
    <div>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Projected Items</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '700px' }}>
        Items whose RAP is sitting well above their assigned Value — usually a sign a small group
        of traders is inflating the resale price rather than it reflecting real demand. Trading
        for one of these at RAP is likely to lose value fast. Flagged when RAP is at least{' '}
        {Math.round((PROJECTED_RATIO_THRESHOLD - 1) * 100)}% above Value.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
        {projected.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', gridColumn: '1 / -1', color: 'var(--text-secondary)' }}>
            No projected items found right now.
          </div>
        ) : projected.map((item) => (
          <Link href={`/items/${item.id}`} key={item.id} className="card" style={{ display: 'block', textDecoration: 'none' }}>
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.name}
            </div>

            <div style={{ position: 'relative', height: '180px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(249, 115, 22, 0.2)', border: '1px solid #F97316', color: '#F97316', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '4px', zIndex: 10 }}>
                📈 PROJECTED
              </div>

              <RarityBadge owners={item.available_owners} />

              {item.item_image_url ? (
                <Image src={item.item_image_url} alt={item.name} fill style={{ objectFit: 'contain', padding: '1rem' }} />
              ) : (
                <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
              )}
            </div>

            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>RAP</span>
                <span style={{ fontWeight: '500' }}>{formatNumber(item.rap)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Value</span>
                <span style={{ fontWeight: '500', color: 'var(--rare-color)' }}>{formatNumber(item.value)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Inflation</span>
                <span style={{ fontWeight: '500', color: '#F97316' }}>+{Math.round((item.ratio - 1) * 100)}%</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
