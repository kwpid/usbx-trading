import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RarityBadge from "@/app/components/RarityBadge";
import TradeCalculator from './TradeCalculator';

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

const PAGE_SIZE = 12;

export default async function TradeCalculatorPage(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams;
  const currentPage = Math.max(1, parseInt(searchParams?.page || '1', 10));

  let items: any[] = [];
  let totalCount = 0;
  try {
    const { data, error, count } = await supabase
      .from('items')
      .select('*', { count: 'exact' })
      .order('value', { ascending: false, nullsFirst: false })
      .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

    if (!error && data) {
      items = data;
      totalCount = count || 0;
    }
  } catch (err) {
    console.error('Trade calculator item browse fetch error:', err);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Trade Calculator</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Add items to each side to simulate a trade and compare total RAP/Value.
      </p>
      <TradeCalculator />

      {/* Browse all items, for reference while building a trade */}
      <div style={{ marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Browse Items</h2>

        {items.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No items found.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {items.map((item) => (
              <Link href={`/items/${item.id}`} key={item.id} className="card" style={{ display: 'block', textDecoration: 'none' }}>
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ position: 'relative', height: '160px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.is_limited && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #EF4444', color: '#EF4444', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '4px', zIndex: 10 }}>
                      LIMITED
                    </div>
                  )}
                  <RarityBadge owners={item.available_owners} />
                  {item.item_image_url ? (
                    <Image src={item.item_image_url} alt={item.name} fill style={{ objectFit: 'contain', padding: '1rem' }} />
                  ) : (
                    <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                  )}
                </div>
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>RAP</span>
                    <span style={{ fontWeight: '500' }}>{formatNumber(item.rap)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Value</span>
                    <span style={{ fontWeight: '500', color: 'var(--rare-color)' }}>{formatNumber(item.value)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
            <Link
              href={`/trade-calculator?page=${currentPage - 1}`}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.6rem', textDecoration: 'none', pointerEvents: currentPage <= 1 ? 'none' : 'auto', opacity: currentPage <= 1 ? 0.5 : 1 }}
            >
              &larr;
            </Link>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>
              Page {currentPage} of {totalPages}
            </span>
            <Link
              href={`/trade-calculator?page=${currentPage + 1}`}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.6rem', textDecoration: 'none', pointerEvents: currentPage >= totalPages ? 'none' : 'auto', opacity: currentPage >= totalPages ? 0.5 : 1 }}
            >
              &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
