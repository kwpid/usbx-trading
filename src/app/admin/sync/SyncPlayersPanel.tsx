'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

type PlayerResult = {
  usbx_user_id: number;
  username: string;
  avatar_url: string | null;
  rank: number;
  total_rap: number;
  total_value: number;
  status: 'ok' | 'private' | 'error';
};

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  ok: { label: 'Synced', color: 'var(--success-color)' },
  private: { label: 'Private', color: 'var(--text-secondary)' },
  error: { label: 'Error', color: 'var(--danger-color)' },
};

const PLAYERS_PER_PAGE = 20;

export default function SyncPlayersPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [synced, setSynced] = useState(0);
  const [badgesAwarded, setBadgesAwarded] = useState(0);
  const [allPlayers, setAllPlayers] = useState<PlayerResult[]>([]);
  const [displayPage, setDisplayPage] = useState(1);
  const stopRef = useRef(false);

  const runSync = async () => {
    setIsRunning(true);
    setError(null);
    setDone(false);
    setSynced(0);
    setBadgesAwarded(0);
    setAllPlayers([]);
    setDisplayPage(1);
    stopRef.current = false;

    let cursor: number | null = null; // null = start from beginning

    while (!stopRef.current) {
      let json: any;
      try {
        const query = cursor !== null ? `?cursor=${cursor}` : '';
        const res = await fetch(`/api/admin/sync-players${query}`);
        json = await res.json();
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      } catch (err: any) {
        setError(err.message || 'Sync failed.');
        break;
      }

      const players: PlayerResult[] = json.players ?? [];
      setSynced((s) => s + players.filter((p) => p.status === 'ok').length);
      setBadgesAwarded((b) => b + (json.badgesAwarded ?? 0));
      setAllPlayers((prev) => [...prev, ...players]);

      if (json.done || json.nextCursor === null) {
        setDone(true);
        break;
      }
      cursor = json.nextCursor;
    }

    setIsRunning(false);
  };

  const totalDisplayPages = Math.ceil(allPlayers.length / PLAYERS_PER_PAGE);
  const displayedPlayers = allPlayers.slice(
    (displayPage - 1) * PLAYERS_PER_PAGE,
    displayPage * PLAYERS_PER_PAGE
  );

  return (
    <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Sync All Players</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Walks the USBX RAP leaderboard to discover ranked players, fetches their
        inventories, computes RAP &amp; Value against our item catalog, saves snapshots, and
        awards any Trade.Badges they've become eligible for. Powers the site leaderboards,
        profile charts, and keeps badges current without needing every player to visit their
        own profile.
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={runSync} disabled={isRunning}>
          {isRunning ? 'Syncing Players…' : 'Start Player Sync'}
        </button>
        {isRunning && (
          <button className="btn btn-secondary" onClick={() => { stopRef.current = true; }}>
            Stop
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      {allPlayers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              ['Players Found', allPlayers.length],
              ['Synced', synced],
              ['Private / Error', allPlayers.length - synced],
              ['Badges Awarded', badgesAwarded],
            ].map(([label, val]) => (
              <div key={label as string} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Header + Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>
              {allPlayers.length} players processed
              {isRunning && (
                <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  (syncing…)
                </span>
              )}
            </h4>
            {totalDisplayPages > 1 && (
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <button
                  onClick={() => setDisplayPage((p) => Math.max(1, p - 1))}
                  disabled={displayPage === 1}
                  style={{ padding: '0.3rem 0.6rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: displayPage === 1 ? 'not-allowed' : 'pointer', color: 'var(--text-primary)', opacity: displayPage === 1 ? 0.4 : 1 }}
                >‹</button>

                {Array.from({ length: Math.min(totalDisplayPages, 7) }, (_, i) => {
                  // Show pages around the current page
                  const half = 3;
                  let start = Math.max(1, displayPage - half);
                  const end = Math.min(totalDisplayPages, start + 6);
                  start = Math.max(1, end - 6);
                  return start + i;
                }).filter((p) => p <= totalDisplayPages).map((p) => (
                  <button
                    key={p}
                    onClick={() => setDisplayPage(p)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      backgroundColor: displayPage === p ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: displayPage === p ? '#fff' : 'var(--text-primary)',
                      fontWeight: displayPage === p ? 700 : 400,
                      minWidth: '2rem',
                    }}
                  >{p}</button>
                ))}

                <button
                  onClick={() => setDisplayPage((p) => Math.min(totalDisplayPages, p + 1))}
                  disabled={displayPage === totalDisplayPages}
                  style={{ padding: '0.3rem 0.6rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: displayPage === totalDisplayPages ? 'not-allowed' : 'pointer', color: 'var(--text-primary)', opacity: displayPage === totalDisplayPages ? 0.4 : 1 }}
                >›</button>
              </div>
            )}
          </div>

          {/* Player grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
            {displayedPlayers.map((player) => {
              const badge = STATUS_BADGE[player.status];
              return (
                <Link
                  key={player.usbx_user_id}
                  href={`/player/${player.usbx_user_id}`}
                  className="card"
                  style={{ display: 'block', textDecoration: 'none', position: 'relative', overflow: 'hidden' }}
                >
                  {/* Avatar */}
                  <div style={{ height: '120px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {/* Rank badge */}
                    <div style={{ position: 'absolute', bottom: '6px', right: '8px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      #{player.rank}
                    </div>
                    {player.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={player.avatar_url} alt={player.username} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'var(--bg-secondary)' }} />
                    )}
                  </div>

                  <div style={{ padding: '0.75rem' }}>
                    {/* Username */}
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.4rem' }}>
                      {player.username}
                    </div>

                    <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Value</span>
                        <span style={{ fontWeight: 600, color: 'var(--rare-color)' }}>{formatNumber(player.total_value)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>RAP</span>
                        <span style={{ fontWeight: 600 }}>{formatNumber(player.total_rap)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: badge.color }}>{badge.label}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {done && (
            <p style={{ color: 'var(--success-color)', margin: 0 }}>
              ✓ Player sync complete — leaderboards and profile charts are now up to date.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
