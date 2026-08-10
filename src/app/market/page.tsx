import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import RarityBadge from "@/app/components/RarityBadge";
import MarketControls from "./MarketControls";
import { escapePostgrestValue } from "@/lib/searchSanitize";

export const revalidate = 60;

function formatNumber(num: number | null) {
  if (num === null || num === undefined) return '-';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const SORT_COLUMNS: Record<string, string> = {
  value: 'value',
  rap: 'rap',
  price_best_resale: 'price_best_resale',
  owners: 'available_owners',
};

export default async function MarketPage(props: { searchParams: Promise<{ page?: string; all?: string; q?: string; sort?: string }> }) {
  const searchParams = await props.searchParams;
  const currentPage = parseInt(searchParams?.page || "1", 10);
  const showAll = searchParams?.all === '1';
  const query = searchParams?.q?.trim() || '';
  const sortKey = searchParams?.sort && SORT_COLUMNS[searchParams.sort] ? searchParams.sort : 'value';
  const sortColumn = SORT_COLUMNS[sortKey];
  // Rarest-first makes more sense ascending (fewest owners first); everything else descending.
  const sortAscending = sortKey === 'owners';
  const pageSize = 12; // Items per page

  let items = [];
  let totalCount = 0;

  try {
    let dbQuery = supabase
      .from('items')
      .select('*', { count: 'exact' })
      .order(sortColumn, { ascending: sortAscending, nullsFirst: false });

    if (!showAll) {
      dbQuery = dbQuery.eq('is_limited', true);
    }
    if (query) {
      const esc = escapePostgrestValue(query);
      dbQuery = dbQuery.or(`name.ilike."%${esc}%",acronym.ilike."%${esc}%"`);
    }

    const { data, error, count } = await dbQuery.range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

    if (!error && data) {
      items = data;
      totalCount = count || 0;
    }
  } catch (err) {
    console.error("Supabase fetch error:", err);
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const buildQuery = (overrides: { page?: number; all?: boolean } = {}) => {
    const params = new URLSearchParams();
    const page = overrides.page ?? currentPage;
    const all = overrides.all ?? showAll;
    if (page > 1) params.set('page', String(page));
    if (all) params.set('all', '1');
    if (query) params.set('q', query);
    if (sortKey !== 'value') params.set('sort', sortKey);
    const qs = params.toString();
    return qs ? `/market?${qs}` : '/market';
  };

  // Generate pagination range (e.g. 1 2 3 ... 10)
  const renderPagination = () => {
    let pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    return pages.map((p, i) => {
      if (p === '...') {
        return <span key={`ellipsis-${i}`} style={{ color: 'var(--text-secondary)', padding: '0.4rem' }}>...</span>;
      }
      return (
        <Link
          key={`page-${p}`}
          href={buildQuery({ page: p as number })}
          className="btn"
          style={{
            backgroundColor: p === currentPage ? 'var(--bg-tertiary)' : 'transparent',
            color: p === currentPage ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: p === currentPage ? '1px solid var(--border-color)' : 'none',
            padding: '0.4rem 0.8rem',
            borderRadius: '4px',
            textDecoration: 'none'
          }}
        >
          {p}
        </Link>
      );
    });
  };

  return (
    <div className="page-surface fade-in">
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <Suspense fallback={null}>
          <MarketControls />
        </Suspense>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          {currentPage > 1 ? (
            <Link href={buildQuery({ page: currentPage - 1 })} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', textDecoration: 'none' }}>&larr;</Link>
          ) : (
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', opacity: 0.5, cursor: 'not-allowed' }}>&larr;</button>
          )}

          {renderPagination()}

          {currentPage < totalPages ? (
            <Link href={buildQuery({ page: currentPage + 1 })} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', textDecoration: 'none' }}>&rarr;</Link>
          ) : (
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', opacity: 0.5, cursor: 'not-allowed' }}>&rarr;</button>
          )}

          <Link
            href={buildQuery({ page: 1, all: !showAll })}
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', textDecoration: 'none' }}
          >
            {showAll ? 'Limiteds Only' : 'Show All Items'}
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
        {items.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', gridColumn: '1 / -1', color: 'var(--text-secondary)' }}>
            No items match{query ? ` "${query}"` : ' this filter'}.
          </div>
        ) : items.map((item: any) => (
          <Link href={`/items/${item.id}`} key={item.id} className="card" style={{ display: 'block', textDecoration: 'none' }}>
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.name}
            </div>

            <div style={{ position: 'relative', height: '180px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               {item.is_limited && (
                  <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #EF4444', color: '#EF4444', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '4px', zIndex: 10 }}>
                    LIMITED
                  </div>
                )}

                <RarityBadge copies={item.copies_sold} />

                {item.item_image_url ? (
                  <Image src={item.item_image_url} alt={item.name} fill style={{ objectFit: 'contain', padding: '1rem' }} />
                ) : (
                  <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                )}
            </div>

            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Price</span>
                <span style={{ fontWeight: '500' }}>{formatNumber(item.price_best_resale)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>RAP</span>
                <span style={{ fontWeight: '500' }}>{formatNumber(item.rap)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Value</span>
                <span style={{ fontWeight: '500', color: 'var(--rare-color)' }}>{formatNumber(item.value)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Available</span>
                <span style={{ fontWeight: '500' }}>{item.available_owners !== null ? item.available_owners : '-'}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
