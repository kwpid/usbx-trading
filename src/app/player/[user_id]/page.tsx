import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchProfileSummary } from "@/lib/usbxApi";
import { resolveUsbxAssetUrl } from "@/lib/usbxAssets";
import { getSession } from "@/lib/session";
import { logout } from "../../account/actions";
import PlayerChart from "./PlayerChart";
import RecordSnapshot from "./RecordSnapshot";
import AwardBadges from "./AwardBadges";
import ProfileInventoryClient, { InventoryItem } from "./ProfileInventoryClient";
import WishlistSection, { WishlistItem } from "./WishlistSection";
import BadgeIcon from "@/app/components/BadgeIcon";
import { getInlineBadge } from "@/lib/inlineBadge";
import { BADGES_BY_ID } from "@/lib/badges";
import { SnapshotItem } from "@/lib/snapshot";

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

  // Privacy is checked live off the summary call (cheap — it's already
  // made regardless) rather than by attempting the old heavy paginated
  // inventory fetch and catching a 403. Explicitly false = private; missing
  // (some API versions may not send it) defaults to public rather than
  // hiding a profile that's actually visible.
  const liveInventoryIsPrivate = summary.privacy?.canViewInventory === false;

  // A player can opt into showing their inventory on usbx.trade regardless
  // of their live USBX privacy setting (Account Settings), as a failsafe
  // for a known USBX bug that can get an account stuck on private. This is
  // the account's own choice about their own data — never a way to see
  // someone else's private inventory without their consent.
  const { data: privacySettings } = await supabase
    .from('profiles')
    .select('bypass_privacy_lock')
    .eq('usbx_user_id', userId)
    .maybeSingle();
  const inventoryIsPrivate = liveInventoryIsPrivate && !privacySettings?.bypass_privacy_lock;

  // Ownership comes straight from our own item_owners table — populated by
  // the background sync jobs (event poller, catalog discovery, daily
  // refresh), not fetched live here. This is the same instant-DB-read model
  // used for item pages, just queried from the player's side. It only
  // covers items we track (same scope the old live-fetch path already
  // limited itself to), and privacy is still enforced above using the
  // account's *current* setting, so this never shows a private player's
  // ownership just because our item-side sync happened to observe it.
  type CollectibleRow = { storeItemId: number; serialId: number; serialNumber: string; acquiredAt: string | null };
  let collectibleRows: CollectibleRow[] = [];

  if (!inventoryIsPrivate) {
    const { data: ownedRows, error: ownedErr } = await supabase
      .from('item_owners')
      .select('item_id, serial_id, serial_number, acquired_at')
      .eq('owner_usbx_id', Number(userId));
    if (ownedErr) console.error('Failed to load owned items:', ownedErr.message);
    collectibleRows = (ownedRows || []).map((r) => ({
      storeItemId: r.item_id,
      serialId: r.serial_id,
      serialNumber: r.serial_number || '?',
      acquiredAt: r.acquired_at,
    }));
  }

  const storeItemIds = [...new Set(collectibleRows.map((r) => r.storeItemId))];
  let dbItemsById = new Map<number, any>();
  if (storeItemIds.length > 0) {
    const { data, error } = await supabase
      .from('items')
      .select('id, name, rap, value, item_image_url, available_owners, copies_sold')
      .in('id', storeItemIds)
      .eq('is_limited', true);
    if (error) console.error('Failed to load owned item pricing:', error.message);
    dbItemsById = new Map((data || []).map((i) => [i.id, i]));
  }

  // Highest value first, falling back to highest RAP when values aren't
  // set (Value defaults to 0 and is only populated by manual value-change
  // tracking, so most items sort on RAP in practice).
  const collectibles = collectibleRows
    .filter((row) => dbItemsById.has(row.storeItemId))
    .sort((a, b) => {
      const itemA = dbItemsById.get(a.storeItemId);
      const itemB = dbItemsById.get(b.storeItemId);
      const valueDiff = (itemB?.value || 0) - (itemA?.value || 0);
      if (valueDiff !== 0) return valueDiff;
      return (itemB?.rap || 0) - (itemA?.rap || 0);
    });

  const totalValue = collectibles.reduce((sum, row) => sum + (dbItemsById.get(row.storeItemId)?.value || 0), 0);
  const totalRap = collectibles.reduce((sum, row) => sum + (dbItemsById.get(row.storeItemId)?.rap || 0), 0);

  // Fetch full history for charting, including each day's inventory snapshot
  // so the chart can show "what they had on this date" on click.
  const { data: historyData } = await supabase
    .from('player_value_history')
    .select('recorded_at:created_at, total_rap, total_value, inventory_snapshot')
    .eq('usbx_user_id', userId)
    .order('created_at', { ascending: true });

  const session = await getSession();
  const isOwnProfile = session?.usbxUserId === Number(userId);

  // Single highest-priority badge (developer > value_mod > verified) shown
  // next to the username — never more than one at a time.
  const inlineBadge = await getInlineBadge(userId);

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

  // Stack hoards by storeItemId — one card per unique item, copies grouped.
  // dbItem is always present here since `collectibles` was already filtered
  // to rows with a matching items row above.
  const stackedMap = new Map<number, InventoryItem>();
  for (const row of collectibles) {
    const dbItem = dbItemsById.get(row.storeItemId);
    const copy = {
      serialId: row.serialId,
      serialNumber: row.serialNumber,
      acquiredAt: row.acquiredAt,
    };
    const existing = stackedMap.get(row.storeItemId);
    if (existing) {
      existing.copies.push(copy);
    } else {
      stackedMap.set(row.storeItemId, {
        storeItemId: row.storeItemId,
        name: dbItem.name,
        imageUrl: dbItem.item_image_url || '',
        rap: dbItem.rap || 0,
        value: dbItem.value || 0,
        availableOwners: dbItem.available_owners,
        copiesSold: dbItem.copies_sold,
        copies: [copy],
      });
    }
  }
  const clientCollectibles: InventoryItem[] = [...stackedMap.values()];

  const inventorySnapshot: SnapshotItem[] = clientCollectibles.map((c) => ({
    id: c.storeItemId,
    name: c.name,
    imageUrl: c.imageUrl || null,
    rap: c.rap,
    value: c.value,
    copies: c.copies.length,
    serials: c.copies.map((copy) => copy.serialNumber),
  }));

  // Badges already earned by this player — evaluated once elsewhere
  // (AwardBadges below) and just displayed here from what's stored.
  const { data: badgeRows } = await supabase
    .from('player_badges')
    .select('badge_id, awarded_at')
    .eq('usbx_user_id', userId)
    .order('awarded_at', { ascending: true });

  const earnedBadges = (badgeRows || [])
    .map((row) => ({ def: BADGES_BY_ID.get(row.badge_id), awardedAt: row.awarded_at }))
    .filter((b): b is { def: NonNullable<typeof b.def>; awardedAt: string } => Boolean(b.def));

  // Wishlist — up to 6 items the player wants, shown below the badges
  // section. Joined against items here rather than trusting stale data on
  // the wishlist row itself, same DB-driven approach as everything else.
  const { data: wishlistRows } = await supabase
    .from('player_wishlist')
    .select('item_id')
    .eq('usbx_user_id', userId)
    .order('added_at', { ascending: true });
  const wishlistItemIds = (wishlistRows || []).map((r) => r.item_id);
  let wishlistItems: WishlistItem[] = [];
  if (wishlistItemIds.length > 0) {
    const { data: wishlistItemRows } = await supabase
      .from('items')
      .select('id, name, item_image_url, rap, value, available_owners, copies_sold')
      .in('id', wishlistItemIds);
    const byId = new Map((wishlistItemRows || []).map((i) => [i.id, i]));
    wishlistItems = wishlistItemIds.map((id) => byId.get(id)).filter((i): i is NonNullable<typeof i> => Boolean(i));
  }

  // NFT ("Not For Trade") markers this player has set on their own items —
  // persisted separately from item_owners since that table gets wiped and
  // rebuilt on every ownership sync.
  const { data: nftRows } = await supabase
    .from('player_nft_items')
    .select('item_id')
    .eq('usbx_user_id', userId);
  const nftItemIds = (nftRows || []).map((r) => r.item_id);

  return (
    <div className="container" style={{ padding: '0', maxWidth: '1200px' }}>
      
      {/* Background snapshot and cache invalidation */}
      {!inventoryIsPrivate && (
        <RecordSnapshot userId={userId} totalRap={totalRap} totalValue={totalValue} inventorySnapshot={inventorySnapshot} />
      )}
      {/* Always runs, even with a private inventory — identity-based badges
          (e.g. Developer) don't depend on inventory data. Inventory-based
          checks just naturally evaluate against an empty collection. */}
      <AwardBadges
        userId={userId}
        totalValue={totalValue}
        collectibles={clientCollectibles.map((c) => ({
          name: c.name,
          copiesSold: c.copiesSold,
          copies: c.copies.map((copy) => ({ serialNumber: copy.serialNumber })),
        }))}
      />

      {/* Page Header (Username) */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            {summary.user.username}
            {inlineBadge && <BadgeIcon badge={inlineBadge} size={22} />}
            <a href={usbxProfileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', display: 'flex' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </h1>
          <div style={{ color: 'var(--accent-color)', fontSize: '1rem' }}>USBX Player Profile</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isOwnProfile && (
            <Link href="/account/settings" className="btn btn-secondary" style={{ borderRadius: '999px', padding: '0.5rem 1.1rem', fontSize: '0.85rem', textDecoration: 'none' }}>
              Settings
            </Link>
          )}
          <Link href={`/playertrades/${userId}`} className="btn btn-primary" style={{ borderRadius: '999px', padding: '0.5rem 1.1rem', fontSize: '0.85rem', textDecoration: 'none' }}>
            Trade Ads
          </Link>
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
                <StatCell label="Limiteds" value={formatNumber(collectibles.length)} icon={Icons.Collectibles} />
                
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

        {/* Badges */}
        {earnedBadges.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              <span style={{ color: '#e2b955' }}>Trade</span><span style={{ color: '#8353e4' }}>.</span>Badges
            </h2>
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {earnedBadges.map(({ def }) => (
                <BadgeIcon key={def.id} badge={def} size={48} />
              ))}
            </div>
          </div>
        )}

        {/* Wishlist */}
        <WishlistSection items={wishlistItems} isOwnProfile={isOwnProfile} />

        {/* Inventory */}
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Limiteds</h2>
        <ProfileInventoryClient
          items={clientCollectibles}
          inventoryIsPrivate={inventoryIsPrivate}
          nftItemIds={nftItemIds}
          isOwnProfile={isOwnProfile}
        />
      </div>
    </div>
  );
}
