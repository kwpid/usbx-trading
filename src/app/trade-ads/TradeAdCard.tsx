'use client';

import { useState } from 'react';
import Link from 'next/link';
import RarityBadge from '@/app/components/RarityBadge';
import BadgeIcon from '@/app/components/BadgeIcon';
import { WILDCARD_INFO, WildcardTag } from '@/lib/tradeAdWildcards';
import { closeTradeAd, RequestSlot } from './actions';
import type { InlineBadgeInfo } from '@/lib/inlineBadge';

export type TradeAdItem = {
  id: number;
  name: string;
  item_image_url: string | null;
  rap: number | null;
  value: number | null;
  available_owners: number | null;
  copies_sold: number | null;
};

export type TradeAdData = {
  id: number;
  creator_usbx_id: number;
  status?: 'open' | 'closed';
  offer_item_ids: number[];
  offer_currency_type: 'token' | 'scrip' | null;
  offer_currency_amount: number | null;
  request_slots: RequestSlot[];
  request_currency_type: 'token' | 'scrip' | null;
  request_currency_amount: number | null;
  created_at: string;
};

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} second${s === 1 ? '' : 's'} ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ItemTile({ item }: { item: TradeAdItem }) {
  return (
    <Link
      href={`/items/${item.id}`}
      title={item.name}
      style={{
        position: 'relative', width: '92px', height: '92px', flexShrink: 0, borderRadius: '8px',
        backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <RarityBadge copies={item.copies_sold} />
      {item.item_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.item_image_url} alt={item.name} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
      ) : (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>No Image</div>
      )}
    </Link>
  );
}

function WildcardTile({ tag }: { tag: WildcardTag }) {
  const info = WILDCARD_INFO[tag];
  return (
    <div
      title={info.description}
      style={{
        width: '92px', height: '92px', flexShrink: 0, borderRadius: '8px',
        background: `linear-gradient(160deg, ${info.color}33, ${info.color}11)`,
        border: `1px solid ${info.color}66`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
      }}
    >
      <span style={{ fontSize: '1.8rem', filter: `drop-shadow(0 1px 3px ${info.color}88)` }}>{info.emoji}</span>
      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: info.color, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{info.label}</span>
    </div>
  );
}

function CurrencyTile({ type, amount }: { type: 'token' | 'scrip' | null; amount: number | null }) {
  if (!amount) return null;
  return (
    <div style={{
      width: '92px', height: '92px', flexShrink: 0, borderRadius: '8px',
      border: '1px solid var(--rare-color)', backgroundColor: 'rgba(226, 185, 85, 0.12)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.15rem', padding: '0.25rem',
    }}>
      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--rare-color)' }}>{formatNumber(amount)}</span>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{type}s</span>
    </div>
  );
}

function TotalsRow({ totalValue, totalRap }: { totalValue: number; totalRap: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '0.9rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Value</div>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#5b9bf0' }}>{totalValue > 0 ? formatNumber(totalValue) : '-'}</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>RAP</div>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--success-color)' }}>{totalRap > 0 ? formatNumber(totalRap) : '-'}</div>
      </div>
    </div>
  );
}

export default function TradeAdCard({
  ad,
  itemsById,
  creator,
  creatorBadge,
  isOwner,
}: {
  ad: TradeAdData;
  itemsById: Map<number, TradeAdItem>;
  creator: { username: string; avatarUrl: string | null } | null;
  creatorBadge: InlineBadgeInfo | null;
  isOwner: boolean;
}) {
  const [closed, setClosed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  if (closed) return null;

  const handleClose = async () => {
    setIsBusy(true);
    const result = await closeTradeAd(ad.id);
    setIsBusy(false);
    if (!result.error) setClosed(true);
  };

  const offerItems = ad.offer_item_ids.map((id) => itemsById.get(id)).filter((i): i is TradeAdItem => Boolean(i));
  const requestItems = ad.request_slots
    .filter((s): s is Extract<RequestSlot, { type: 'item' }> => s.type === 'item')
    .map((s) => itemsById.get(s.itemId))
    .filter((i): i is TradeAdItem => Boolean(i));

  const offerTotalValue = offerItems.reduce((sum, i) => sum + (i.value || 0), 0) + (ad.offer_currency_amount || 0);
  const offerTotalRap = offerItems.reduce((sum, i) => sum + (i.rap || 0), 0);
  const requestTotalValue = requestItems.reduce((sum, i) => sum + (i.value || 0), 0) + (ad.request_currency_amount || 0);
  const requestTotalRap = requestItems.reduce((sum, i) => sum + (i.rap || 0), 0);

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <Link href={`/player/${ad.creator_usbx_id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', color: 'inherit' }}>
          {creator?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.avatarUrl} alt={creator.username} style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'contain', backgroundColor: 'var(--bg-tertiary)' }} />
          ) : (
            <div style={{ width: '36px', height: '36px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)' }} />
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{creator?.username || `Player #${ad.creator_usbx_id}`}</span>
              {creatorBadge && <BadgeIcon badge={creatorBadge} size={14} />}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{timeAgo(ad.created_at)}</div>
          </div>
        </Link>

        {isOwner ? (
          <button onClick={handleClose} disabled={isBusy} className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', borderRadius: '999px' }}>
            {isBusy ? 'Closing...' : 'Close Ad'}
          </button>
        ) : (
          <Link href={`/player/${ad.creator_usbx_id}`} className="btn btn-primary btn-hover-green" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '999px', textDecoration: 'none' }}>
            View Profile
          </Link>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div>
          <div style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Offering</div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {offerItems.map((item) => <ItemTile key={item.id} item={item} />)}
            <CurrencyTile type={ad.offer_currency_type} amount={ad.offer_currency_amount} />
          </div>
          <TotalsRow totalValue={offerTotalValue} totalRap={offerTotalRap} />
        </div>

        <div>
          <div style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Requesting</div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {ad.request_slots.map((slot, i) =>
              slot.type === 'item' ? (
                itemsById.has(slot.itemId) ? <ItemTile key={i} item={itemsById.get(slot.itemId)!} /> : null
              ) : (
                <WildcardTile key={i} tag={slot.tag} />
              )
            )}
            <CurrencyTile type={ad.request_currency_type} amount={ad.request_currency_amount} />
          </div>
          <TotalsRow totalValue={requestTotalValue} totalRap={requestTotalRap} />
        </div>
      </div>
    </div>
  );
}
