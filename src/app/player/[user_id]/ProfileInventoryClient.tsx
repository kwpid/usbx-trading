'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import RarityBadge from '@/app/components/RarityBadge';

export type InventoryCopy = {
  serialId: number;
  serialNumber: string;
  acquiredAt: string | null;
};

export type InventoryItem = {
  storeItemId: number;
  name: string;
  imageUrl: string;
  rap: number;
  value: number;
  availableOwners: number | null | undefined;
  copies: InventoryCopy[];
};

type Props = {
  items: InventoryItem[];
  inventoryIsPrivate: boolean;
};

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

function timeAgo(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const diff = Date.now() - new Date(dateString).getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m} month${m > 1 ? 's' : ''} ago`;
  const y = Math.floor(d / 365);
  return `${y} year${y > 1 ? 's' : ''} ago`;
}

function CopiesModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const sorted = [...item.copies].sort((a, b) => {
    if (!a.acquiredAt) return 1;
    if (!b.acquiredAt) return -1;
    return new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime();
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: '420px', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{item.name}</h3>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {item.copies.length} owned cop{item.copies.length === 1 ? 'y' : 'ies'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sorted.map((copy) => (
            <div
              key={copy.serialId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem',
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--accent-color)' }}>#{copy.serialNumber}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{timeAgo(copy.acquiredAt)}</div>
              </div>
              <Link
                href={`/serial/${copy.serialId}`}
                className="btn btn-primary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                Serial #{copy.serialNumber}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProfileInventoryClient({ items, inventoryIsPrivate }: Props) {
  const [sortBy, setSortBy] = useState('highest_value');
  const [filterBy, setFilterBy] = useState('value');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [copiesModalItem, setCopiesModalItem] = useState<InventoryItem | null>(null);

  const ITEMS_PER_PAGE = 100;

  const processedItems = useMemo(() => {
    let result = [...items];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.copies.some((c) => c.serialNumber?.toLowerCase().includes(q))
      );
    }

    const minVal = min ? parseInt(min, 10) : null;
    const maxVal = max ? parseInt(max, 10) : null;
    if (minVal !== null || maxVal !== null) {
      result = result.filter((item) => {
        const checkVal = filterBy === 'value' ? item.value : item.rap;
        if (minVal !== null && checkVal < minVal) return false;
        if (maxVal !== null && checkVal > maxVal) return false;
        return true;
      });
    }

    result.sort((a, b) => {
      const aRecent = a.copies.reduce((latest, c) => {
        if (!c.acquiredAt) return latest;
        const t = new Date(c.acquiredAt).getTime();
        return t > latest ? t : latest;
      }, 0);
      const bRecent = b.copies.reduce((latest, c) => {
        if (!c.acquiredAt) return latest;
        const t = new Date(c.acquiredAt).getTime();
        return t > latest ? t : latest;
      }, 0);
      const aOldest = a.copies.reduce((earliest, c) => {
        if (!c.acquiredAt) return earliest;
        const t = new Date(c.acquiredAt).getTime();
        return earliest === 0 || t < earliest ? t : earliest;
      }, 0);
      const bOldest = b.copies.reduce((earliest, c) => {
        if (!c.acquiredAt) return earliest;
        const t = new Date(c.acquiredAt).getTime();
        return earliest === 0 || t < earliest ? t : earliest;
      }, 0);

      switch (sortBy) {
        case 'highest_value': return b.value - a.value || b.rap - a.rap;
        case 'lowest_value': return a.value - b.value || a.rap - b.rap;
        case 'highest_rap': return b.rap - a.rap;
        case 'lowest_rap': return a.rap - b.rap;
        case 'recent': return bRecent - aRecent;
        case 'oldest': return aOldest - bOldest || 1;
        default: return 0;
      }
    });

    return result;
  }, [items, search, filterBy, min, max, sortBy]);

  const totalPages = Math.ceil(processedItems.length / ITEMS_PER_PAGE) || 1;
  const paginatedItems = processedItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (page > totalPages && totalPages > 0) {
    setPage(1);
  }

  if (inventoryIsPrivate) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        This player's inventory is set to private.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No inventory data available — this player may not have logged into USBX recently.
      </div>
    );
  }

  const PaginationControls = () => {
    const pageButtons = [];
    let startPage = Math.max(1, page - 3);
    let endPage = Math.min(totalPages, page + 3);

    if (endPage - startPage < 6) {
      if (startPage === 1) endPage = Math.min(totalPages, 7);
      else if (endPage === totalPages) startPage = Math.max(1, totalPages - 6);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageButtons.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          style={{
            padding: '0.35rem 0.75rem',
            background: page === i ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            color: page === i ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          {i}
        </button>
      );
    }

    return (
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{ padding: '0.35rem 0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: page === 1 ? 'not-allowed' : 'pointer', borderRadius: '4px' }}
        >
          ◀
        </button>
        {pageButtons}
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{ padding: '0.35rem 0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: page === totalPages ? 'not-allowed' : 'pointer', borderRadius: '4px' }}
        >
          ▶
        </button>
      </div>
    );
  };

  return (
    <div>
      {copiesModalItem && (
        <CopiesModal item={copiesModalItem} onClose={() => setCopiesModalItem(null)} />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', minWidth: '150px' }}
          >
            <option value="highest_value">Highest Value</option>
            <option value="lowest_value">Lowest Value</option>
            <option value="highest_rap">Highest RAP</option>
            <option value="lowest_rap">Lowest RAP</option>
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filter</label>
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', minWidth: '120px' }}
          >
            <option value="value">Value</option>
            <option value="rap">RAP</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Min</label>
          <input
            type="number"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="Min"
            style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', width: '100px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Max</label>
          <input
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="Max"
            style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', width: '100px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '200px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory"
            style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', width: '100%' }}
          />
        </div>
      </div>

      <PaginationControls />

      {paginatedItems.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No items found matching your filters.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {paginatedItems.map((item) => {
            const copyCount = item.copies.length;
            const latestCopy = [...item.copies].sort((a, b) => {
              if (!a.acquiredAt) return 1;
              if (!b.acquiredAt) return -1;
              return new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime();
            })[0];

            return (
              <div key={item.storeItemId} className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                <Link href={`/items/${item.storeItemId}`} style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'inherit', textDecoration: 'none' }}>
                  {item.name}
                  {copyCount > 1 && (
                    <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--rare-color)', fontWeight: 700 }}>
                      x{copyCount}
                    </span>
                  )}
                </Link>

                <Link href={`/items/${item.storeItemId}`} style={{ position: 'relative', height: '140px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RarityBadge owners={item.availableOwners} />
                  {copyCount > 1 && (
                    <div style={{
                      position: 'absolute', top: '0.5rem', right: '0.5rem',
                      background: 'var(--rare-color)', color: '#000', fontWeight: 800,
                      fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: '4px',
                    }}>
                      x{copyCount}
                    </div>
                  )}
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                  )}
                </Link>

                <div style={{ padding: '0.75rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{copyCount > 1 ? 'Total RAP' : 'RAP'}</span>
                    <span style={{ fontWeight: '500' }}>{formatNumber(item.rap * copyCount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{copyCount > 1 ? 'Total Value' : 'Value'}</span>
                    <span style={{ fontWeight: '500' }}>{formatNumber(item.value * copyCount)}</span>
                  </div>
                  {copyCount === 1 ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Serial</span>
                        <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>#{latestCopy?.serialNumber}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Owner Since</span>
                        <span style={{ color: 'var(--success-color)' }}>{timeAgo(latestCopy?.acquiredAt ?? null)}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Copies</span>
                      <span style={{ color: 'var(--rare-color)', fontWeight: 'bold' }}>{copyCount}</span>
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                    {copyCount === 1 ? (
                      <Link
                        href={`/serial/${latestCopy?.serialId}`}
                        className="btn btn-primary"
                        style={{ display: 'block', width: '100%', textAlign: 'center', padding: '0.4rem', fontSize: '0.85rem' }}
                      >
                        UAID Page
                      </Link>
                    ) : (
                      <button
                        onClick={() => setCopiesModalItem(item)}
                        className="btn btn-primary"
                        style={{ width: '100%', textAlign: 'center', padding: '0.4rem', fontSize: '0.85rem' }}
                      >
                        Owned Copies ({copyCount})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
