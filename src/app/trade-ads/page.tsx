import Link from 'next/link';
import { getTradeAds, RequestSlot } from './actions';
import { getSession } from '@/lib/session';
import { getInlineBadges } from '@/lib/inlineBadge';
import TradeAdCard from './TradeAdCard';

export const dynamic = 'force-dynamic';

export default async function TradeAdsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const [{ ads, total, itemsById, profilesById }, session] = await Promise.all([
    getTradeAds(page),
    getSession(),
  ]);

  const inlineBadges = await getInlineBadges(ads.map((a) => a.creator_usbx_id));
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="page-surface fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem' }}>Trade Ads</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Post what you have and what you want. Other traders can reach out on USBX directly.</p>
        </div>
        <Link href="/trade-ads/new" className="btn btn-primary">+ Post Trade Ad</Link>
      </div>

      {ads.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No open trade ads yet. Be the first to post one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {ads.map((ad) => {
            const profile = profilesById.get(ad.creator_usbx_id);
            return (
              <TradeAdCard
                key={ad.id}
                ad={{ ...ad, request_slots: (ad.request_slots as RequestSlot[]) || [] }}
                itemsById={itemsById}
                creator={profile ? { username: profile.usbx_username || `Player #${ad.creator_usbx_id}`, avatarUrl: profile.usbx_avatar_url } : null}
                creatorBadge={inlineBadges.get(ad.creator_usbx_id) ?? null}
                isOwner={session?.usbxUserId === ad.creator_usbx_id}
              />
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '2rem' }}>
          {page > 1 && <Link href={`/trade-ads?page=${page - 1}`} className="btn btn-secondary">◄ Prev</Link>}
          <span style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={`/trade-ads?page=${page + 1}`} className="btn btn-secondary">Next ►</Link>}
        </div>
      )}
    </div>
  );
}
