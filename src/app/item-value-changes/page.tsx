import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const revalidate = 60;

function formatNumber(num: number | string | null | undefined) {
  if (num === null || num === undefined) return '-';
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  return isNaN(n) ? String(num) : n.toLocaleString();
}

function timeAgo(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const diff = Date.now() - new Date(dateString).getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor(diff / (1000 * 60 * 60));

  if (d > 14) return `${Math.floor(d / 7)} weeks ago`;
  if (d >= 7) return `1 week ago`;
  if (d > 1) return `${d} days ago`;
  if (d === 1) return `1 day ago`;
  if (h > 1) return `${h} hours ago`;
  if (h === 1) return `1 hour ago`;
  return 'Just now';
}

export default async function ValueChangesPage(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams;
  const page = searchParams.page ? Math.max(1, parseInt(searchParams.page, 10)) : 1;
  const pageSize = 12;

  const { data: changesData, error: changesError, count } = await supabase
    .from('item_value_changes')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (changesError) {
    console.error("Error fetching value changes:", changesError);
  }

  const changes = changesData || [];
  const totalItems = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Batch-fetch the items these changes belong to (avoids relying on a
  // Supabase FK relationship being set up for embedded selects).
  const itemIds = [...new Set(changes.map((c) => c.item_id))];
  let itemsById = new Map<number, any>();
  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from('items')
      .select('id, name, item_image_url')
      .in('id', itemIds);
    itemsById = new Map((items || []).map((i) => [i.id, i]));
  }

  return (
    <div className="container" style={{ padding: '0', maxWidth: '1200px' }}>

      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Value Changes</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.25rem' }}>
            Most recently changed item values across the site
          </div>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link
              href={`/item-value-changes?page=${page - 1}`}
              className="btn"
              style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', pointerEvents: page <= 1 ? 'none' : 'auto', opacity: page <= 1 ? 0.5 : 1 }}
            >
              ◀
            </Link>
            <div className="btn" style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)' }}>
              {page} / {totalPages}
            </div>
            <Link
              href={`/item-value-changes?page=${page + 1}`}
              className="btn"
              style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', pointerEvents: page >= totalPages ? 'none' : 'auto', opacity: page >= totalPages ? 0.5 : 1 }}
            >
              ▶
            </Link>
          </div>
        )}
      </div>

      {/* Grid of Changes */}
      {changes.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No value changes recorded yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {changes.map((change) => {
            const item = itemsById.get(change.item_id);
            return (
              <Link href={`/items/${change.item_id}`} key={change.id} className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textDecoration: 'none' }}>
                <div style={{ padding: '0.75rem', fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--bg-tertiary)' }}>
                  {item?.name || `Item #${change.item_id}`}
                </div>

                <div style={{ position: 'relative', height: '140px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   {item?.item_image_url ? (
                     <Image src={item.item_image_url} alt={item.name} fill style={{ objectFit: 'contain', padding: '1rem' }} />
                   ) : (
                     <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                   )}
                </div>

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

                  {change.reason && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '1rem', fontStyle: 'italic', padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                      "{change.reason}"
                    </div>
                  )}

                  <div style={{ color: 'var(--success-color)', fontSize: '0.9rem', marginTop: 'auto' }}>
                    {timeAgo(change.created_at)}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {new Date(change.created_at).toLocaleString()}
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
