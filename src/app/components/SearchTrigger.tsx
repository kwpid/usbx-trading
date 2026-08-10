'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RarityBadge from './RarityBadge';
import PlayerResultCard, { PlayerResult } from './PlayerResultCard';
import { searchLimitedsAction } from '@/app/search/actions';
import { searchPlayers } from '@/app/player-lookup/actions';

type LimitedResult = {
  id: number;
  name: string;
  item_image_url: string | null;
  rap: number | null;
  value: number | null;
  available_owners: number | null;
  copies_sold: number | null;
};

type Tab = 'limiteds' | 'players';

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

export default function SearchTrigger() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('limiteds');
  const [query, setQuery] = useState('');
  const [limiteds, setLimiteds] = useState<LimitedResult[]>([]);
  const [players, setPlayers] = useState<PlayerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Focus the input and reset state whenever the modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setLimiteds([]);
      setPlayers([]);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Debounced live search against whichever tab is active
  useEffect(() => {
    if (!open || !query.trim()) {
      setLimiteds([]);
      setPlayers([]);
      return;
    }

    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        if (tab === 'limiteds') {
          const results = await searchLimitedsAction(query);
          setLimiteds(results as LimitedResult[]);
        } else {
          const results = await searchPlayers(query);
          setPlayers(results as PlayerResult[]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [query, tab, open]);

  const goTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button className="nav-icon-link" onClick={() => setOpen(true)} style={{ background: 'none', border: 'none' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>Search</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '4rem 1rem 1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card search-modal-inner"
            style={{ width: '100%', maxWidth: '720px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Search</h3>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--text-secondary)', fontSize: '1.3rem', lineHeight: 1 }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
              {([
                { key: 'limiteds' as const, label: 'Limiteds' },
                { key: 'players' as const, label: 'Players' },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderBottom: tab === t.key ? '2px solid var(--accent-color)' : '2px solid transparent',
                    backgroundColor: tab === t.key ? 'var(--bg-tertiary)' : 'transparent',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={{ padding: '1rem 1.5rem' }}>
              <input
                ref={inputRef}
                type="text"
                className="input"
                placeholder={tab === 'limiteds' ? 'Search limiteds' : 'Search players'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Results */}
            <div style={{ padding: '0 1.5rem 1.5rem', overflowY: 'auto' }}>
              {!query.trim() ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Start typing to search {tab === 'limiteds' ? 'limiteds' : 'players'}.
                </div>
              ) : isSearching ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Searching…
                </div>
              ) : tab === 'limiteds' ? (
                limiteds.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    No limiteds found.
                  </div>
                ) : (
                  <div className="search-modal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                    {limiteds.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => goTo(`/items/${item.id}`)}
                        className="card"
                        style={{ padding: 0, overflow: 'hidden', textAlign: 'left' }}
                      >
                        <div style={{ padding: '0.5rem 0.6rem', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px solid var(--border-color)' }}>
                          {item.name}
                        </div>
                        <div style={{ position: 'relative', height: '90px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <RarityBadge copies={item.copies_sold} />
                          {item.item_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.item_image_url} alt={item.name} style={{ maxWidth: '75%', maxHeight: '75%', objectFit: 'contain' }} />
                          ) : (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>No Image</div>
                          )}
                        </div>
                        <div style={{ padding: '0.5rem 0.6rem', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>RAP</span>
                            <span>{formatNumber(item.rap)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Value</span>
                            <span style={{ color: 'var(--rare-color)' }}>{formatNumber(item.value)}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : players.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  No players found.
                </div>
              ) : (
                <div className="search-modal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
                  {players.map((player) => (
                    <PlayerResultCard key={player.id} player={player} onClick={() => setOpen(false)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
