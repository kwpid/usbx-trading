import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchProfileSummary, fetchAllProfileInventory, UsbxApiError } from "@/lib/usbxApi";
import { resolveUsbxAssetUrl } from "@/lib/usbxAssets";
import { getSession } from "@/lib/session";
import { logout } from "../../account/actions";
import PlayerChart from "./PlayerChart";
import RecordSnapshot from "./RecordSnapshot";
import ProfileInventoryClient, { InventoryItem } from "./ProfileInventoryClient";

export const dynamic = 'force-dynamic';

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

function timeAgo(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const diff = Date.now() - new Date(dateString).getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m} month${m > 1 ? 's' : ''} ago`;
  const y = Math.floor(d / 365);
  return `${y} year${y > 1 ? 's' : ''} ago`;
}

function StatCell({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      {icon && <div style={{ color: 'var(--text-secondary)', display: 'flex', opacity: 0.8 }}>{icon}</div>}
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.1rem' }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: accent || 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}

export default async function PlayerPage(props: { params: Promise<{ user_id: string }> }) {
  const params = await props.params;
  const userId = params.user_id;

  let summary;
  try {
    summary = await fetchProfileSummary(userId);
  } catch (err) {
    // Log a plain message, not the raw Error — passing an Error object to
    // console.error inside a Server Component triggers Next's dev-mode
    // error overlay even when it's caught and handled right here.
    console.error('Failed to load profile summary:', err instanceof Error ? err.message : err);
    notFound();
  }

  let inventory: Awaited<ReturnType<typeof fetchAllProfileInventory>> = [];
  let inventoryIsPrivate = false;
  try {
    inventory = await fetchAllProfileInventory(userId);
  } catch (err) {
    if (err instanceof UsbxApiError && err.status === 403) {
      // Expected, not a bug — /api/profiles/{id}/inventory returns 403 for
      // a player who has set their inventory to private.
      inventoryIsPrivate = true;
    } else {
      console.error('Failed to load profile inventory:', err instanceof Error ? err.message : err);
    }
  }

  // Cross-reference against our own catalog to find which owned items are
  // limiteds we track, and pull their RAP/Value/image for display — USBX's
  // public inventory endpoint doesn't include pricing data itself.
  // Items acquired via non-store means (gifts, event grants, etc.) can have
  // a null storeItemId — filter those out before querying, since Postgres's
  // .in() rejects a literal null in the list and fails the whole query.
  const storeItemIds = [...new Set(inventory.map((row) => row.item.storeItemId).filter((id): id is number => id != null))];
  let dbItemsById = new Map<number, any>();
  if (storeItemIds.length > 0) {
    const { data, error } = await supabase
      .from('items')
      .select('id, name, rap, value, item_image_url, available_owners')
      .in('id', storeItemIds)
      .eq('is_limited', true);
    if (error) console.error('Failed to load owned item pricing:', error.message);
    dbItemsById = new Map((data || []).map((i) => [i.id, i]));
  }

  // Highest value first, falling back to highest RAP when values aren't
  // set (Value defaults to 0 and is only populated by manual value-change
  // tracking, so most items sort on RAP in practice).
  const collectibles = inventory
    .filter((row) => dbItemsById.has(row.item.storeItemId))
    .sort((a, b) => {
      const itemA = dbItemsById.get(a.item.storeItemId);
      const itemB = dbItemsById.get(b.item.storeItemId);
      const valueDiff = (itemB?.value || 0) - (itemA?.value || 0);
      if (valueDiff !== 0) return valueDiff;
      return (itemB?.rap || 0) - (itemA?.rap || 0);
    });

  const totalValue = collectibles.reduce((sum, row) => sum + (dbItemsById.get(row.item.storeItemId)?.value || 0), 0);
  const totalRap = collectibles.reduce((sum, row) => sum + (dbItemsById.get(row.item.storeItemId)?.rap || 0), 0);

  // Fetch full history for charting
  const { data: historyData } = await supabase
    .from('player_value_history')
    .select('recorded_at:created_at, total_rap, total_value')
    .eq('usbx_user_id', userId)
    .order('created_at', { ascending: true });

  const session = await getSession();
  const isOwnProfile = session?.usbxUserId === Number(userId);

  // Prefer full-body avatar render
  const avatarUrl = resolveUsbxAssetUrl(summary.user.profile.avatarUrl || summary.user.profile.headshotUrl);
  const usbxProfileUrl = `https://beta.untitled-sandbox.com/user/profile/${userId}`;

  // Find rank
  let rank: number | null = null;
  const { data: leaderData } = await supabase.rpc('get_latest_player_snapshots');
  if (leaderData) {
    const sorted = [...leaderData].sort((a: any, b: any) => (b.total_value ?? 0) - (a.total_value ?? 0));
    const idx = sorted.findIndex((r) => r.usbx_user_id === Number(userId));
    if (idx !== -1) rank = idx + 1;
  }

  // Icons
  const Icons = {
    Value: <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>,
    Rank: <svg viewBox="0 0 24 24" width="24" height="24" stroke="#d4af37" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>,
    RAP: <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>,
    Collectibles: <svg viewBox="0 0 24 24" width="24" height="24" stroke="#a07855" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
  };

  // Stack hoards by storeItemId — one card per unique item, copies grouped
  const stackedMap = new Map<number, InventoryItem>();
  for (const row of collectibles) {
    const dbItem = dbItemsById.get(row.item.storeItemId);
    const copy = {
      serialId: row.serialId,
      serialNumber: row.serialNumber || '?',
      acquiredAt: row.acquiredAt,
    };
    const existing = stackedMap.get(row.item.storeItemId);
    if (existing) {
      existing.copies.push(copy);
    } else {
      stackedMap.set(row.item.storeItemId, {
        storeItemId: row.item.storeItemId,
        name: dbItem?.name || row.item.name,
        imageUrl: dbItem?.item_image_url || row.item.resolvedPreviewUrl || '',
        rap: dbItem?.rap || 0,
        value: dbItem?.value || 0,
        availableOwners: dbItem?.available_owners,
        copies: [copy],
      });
    }
  }
  const clientCollectibles: InventoryItem[] = [...stackedMap.values()];

  return (
    <div className="container" style={{ padding: '0', maxWidth: '1200px' }}>
      
      {/* Background snapshot and cache invalidation */}
      {!inventoryIsPrivate && <RecordSnapshot userId={userId} totalRap={totalRap} totalValue={totalValue} />}

      {/* Page Header (Username) */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            {summary.user.username}
            <a href={usbxProfileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', display: 'flex' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </h1>
          <div style={{ color: 'var(--accent-color)', fontSize: '1rem' }}>USBX Player Profile</div>
        </div>
      </div>

      {/* Subtle Background Card for Profile Content */}
      <div className="page-surface fade-in">
        {/* Main Grid: Left Card (Avatar+Stats), Right Card (Chart) */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>

          {/* Left Column (Avatar + Stats Card, plus bio) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Top section: Avatar in dark block */}
              <div style={{ backgroundColor: '#18181b', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '380px' }}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={summary.user.username} style={{ width: '100%', height: '380px', objectFit: 'contain' }} />
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>No Avatar</span>
                )}
              </div>
              
              {/* Bottom section: Stats grid */}
              <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem 1rem' }}>
                <StatCell label="Value" value={formatNumber(totalValue)} accent="var(--rare-color)" icon={Icons.Value} />
                <StatCell label="Rank" value={rank ? `#${rank}` : '-'} icon={Icons.Rank} />
                <StatCell label="RAP" value={formatNumber(totalRap)} icon={Icons.RAP} />
                <StatCell label="Collectibles" value={formatNumber(collectibles.length)} icon={Icons.Collectibles} />
                
                {isOwnProfile && (
                  <form action={logout} style={{ display: 'contents' }}>
                    <button type="submit" className="btn btn-secondary" style={{ gridColumn: 'span 2', width: '100%', marginTop: '0.5rem' }}>Log out</button>
                  </form>
                )}
              </div>
            </div>

            {/* Bio (Below the main left card) */}
            {summary.user.profile.bio && (
              <div className="card" style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.95rem' }}>
                &ldquo;{summary.user.profile.bio}&rdquo;
              </div>
            )}

          </div>

          {/* Right Column (Chart Card) */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <PlayerChart history={historyData || []} />
          </div>
        </div>

        {/* Inventory */}
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Limiteds</h2>
        <ProfileInventoryClient items={clientCollectibles} inventoryIsPrivate={inventoryIsPrivate} />
      </div>
    </div>
  );
}
