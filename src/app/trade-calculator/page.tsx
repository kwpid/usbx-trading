import { supabase } from "@/lib/supabase";
import TradeCalculator from './TradeCalculator';

const PAGE_SIZE = 12;

export default async function TradeCalculatorPage(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams;
  const currentPage = Math.max(1, parseInt(searchParams?.page || '1', 10));

  let items: any[] = [];
  let totalCount = 0;
  try {
    const { data, error, count } = await supabase
      .from('items')
      .select('id, name, item_image_url, rap, value, available_owners, is_limited', { count: 'exact' })
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
    <div className="page-surface fade-in" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Trade Calculator</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Click "You Give" or "You Receive" to pick which side you're adding to, then click items below to fill its slots.
      </p>
      <TradeCalculator initialItems={items} currentPage={currentPage} totalPages={totalPages} />
    </div>
  );
}
