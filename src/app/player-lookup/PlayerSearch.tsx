'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { searchPlayers } from './actions';

type Result = { id: number; title: string; subtitle: string | null; imageUrl: string | null };

export default function PlayerSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      const found = await searchPlayers(value);
      setResults(found);
      setIsSearching(false);
      setSearched(true);
    }, 300);
  };

  return (
    <div>
      <input
        type="text"
        className="input"
        placeholder="Search players by username..."
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        style={{ marginBottom: '1.5rem' }}
        autoFocus
      />

      {isSearching && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>Searching...</div>
      )}

      {!isSearching && searched && results.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No players found for "{query}".
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => router.push(`/player/${r.id}`)}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', textAlign: 'left', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', width: '100%' }}
            >
              {r.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageUrl} alt={r.title} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
              )}
              <div>
                <div style={{ fontWeight: 500 }}>{r.title}</div>
                {r.subtitle && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.subtitle}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
