import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { SnapshotItem } from '@/lib/snapshot';

// Daily fallback so every tracked player gets at least one history point
// per day, even if nobody visits their profile (the normal trigger, via
// RecordSnapshot). Paginated like the other full-sync jobs to stay under
// serverless time limits; call repeatedly with the returned page until
// done === true.
const BATCH_SIZE = 50;

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [{ data: ownerRows }, { data: profileRows }] = await Promise.all([
    supabase.from('item_owners').select('owner_usbx_id'),
    supabase.from('profiles').select('usbx_user_id'),
  ]);
  const allPlayerIds = [...new Set([
    ...(ownerRows || []).map((r) => r.owner_usbx_id),
    ...(profileRows || []).map((r) => r.usbx_user_id),
  ])].sort((a, b) => a - b);

  const totalPlayers = allPlayerIds.length;
  const totalPages = Math.max(1, Math.ceil(totalPlayers / BATCH_SIZE));
  const batch = allPlayerIds.slice((page - 1) * BATCH_SIZE, page * BATCH_SIZE);

  if (batch.length === 0) {
    return NextResponse.json({ snapshotted: 0, skipped: 0, page, totalPages, done: true });
  }

  // Skip anyone a profile visit already snapshotted today.
  const { data: existingToday } = await supabase
    .from('player_value_history')
    .select('usbx_user_id')
    .in('usbx_user_id', batch)
    .gte('created_at', todayStart.toISOString());
  const alreadyDone = new Set((existingToday || []).map((r) => r.usbx_user_id));
  const remaining = batch.filter((id) => !alreadyDone.has(id));

  if (remaining.length === 0) {
    return NextResponse.json({ snapshotted: 0, skipped: batch.length, page, totalPages, done: page >= totalPages });
  }

  const { data: allItems } = await supabase
    .from('items')
    .select('id, name, item_image_url, rap, value')
    .eq('is_limited', true);
  const itemsById = new Map((allItems || []).map((i) => [i.id, i]));

  const { data: ownedRows } = await supabase
    .from('item_owners')
    .select('owner_usbx_id, item_id, serial_number')
    .in('owner_usbx_id', remaining);

  const byPlayer = new Map<number, { item_id: number; serial_number: string | null }[]>();
  for (const row of ownedRows || []) {
    const list = byPlayer.get(row.owner_usbx_id) ?? [];
    list.push(row);
    byPlayer.set(row.owner_usbx_id, list);
  }

  const rows = remaining.map((userId) => {
    const owned = byPlayer.get(userId) || [];
    const stacked = new Map<number, SnapshotItem>();
    for (const row of owned) {
      const item = itemsById.get(row.item_id);
      if (!item) continue;
      const existing = stacked.get(row.item_id);
      if (existing) {
        existing.copies++;
        existing.serials.push(row.serial_number || '?');
      } else {
        stacked.set(row.item_id, {
          id: item.id,
          name: item.name,
          imageUrl: item.item_image_url,
          rap: item.rap || 0,
          value: item.value || 0,
          copies: 1,
          serials: [row.serial_number || '?'],
        });
      }
    }
    const inventorySnapshot = [...stacked.values()];
    return {
      usbx_user_id: userId,
      total_rap: inventorySnapshot.reduce((s, i) => s + i.rap * i.copies, 0),
      total_value: inventorySnapshot.reduce((s, i) => s + i.value * i.copies, 0),
      inventory_snapshot: inventorySnapshot,
    };
  });

  const { error } = await supabase.from('player_value_history').insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    snapshotted: rows.length,
    skipped: alreadyDone.size,
    page,
    totalPages,
    done: page >= totalPages,
  });
}
