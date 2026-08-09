'use client';

import { useMemo, useState } from 'react';
import TradeAdCard, { TradeAdData, TradeAdItem } from '@/app/trade-ads/TradeAdCard';
import { WILDCARD_INFO } from '@/lib/tradeAdWildcards';
import type { InlineBadgeInfo } from '@/lib/inlineBadge';

const PAGE_SIZE = 10;

function adMatchesText(
  ad: TradeAdData,
  itemsById: Map<number, TradeAdItem>,
  side: 'offer' | 'request',
  query: string
): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();

  if (side === 'offer') {
    return ad.offer_item_ids.some((id) => itemsById.get(id)?.name.toLowerCase().includes(q));
  }

  return ad.request_slots.some((slot) => {
    if (slot.type === 'item') return itemsById.get(slot.itemId)?.name.toLowerCase().includes(q);
    return WILDCARD_INFO[slot.tag].label.toLowerCase().includes(q);
  });
}

export default function PlayerTradeAdsList({
  ads,
  itemsById,
  creator,
  creatorBadge,
  isOwner,
  initialStatus = 'open',
}: {
  ads: TradeAdData[];
  itemsById: Map<number, TradeAdItem>;
  creator: { username: string; avatarUrl: string | null };
  creatorBadge: InlineBadgeInfo | null;
  isOwner: boolean;
  initialStatus?: 'open' | 'closed';
}) {
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed'>(initialStatus);
  const [offerQuery, setOfferQuery] = useState('');
  const [requestQuery, setRequestQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return ads
      .filter((ad) => ad.status === statusFilter)
      .filter((ad) => adMatchesText(ad, itemsById, 'offer', offerQuery))
      .filter((ad) => adMatchesText(ad, itemsById, 'request', requestQuery));
  }, [ads, itemsById, statusFilter, offerQuery, requestQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageAds = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const applyFilter = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Offer Filters</h2>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Item Name</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
            <input
              type="text"
              className="input"
              value={offerQuery}
              onChange={(e) => applyFilter(setOfferQuery, e.target.value)}
              placeholder="Search offered items"
            />
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Request Filters</h2>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Item Name</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
            <input
              type="text"
              className="input"
              value={requestQuery}
              onChange={(e) => applyFilter(setRequestQuery, e.target.value)}
              placeholder="Search requested items or categories"
            />
          </div>
        </div>
      </div>

      {/* Status toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          className={`btn ${statusFilter === 'open' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setStatusFilter('open'); setPage(1); }}
          style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
        >
          Open ({ads.filter((a) => a.status === 'open').length})
        </button>
        <button
          className={`btn ${statusFilter === 'closed' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setStatusFilter('closed'); setPage(1); }}
          style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
        >
          History ({ads.filter((a) => a.status === 'closed').length})
        </button>
      </div>

      {/* Pagination (top) */}
      {totalPages > 1 && <Paginator page={clampedPage} totalPages={totalPages} onChange={setPage} />}

      {pageAds.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', marginTop: '1rem' }}>
          {statusFilter === 'open' ? 'No open trade ads match these filters.' : 'No past trade ads match these filters.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {pageAds.map((ad) => (
            <TradeAdCard
              key={ad.id}
              ad={ad}
              itemsById={itemsById}
              creator={creator}
              creatorBadge={creatorBadge}
              isOwner={isOwner && ad.status === 'open'}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ marginTop: '1.5rem' }}>
          <Paginator page={clampedPage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

function Paginator({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages: number[] = [];
  let start = Math.max(1, page - 3);
  const end = Math.min(totalPages, start + 6);
  start = Math.max(1, end - 6);
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem' }}>◄</button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className="btn"
          style={{ padding: '0.35rem 0.65rem', backgroundColor: p === page ? 'var(--accent-color)' : 'var(--bg-tertiary)', color: p === page ? '#fff' : 'var(--text-primary)' }}
        >
          {p}
        </button>
      ))}
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem' }}>►</button>
    </div>
  );
}
