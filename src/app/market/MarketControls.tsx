'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const SORT_OPTIONS = [
  { value: 'value', label: 'Highest Value' },
  { value: 'rap', label: 'Highest RAP' },
  { value: 'price_best_resale', label: 'Highest Price' },
  { value: 'owners', label: 'Rarest (fewest owners)' },
] as const;

export default function MarketControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in sync if the URL changes from elsewhere (back/forward nav).
  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete('page'); // any filter change resets pagination
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ q: value.trim() || null });
    }, 300);
  };

  const currentSort = searchParams.get('sort') || 'value';

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateParams({ sort: opt.value === 'value' ? null : opt.value })}
            className="btn btn-secondary"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              backgroundColor: currentSort === opt.value ? 'var(--accent-color)' : undefined,
              color: currentSort === opt.value ? '#fff' : undefined,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="input-group" style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          className="input"
          placeholder="Search items..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        />
      </div>
    </>
  );
}
