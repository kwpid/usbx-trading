import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { getInlineBadge } from '@/lib/inlineBadge';
import { getPlayerTradeAds } from '@/app/trade-ads/actions';
import BadgeIcon from '@/app/components/BadgeIcon';
import PlayerTradeAdsList from './PlayerTradeAdsList';

export const dynamic = 'force-dynamic';

export default async function PlayerTradeAdsPage(props: {
  params: Promise<{ userid: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const userId = Number(params.userid);
  if (!userId || Number.isNaN(userId)) notFound();

  const [{ data: profile }, { ads, itemsById }, session, inlineBadge] = await Promise.all([
    supabase.from('profiles').select('usbx_username, usbx_avatar_url').eq('usbx_user_id', userId).maybeSingle(),
    getPlayerTradeAds(userId),
    getSession(),
    getInlineBadge(userId),
  ]);

  const username = profile?.usbx_username || `Player #${userId}`;
  const avatarUrl = profile?.usbx_avatar_url || null;
  const usbxProfileUrl = `https://beta.untitled-sandbox.com/user/profile/${userId}`;
  const isOwner = session?.usbxUserId === userId;
  const initialStatus: 'open' | 'closed' = searchParams.tab === 'history' ? 'closed' : 'open';

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            {username}
            {inlineBadge && <BadgeIcon badge={inlineBadge} size={20} />}
            <a href={usbxProfileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', display: 'flex' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </h1>
          <div style={{ color: 'var(--accent-color)', fontSize: '1rem' }}>Player Trade Ads</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href={`/player/${userId}`} className="btn btn-primary" style={{ borderRadius: '999px', padding: '0.5rem 1.1rem', fontSize: '0.85rem' }}>Profile</Link>
          <Link href={`/playertrades/${userId}?tab=history`} className="btn btn-secondary" style={{ borderRadius: '999px', padding: '0.5rem 1.1rem', fontSize: '0.85rem' }}>History</Link>
        </div>
      </div>

      {/* Banner */}
      <div className="card" style={{ display: 'flex', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{ width: '160px', flexShrink: 0, backgroundColor: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={username} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)' }} />
          )}
        </div>
        <div style={{
          flex: 1, padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(123,139,116,0.22), rgba(123,139,116,0.04))',
        }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>Trade Ads</h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/trade-ads/new" className="btn btn-primary" style={{ borderRadius: '999px', padding: '0.55rem 1.25rem' }}>Create Ad</Link>
            <Link href="/trade-ads" className="btn btn-secondary" style={{ borderRadius: '999px', padding: '0.55rem 1.25rem' }}>Latest Trade Ads</Link>
          </div>
        </div>
      </div>

      <PlayerTradeAdsList
        ads={ads}
        itemsById={itemsById}
        creator={{ username, avatarUrl }}
        creatorBadge={inlineBadge}
        isOwner={isOwner}
        initialStatus={initialStatus}
      />
    </div>
  );
}
