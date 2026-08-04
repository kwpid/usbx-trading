import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const revalidate = 60;

function formatNumber(num: number | string | null | undefined) {
  if (num === null || num === undefined) return '-';
  if (typeof num === 'string') {
    const parsed = parseInt(num, 10);
    if (!isNaN(parsed) && num.match(/^\d+$/)) {
      return parsed.toLocaleString();
    }
    return num;
  }
  return num.toLocaleString();
}

function timeAgo(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const diff = Date.now() - new Date(dateString).getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor(diff / (1000 * 60 * 60));
  
  if (d > 14) return `${Math.floor(d/7)} weeks ago`;
  if (d >= 7) return `1 week ago`;
  if (d > 1) return `${d} days ago`;
  if (d === 1) return `1 day ago`;
  if (h > 1) return `${h} hours ago`;
  if (h === 1) return `1 hour ago`;
  return 'Just now';
}

export default async function ItemValueChangesPage(props: { params: Promise<{ item_id: string }>, searchParams: Promise<{ page?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const itemId = params.item_id;
  const page = searchParams.page ? Math.max(1, parseInt(searchParams.page, 10)) : 1;
  const pageSize = 12;

  // Fetch item from database
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (itemError || !item) {
    notFound();
  }

  // Fetch actual value changes
  const { data: changesData, error: changesError, count } = await supabase
    .from('item_value_changes')
    .select('*', { count: 'exact' })
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (changesError) {
    console.error("Error fetching value changes:", changesError);
  }

  const changes = changesData || [];
  const totalItems = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return (
    <div className="container" style={{ padding: '0', maxWidth: '1200px' }}>
      
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            {item.name} 
            <Link href={`/items/${item.id}`} style={{ color: 'var(--text-secondary)', fontSize: '1.5rem', textDecoration: 'none' }}>
              ↗
            </Link>
          </h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginTop: '0.25rem' }}>
            Item Value Changes
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link 
                href={`/item-value-changes/${itemId}?page=${page - 1}`}
                className={`btn ${page <= 1 ? 'disabled' : ''}`} 
                style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', pointerEvents: page <= 1 ? 'none' : 'auto', opacity: page <= 1 ? 0.5 : 1 }}
              >
                ◀
              </Link>
              <div className="btn" style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)' }}>
                {page} / {totalPages}
              </div>
              <Link 
                href={`/item-value-changes/${itemId}?page=${page + 1}`}
                className={`btn ${page >= totalPages ? 'disabled' : ''}`} 
                style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', pointerEvents: page >= totalPages ? 'none' : 'auto', opacity: page >= totalPages ? 0.5 : 1 }}
              >
                ▶
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Changes */}
      {changes.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No value changes recorded for this item yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {changes.map((change) => (
            <div key={change.id} className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Card Header */}
              <div style={{ padding: '0.75rem', fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--bg-tertiary)' }}>
                {item.name}
              </div>
              
              {/* Image Box */}
              <div style={{ position: 'relative', height: '140px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 {item.item_image_url ? (
                   <Image src={item.item_image_url} alt={item.name} fill style={{ objectFit: 'contain', padding: '1rem' }} />
                 ) : (
                   <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                 )}
              </div>

              {/* Change Details Box */}
              <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ color: '#3b82f6', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {change.type}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Old</span>
                  <span style={{ fontWeight: '500' }}>{formatNumber(change.old_val)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>New</span>
                  <span style={{ fontWeight: 'bold', color: change.is_increase ? 'var(--success-color)' : 'var(--danger-color)' }}>
                     {change.type === 'Value Changed' && (change.is_increase ? '↑ ' : '↓ ')}
                     {formatNumber(change.new_val)}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '1rem', fontStyle: 'italic', padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                  "{change.reason}"
                </div>

                <div style={{ color: 'var(--success-color)', fontSize: '0.9rem', marginTop: 'auto' }}>
                  {timeAgo(change.created_at)}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {new Date(change.created_at).toLocaleString()}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
