'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UsbxOwnerRow } from '@/lib/usbxApi';

type OwnerRowWithAvatar = UsbxOwnerRow & { avatarUrl: string | null };

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

export default function OwnersList({ owners }: { owners: OwnerRowWithAvatar[] }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Sort owners by acquiredAt descending (newest first)
  const sortedOwners = [...owners].sort((a, b) => {
    if (!a.acquiredAt) return 1;
    if (!b.acquiredAt) return -1;
    return b.acquiredAt > a.acquiredAt ? 1 : -1;
  });

  const totalPages = Math.ceil(sortedOwners.length / pageSize);
  const startIdx = (page - 1) * pageSize;
  const currentOwners = sortedOwners.slice(startIdx, startIdx + pageSize);

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', margin: 0 }}>All Owners</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ◀
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{page} / {totalPages || 1}</span>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || totalPages === 0}
          >
            ▶
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {currentOwners.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>No owners found.</div>
        ) : (
          currentOwners.map((row) => (
            <div key={row.serialId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              {row.owner ? (
                <Link href={`/player/${row.owner.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
                  {row.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.avatarUrl} alt={row.owner.username} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', backgroundColor: 'var(--bg-secondary)' }} />
                  ) : (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }} />
                  )}
                  <span style={{ fontWeight: '500', color: 'var(--accent-hover)' }}>{row.owner.username}</span>
                </Link>
              ) : (
                <span style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>Unknown</span>
              )}
              <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <span>#{row.serialNumber}</span>
                <span>{timeAgo(row.acquiredAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
