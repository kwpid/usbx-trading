'use client';

import { useRef, useState } from 'react';
import { searchPlayers } from './actions';
import PlayerResultCard, { PlayerResult } from '@/app/components/PlayerResultCard';

export default function PlayerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerResult[]>([]);
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
      setResults(found as PlayerResult[]);
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
          No players found for &quot;{query}&quot;.
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem' }}>
          {results.map((r) => (
            <PlayerResultCard key={r.id} player={r} />
          ))}
        </div>
      )}
    </div>
  );
}
