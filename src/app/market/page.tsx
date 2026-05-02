import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const revalidate = 60;

function formatNumber(num: number | null) {
  if (num === null || num === undefined) return '-';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default async function MarketPage(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams;
  const currentPage = parseInt(searchParams?.page || "1", 10);
  const pageSize = 12; // Items per page
  
  let items = [];
  let totalCount = 0;
  
  try {
    const { data, error, count } = await supabase
      .from('items')
      .select('*', { count: 'exact' })
      .order('value', { ascending: false, nullsFirst: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);
      
    if (!error && data) {
      items = data;
      totalCount = count || 0;
    }
  } catch (err) {
    console.error("Supabase fetch error:", err);
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

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
          href={`/market?page=${p}`}
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
    <div>
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {["Highest Value", "Asset Types", "Demand", "Trend", "Categories", "Range Filters"].map(filter => (
            <button key={filter} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
              {filter}
            </button>
          ))}
        </div>
        <div className="input-group" style={{ marginBottom: '1rem' }}>
          <input type="text" className="input" placeholder="Search items..." style={{ backgroundColor: 'var(--bg-tertiary)' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          {currentPage > 1 ? (
            <Link href={`/market?page=${currentPage - 1}`} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', textDecoration: 'none' }}>&larr;</Link>
          ) : (
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', opacity: 0.5, cursor: 'not-allowed' }}>&larr;</button>
          )}
          
          {renderPagination()}
          
          {currentPage < totalPages ? (
            <Link href={`/market?page=${currentPage + 1}`} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', textDecoration: 'none' }}>&rarr;</Link>
          ) : (
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', opacity: 0.5, cursor: 'not-allowed' }}>&rarr;</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
        {items.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', gridColumn: '1 / -1', color: 'var(--text-secondary)' }}>
            No items available on this page.
          </div>
        ) : items.map((item: any) => (
          <div key={item.id} className="card">
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.name}
            </div>
            
            <div style={{ position: 'relative', height: '180px', backgroundColor: '#1a1a1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               {item.is_limited && (
                  <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #EF4444', color: '#EF4444', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '4px', zIndex: 10 }}>
                    LIMITED
                  </div>
                )}

                {/* Rare diamond emoji if owners <= 15 */}
                {item.available_owners <= 15 && item.available_owners !== null && (
                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', fontSize: '1.2rem', zIndex: 10, filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.8))' }} title="Rare Item (15 owners or less)">
                    💎
                  </div>
                )}

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
          </div>
        ))}
      </div>
    </div>
  );
}
