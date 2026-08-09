'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import RarityBadge from '@/app/components/RarityBadge';
import { addToWishlist, removeFromWishlist, searchWishlistCandidates } from './wishlistActions';

export type WishlistItem = {
  id: number;
  name: string;
  item_image_url: string | null;
  rap: number | null;
  value: number | null;
  available_owners: number | null;
};

const MAX_WISHLIST_ITEMS = 6;

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

export default function WishlistSection({ items, isOwnProfile }: { items: WishlistItem[]; isOwnProfile: boolean }) {
  const [wishlist, setWishlist] = useState(items);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WishlistItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the top items as soon as the picker opens, so there's something to
  // browse before the player types anything.
  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    searchWishlistCandidates('').then((found) => {
      if (!cancelled) setResults(found as WishlistItem[]);
    });
    return () => { cancelled = true; };
  }, [pickerOpen]);

  if (wishlist.length === 0 && !isOwnProfile) return null;

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const found = await searchWishlistCandidates(value);
      setResults(found as WishlistItem[]);
    }, 250);
  };

  const handleAdd = async (item: WishlistItem) => {
    if (wishlist.some((w) => w.id === item.id) || wishlist.length >= MAX_WISHLIST_ITEMS) return;
    setIsBusy(true);
    const result = await addToWishlist(item.id);
    setIsBusy(false);
    if (!result.error) {
      setWishlist((prev) => [...prev, item]);
      setPickerOpen(false);
      setQuery('');
      setResults([]);
    }
  };

  const handleRemove = async (itemId: number) => {
    setIsBusy(true);
    await removeFromWishlist(itemId);
    setIsBusy(false);
    setWishlist((prev) => prev.filter((w) => w.id !== itemId));
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Wishlist</h2>
        {isOwnProfile && wishlist.length < MAX_WISHLIST_ITEMS && (
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }} onClick={() => setPickerOpen(true)}>
            + Add Item
          </button>
        )}
      </div>

      {wishlist.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {isOwnProfile ? "You haven't added any items to your wishlist yet." : 'No wishlist items.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {wishlist.map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link href={`/items/${item.id}`} style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'inherit', textDecoration: 'none' }}>
                  {item.name}
                </Link>
                {isOwnProfile && (
                  <button
                    onClick={() => handleRemove(item.id)}
                    disabled={isBusy}
                    title="Remove from wishlist"
                    style={{
                      flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%',
                      background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.7rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <Link href={`/items/${item.id}`} style={{ position: 'relative', height: '140px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RarityBadge owners={item.available_owners} />
                {item.item_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.item_image_url} alt={item.name} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                )}
              </Link>

              <div style={{ padding: '0.75rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>RAP</span>
                  <span style={{ fontWeight: 500 }}>{formatNumber(item.rap)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Value</span>
                  <span style={{ fontWeight: 500, color: 'var(--rare-color)' }}>{formatNumber(item.value)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div
          onClick={() => setPickerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4rem 1rem 1rem' }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: '640px', maxHeight: '75vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Add to Wishlist</h3>
              <button onClick={() => setPickerOpen(false)} style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: '1rem 1.25rem 0' }}>
              <input
                type="text"
                className="input"
                placeholder="Search limiteds"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
              {!query.trim() && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>Top items by value</div>
              )}
            </div>
            <div style={{ padding: '1rem 1.25rem 1.25rem', overflowY: 'auto' }}>
              {results.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No limiteds found.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  {results.map((item) => {
                    const alreadyAdded = wishlist.some((w) => w.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleAdd(item)}
                        disabled={alreadyAdded || isBusy}
                        className="card"
                        style={{ padding: 0, overflow: 'hidden', textAlign: 'left', opacity: alreadyAdded ? 0.5 : 1 }}
                      >
                        <div style={{ padding: '0.5rem 0.6rem', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px solid var(--border-color)' }}>
                          {item.name}
                        </div>
                        <div style={{ position: 'relative', height: '90px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <RarityBadge owners={item.available_owners} />
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
                            <span style={{ color: 'var(--rare-color)' }}>{alreadyAdded ? 'Added' : formatNumber(item.value)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
