import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import BadgeIcon from '@/app/components/BadgeIcon';
import { getInlineBadges } from '@/lib/inlineBadge';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

function formatNumber(num: number | null | undefined) {
  if (!num) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString();
}

async function getLeaderboard(page: number) {
  // Use a Postgres function that does DISTINCT ON so we get the true latest
  // snapshot per player — JS-side deduplication with a row limit would silently
  // drop players whose snapshot is older than the fetch window.
  const { data, error } = await supabase.rpc('get_latest_player_snapshots');

  if (error || !data) {
    console.error('Leaderboard fetch error:', error?.message);
    return { rows: [], total: 0 };
  }

  // Sort by value descending
  const sorted = [...data].sort((a: any, b: any) => (b.total_value ?? 0) - (a.total_value ?? 0));

  const total = sorted.length;
  const offset = (page - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(offset, offset + PAGE_SIZE);

  if (pageRows.length === 0) return { rows: [], total };

  // Enrich with profile info
  const userIds = pageRows.map((r: any) => r.usbx_user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('usbx_user_id, usbx_username, usbx_avatar_url')
    .in('usbx_user_id', userIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.usbx_user_id, p]));
  const inlineBadges = await getInlineBadges(userIds);

  const rows = pageRows.map((row: any, i: number) => ({
    ...row,
    rank: offset + i + 1,
    profile: profileMap.get(row.usbx_user_id) ?? null,
    inlineBadge: inlineBadges.get(row.usbx_user_id) ?? null,
  }));

  return { rows, total };
}

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const { rows, total } = await getLeaderboard(page);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Build visible page numbers (up to 7, centered around current)
  const pageNumbers: number[] = [];
  const half = 3;
  let start = Math.max(1, page - half);
  const end = Math.min(totalPages, start + 6);
  start = Math.max(1, end - 6);
  for (let p = start; p <= end; p++) pageNumbers.push(p);

  return (
    <div className="page-surface fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '0 0 1.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>
          Value Leaderboard
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          The wealthiest players ranked by the total value of their limiteds.
        </p>
      </div>

      {/* Paginator */}
      {totalPages > 1 && (
        <Paginator page={page} totalPages={totalPages} pageNumbers={pageNumbers} />
      )}

      {/* Grid */}
      {rows.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)', marginTop: '1rem' }}>
          No data yet. Run a Player Sync from the admin panel to populate the leaderboard.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: '1rem',
          marginTop: '1rem',
        }}>
          {rows.map((row: any) => {
            const username = row.profile?.usbx_username ?? `Player #${row.usbx_user_id}`;
            const avatarUrl = row.profile?.usbx_avatar_url ?? null;
            const isTop3 = row.rank <= 3;

            return (
              <Link
                key={row.usbx_user_id}
                href={`/player/${row.usbx_user_id}`}
                className="card"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  overflow: 'hidden',
                  outline: isTop3 ? '1px solid var(--accent-color)' : undefined,
                }}
              >
                {/* Username bar */}
                <div style={{
                  padding: '0.6rem 0.75rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{username}</span>
                  {row.inlineBadge && <BadgeIcon badge={row.inlineBadge} size={14} />}
                </div>

                {/* Avatar */}
                <div style={{
                  height: '160px',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}>
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={username}
                      style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: 'var(--bg-secondary)' }} />
                  )}
                </div>

                {/* Stats */}
                <div style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rank</span>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>#{row.rank}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Value</span>
                    <span style={{ fontWeight: 600, color: 'var(--rare-color)' }}>{formatNumber(row.total_value)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>RAP</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{formatNumber(row.total_rap)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Bottom paginator */}
      {totalPages > 1 && (
        <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
          <Paginator page={page} totalPages={totalPages} pageNumbers={pageNumbers} />
        </div>
      )}

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '1rem', marginBottom: '2rem' }}>
        {total.toLocaleString()} players ranked
      </p>
    </div>
  );
}

function Paginator({ page, totalPages, pageNumbers }: { page: number; totalPages: number; pageNumbers: number[] }) {
  return (
    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
      {page > 1 && (
        <Link
          href={`/leaderboards?page=${page - 1}`}
          style={{ padding: '0.35rem 0.65rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.9rem' }}
        >◄</Link>
      )}

      {pageNumbers[0] > 1 && (
        <>
          <Link href="/leaderboards?page=1" style={pagerStyle(false)}>1</Link>
          {pageNumbers[0] > 2 && <span style={{ color: 'var(--text-secondary)', padding: '0 0.25rem' }}>…</span>}
        </>
      )}

      {pageNumbers.map((p) => (
        <Link key={p} href={`/leaderboards?page=${p}`} style={pagerStyle(p === page)}>{p}</Link>
      ))}

      {pageNumbers[pageNumbers.length - 1] < totalPages && (
        <>
          {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
            <span style={{ color: 'var(--text-secondary)', padding: '0 0.25rem' }}>…</span>
          )}
          <Link href={`/leaderboards?page=${totalPages}`} style={pagerStyle(false)}>{totalPages}</Link>
        </>
      )}

      {page < totalPages && (
        <Link
          href={`/leaderboards?page=${page + 1}`}
          style={{ padding: '0.35rem 0.65rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.9rem' }}
        >►</Link>
      )}
    </div>
  );
}

function pagerStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.35rem 0.65rem',
    backgroundColor: active ? 'var(--accent-color)' : 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    color: active ? '#fff' : 'var(--text-primary)',
    textDecoration: 'none',
    fontWeight: active ? 700 : 400,
    fontSize: '0.9rem',
    minWidth: '2.2rem',
    textAlign: 'center',
  };
}
