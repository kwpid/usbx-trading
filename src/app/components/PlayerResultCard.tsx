'use client';

import Link from 'next/link';
import BadgeIcon from './BadgeIcon';
import type { InlineBadgeInfo } from '@/lib/inlineBadge';

export type PlayerResult = {
  id: number;
  username: string;
  avatarUrl: string | null;
  rank?: number | null;
  totalValue?: number | null;
  totalRap?: number | null;
  inlineBadge?: InlineBadgeInfo | null;
};

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// Same card look as the leaderboards page — username bar, centered avatar,
// rank/value/rap stats — reused here so Player Lookup and the site-wide
// search's Players tab feel like the same product instead of a bare list.
export default function PlayerResultCard({ player, onClick }: { player: PlayerResult; onClick?: () => void }) {
  const isTop3 = player.rank != null && player.rank <= 3;
  const hasStats = player.rank != null;

  return (
    <Link
      href={`/player/${player.id}`}
      onClick={onClick}
      className="card"
      style={{
        display: 'block',
        textDecoration: 'none',
        overflow: 'hidden',
        outline: isTop3 ? '1px solid var(--accent-color)' : undefined,
      }}
    >
      <div style={{ padding: '0.6rem 0.75rem', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.username}</span>
        {player.inlineBadge && <BadgeIcon badge={player.inlineBadge} size={14} />}
      </div>

      <div style={{ height: '160px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.avatarUrl} alt={player.username} style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} />
        ) : (
          <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: 'var(--bg-secondary)' }} />
        )}
      </div>

      <div style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {hasStats ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Rank</span>
              <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>#{player.rank}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Value</span>
              <span style={{ fontWeight: 600, color: 'var(--rare-color)' }}>{formatNumber(player.totalValue || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>RAP</span>
              <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{formatNumber(player.totalRap || 0)}</span>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '0.25rem 0' }}>Not tracked yet</div>
        )}
      </div>
    </Link>
  );
}
