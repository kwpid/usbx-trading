import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const revalidate = 30;

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
  const m = Math.floor(diff / (1000 * 60));
  if (d > 1) return `${d} days ago`;
  if (d === 1) return '1 day ago';
  if (h > 1) return `${h} hours ago`;
  if (h === 1) return '1 hour ago';
  if (m > 1) return `${m} mins ago`;
  return 'Just now';
}

export default async function RecentSalesPage(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams;
  const page = searchParams.page ? Math.max(1, parseInt(searchParams.page, 10)) : 1;
  const pageSize = 16;

  const { data: salesData, error: salesError, count } = await supabase
    .from('item_recent_sales')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (salesError) {
    console.error('Error fetching recent sales:', salesError.message);
  }

  const sales = salesData || [];
  const totalItems = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const itemIds = [...new Set(sales.map((s) => s.item_id))];
  let itemsById = new Map<number, any>();
  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from('items')
      .select('id, name, item_image_url, rap')
      .in('id', itemIds);
    itemsById = new Map((items || []).map((i) => [i.id, i]));
  }

  return (
    <div className="container" style={{ padding: '0', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Recent Sales</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.25rem' }}>
            Live resale activity, tracked as it happens
          </div>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link
              href={`/recent-sales?page=${page - 1}`}
              className="btn"
              style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', pointerEvents: page <= 1 ? 'none' : 'auto', opacity: page <= 1 ? 0.5 : 1 }}
            >
              ◀
            </Link>
            <div className="btn" style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)' }}>
              {page} / {totalPages}
            </div>
            <Link
              href={`/recent-sales?page=${page + 1}`}
              className="btn"
              style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', pointerEvents: page >= totalPages ? 'none' : 'auto', opacity: page >= totalPages ? 0.5 : 1 }}
            >
              ▶
            </Link>
          </div>
        )}
      </div>

      {sales.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No sales recorded yet. Sales are picked up automatically as they happen on USBX.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {sales.map((sale) => {
            const item = itemsById.get(sale.item_id);
            const rap = item?.rap ?? null;
            const discountPct = rap && rap > 0 && sale.price != null ? ((rap - sale.price) / rap) * 100 : null;

            return (
              <Link href={`/items/${sale.item_id}`} key={sale.id} className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textDecoration: 'none' }}>
                <div style={{ padding: '0.75rem', fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--bg-tertiary)' }}>
                  {item?.name || `Item #${sale.item_id}`}
                </div>

                <div style={{ position: 'relative', height: '140px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item?.item_image_url ? (
                    <Image src={item.item_image_url} alt={item.name} fill style={{ objectFit: 'contain', padding: '1rem' }} />
                  ) : (
                    <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                  )}
                  {sale.serial_number && (
                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'var(--bg-secondary)', color: 'var(--accent-color)', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '4px' }}>
                      #{sale.serial_number}
                    </div>
                  )}
                </div>

                <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem', backgroundColor: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Price</span>
                    <span style={{ fontWeight: 'bold' }}>{formatNumber(sale.price)}</span>
                  </div>
                  {rap != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>RAP</span>
                      <span>{formatNumber(rap)}</span>
                    </div>
                  )}
                  {discountPct !== null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>vs RAP</span>
                      <span style={{ color: discountPct >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                        {discountPct >= 0 ? `${discountPct.toFixed(0)}% below` : `${Math.abs(discountPct).toFixed(0)}% above`}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Buyer</span>
                    <span>{sale.buyer_username || 'Unknown'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Seller</span>
                    <span>{sale.seller_username || 'Official Release'}</span>
                  </div>

                  <div style={{ color: 'var(--success-color)', fontSize: '0.9rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                    {timeAgo(sale.purchased_at || sale.created_at)}
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
