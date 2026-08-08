import { supabase } from './supabase';
import { fetchItemOwners } from './usbxApi';
import { resolveUsbxAssetUrl } from './usbxAssets';

// Persists a full per-serial ownership snapshot for one item into
// item_owners, so item pages can read ownership instantly from our own DB
// instead of calling USBX live on every visit (Rolimons-style: the site
// serves from its own database, background jobs keep it fresh). Called from
// every background sync path that already fetches owners (event poller,
// catalog discovery, the daily full refresh) — never from a page view.
export async function syncItemOwners(itemId: number, listingId: number) {
  const owners = await fetchItemOwners(listingId).catch(() => []);
  const uniqueOwners = new Set(owners.map((o) => o.owner?.id).filter(Boolean)).size;

  // Replace this item's snapshot wholesale — simplest correct way to drop
  // serials that changed hands or vanished, without diffing row by row.
  await supabase.from('item_owners').delete().eq('item_id', itemId);

  if (owners.length > 0) {
    const rows = owners
      .filter((o) => o.owner)
      .map((o) => ({
        item_id: itemId,
        serial_id: o.serialId,
        serial_number: o.serialNumber,
        owner_usbx_id: o.owner!.id,
        owner_username: o.owner!.username,
        owner_avatar_url: resolveUsbxAssetUrl(o.owner!.profile?.headshotUrl),
        acquired_at: o.acquiredAt,
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from('item_owners').insert(rows);
      if (error) console.warn(`Failed to persist owners for item ${itemId}: ${error.message}`);
    }
  }

  return { owners, uniqueOwners };
}
