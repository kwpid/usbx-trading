import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Returns the last 90 days of price/RAP/owners snapshots for a single item.
// Used by ItemCharts to render real historical trend lines.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ item_id: string }> }
) {
  const { item_id } = await params;
  const id = Number(item_id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data, error } = await supabase
    .from('item_price_history')
    .select('recorded_at, rap, value, price_best_resale, available_owners, copies_sold')
    .eq('item_id', id)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data ?? [] });
}
