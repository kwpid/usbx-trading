'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { searchTradeItems } from './actions';
import RarityBadge from '@/app/components/RarityBadge';

type TradeItem = {
  id: number;
  name: string;
  item_image_url: string | null;
  rap: number | null;
  value: number | null;
  available_owners?: number | null;
  is_limited?: boolean | null;
};

type Side = 'give' | 'receive';

const MIN_SLOTS = 1;
const MAX_SLOTS = 20;
const DEFAULT_SLOTS = 5;

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

function SlotStepper({ count, onChange, disabledDown }: { count: number; onChange: (n: number) => void; disabledDown: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Slots</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(MIN_SLOTS, count - 1))}
        disabled={disabledDown || count <= MIN_SLOTS}
        style={{ width: '22px', height: '22px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem', opacity: disabledDown || count <= MIN_SLOTS ? 0.4 : 1 }}
        title={disabledDown ? 'Remove items from this side first' : undefined}
      >
        −
      </button>
      <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: '1.2rem', textAlign: 'center' }}>{count}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(MAX_SLOTS, count + 1))}
        disabled={count >= MAX_SLOTS}
        style={{ width: '22px', height: '22px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.8rem', opacity: count >= MAX_SLOTS ? 0.4 : 1 }}
      >
        +
      </button>
    </div>
  );
}

function TradeSidePanel({
  label,
  items,
  slotCount,
  isActive,
  onActivate,
  onRemove,
  onSlotCountChange,
}: {
  label: string;
  items: TradeItem[];
  slotCount: number;
  isActive: boolean;
  onActivate: () => void;
  onRemove: (index: number) => void;
  onSlotCountChange: (n: number) => void;
}) {
  const totalRap = items.reduce((sum, i) => sum + (i.rap || 0), 0);
  const totalValue = items.reduce((sum, i) => sum + (i.value || 0), 0);

  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        flex: 1,
        minWidth: 0,
        border: isActive ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onActivate}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <h2 style={{ fontSize: '1.2rem', margin: 0, color: isActive ? 'var(--accent-color)' : 'var(--text-primary)' }}>
            {label}{isActive && ' ●'}
          </h2>
        </button>
        <SlotStepper count={slotCount} onChange={onSlotCountChange} disabledDown={slotCount <= items.length} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {Array.from({ length: slotCount }).map((_, i) => {
          const item = items[i];
          if (item) {
            return (
              <div key={`${item.id}-${i}`} style={{ position: 'relative', padding: '0.4rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  style={{ position: 'absolute', top: '2px', right: '2px', color: 'var(--danger-color)', fontSize: '0.75rem', lineHeight: 1, background: 'var(--bg-secondary)', borderRadius: '50%', width: '16px', height: '16px' }}
                >
                  ✕
                </button>
                {item.item_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.item_image_url} alt={item.name} style={{ width: '100%', height: '48px', objectFit: 'contain' }} />
                ) : (
                  <div style={{ height: '48px' }} />
                )}
                <div style={{ fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{item.name}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--rare-color)', textAlign: 'center', fontWeight: 700 }}>{formatNumber(item.value)}</div>
              </div>
            );
          }
          return (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={onActivate}
              style={{
                minHeight: '84px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                border: `1px dashed ${isActive ? 'var(--accent-color)' : 'var(--border-color)'}`,
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '1.3rem',
              }}
            >
              +
            </button>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
        <span>
          <span style={{ color: 'var(--text-secondary)' }}>Total RAP: </span>
          <strong>{formatNumber(totalRap)}</strong>
        </span>
        <span>
          <span style={{ color: 'var(--text-secondary)' }}>Total Value: </span>
          <strong style={{ color: 'var(--rare-color)' }}>{formatNumber(totalValue)}</strong>
        </span>
      </div>
    </div>
  );
}

export default function TradeCalculator({
  initialItems,
  currentPage,
  totalPages,
}: {
  initialItems: TradeItem[];
  currentPage: number;
  totalPages: number;
}) {
  const [giveItems, setGiveItems] = useState<TradeItem[]>([]);
  const [receiveItems, setReceiveItems] = useState<TradeItem[]>([]);
  const [giveSlots, setGiveSlots] = useState(DEFAULT_SLOTS);
  const [receiveSlots, setReceiveSlots] = useState(DEFAULT_SLOTS);
  const [activeSide, setActiveSide] = useState<Side>('give');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TradeItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      const found = await searchTradeItems(value);
      setResults(found);
      setIsSearching(false);
    }, 250);
  };

  const activeSideFull = activeSide === 'give' ? giveItems.length >= giveSlots : receiveItems.length >= receiveSlots;

  // Fills whichever side is active; once that side hits its slot limit,
  // automatically flips to the other side so repeated clicks keep working
  // without needing to manually switch between "You Give" / "You Receive".
  const addToActiveSide = (item: TradeItem) => {
    if (activeSide === 'give') {
      setGiveItems((prev) => {
        if (prev.length >= giveSlots) return prev;
        const next = [...prev, item];
        if (next.length >= giveSlots) setActiveSide('receive');
        return next;
      });
    } else {
      setReceiveItems((prev) => {
        if (prev.length >= receiveSlots) return prev;
        const next = [...prev, item];
        if (next.length >= receiveSlots) setActiveSide('give');
        return next;
      });
    }
  };

  const giveValue = giveItems.reduce((sum, i) => sum + (i.value || 0), 0);
  const receiveValue = receiveItems.reduce((sum, i) => sum + (i.value || 0), 0);
  const giveRap = giveItems.reduce((sum, i) => sum + (i.rap || 0), 0);
  const receiveRap = receiveItems.reduce((sum, i) => sum + (i.rap || 0), 0);

  const valueDiff = receiveValue - giveValue;
  const fairThreshold = Math.max(giveValue, receiveValue, 1) * 0.02; // within 2% counts as fair
  const verdict =
    giveItems.length === 0 && receiveItems.length === 0
      ? null
      : Math.abs(valueDiff) <= fairThreshold
      ? { text: 'Fair Trade', color: 'var(--text-secondary)' }
      : valueDiff > 0
      ? { text: `You Win by ${formatNumber(valueDiff)} Value`, color: 'var(--success-color)' }
      : { text: `You Lose by ${formatNumber(Math.abs(valueDiff))} Value`, color: 'var(--danger-color)' };

  const browseItems = query.trim() ? results : initialItems;

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <TradeSidePanel
          label="You Give (Sender)"
          items={giveItems}
          slotCount={giveSlots}
          isActive={activeSide === 'give'}
          onActivate={() => setActiveSide('give')}
          onRemove={(idx) => setGiveItems((prev) => prev.filter((_, i) => i !== idx))}
          onSlotCountChange={setGiveSlots}
        />
        <TradeSidePanel
          label="You Receive (Receiver)"
          items={receiveItems}
          slotCount={receiveSlots}
          isActive={activeSide === 'receive'}
          onActivate={() => setActiveSide('receive')}
          onRemove={(idx) => setReceiveItems((prev) => prev.filter((_, i) => i !== idx))}
          onSlotCountChange={setReceiveSlots}
        />
      </div>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center', marginBottom: verdict ? '1rem' : 0 }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>RAP Difference</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{formatNumber(receiveRap - giveRap)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Value Difference</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: valueDiff >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
              {valueDiff >= 0 ? '+' : ''}{formatNumber(valueDiff)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Items</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{giveItems.length} ⇄ {receiveItems.length}</div>
          </div>
        </div>
        {verdict && (
          <div style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: verdict.color }}>
            {verdict.text}
          </div>
        )}
      </div>

      {/* Browse Items — the sole way to add items now; clicking a card adds
          it to whichever side is currently active. */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Browse Items</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Adding to:{' '}
            <button
              type="button"
              onClick={() => setActiveSide('give')}
              style={{ fontWeight: 700, color: activeSide === 'give' ? 'var(--accent-color)' : 'var(--text-secondary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              You Give
            </button>
            {' / '}
            <button
              type="button"
              onClick={() => setActiveSide('receive')}
              style={{ fontWeight: 700, color: activeSide === 'receive' ? 'var(--accent-color)' : 'var(--text-secondary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              You Receive
            </button>
            {activeSideFull && <span style={{ color: 'var(--danger-color)', marginLeft: '0.5rem' }}>(side full)</span>}
          </div>
        </div>

        <input
          type="text"
          className="input"
          placeholder="Search items..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          style={{ marginBottom: '1.5rem', maxWidth: '400px' }}
        />

        {browseItems.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {isSearching ? 'Searching…' : 'No items found.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {browseItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addToActiveSide(item)}
                disabled={activeSideFull}
                className="card"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0, opacity: activeSideFull ? 0.5 : 1, cursor: activeSideFull ? 'not-allowed' : 'pointer' }}
              >
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <Link
                    href={`/items/${item.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: 'var(--text-secondary)', flexShrink: 0, fontSize: '0.9rem' }}
                    title="View item page"
                  >
                    ↗
                  </Link>
                </div>
                <div style={{ position: 'relative', height: '160px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.is_limited && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #EF4444', color: '#EF4444', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold', borderRadius: '4px', zIndex: 10 }}>
                      LIMITED
                    </div>
                  )}
                  <RarityBadge owners={item.available_owners} />
                  {item.item_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.item_image_url} alt={item.name} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ color: 'var(--text-secondary)' }}>No Image</div>
                  )}
                </div>
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>RAP</span>
                    <span style={{ fontWeight: '500' }}>{formatNumber(item.rap)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Value</span>
                    <span style={{ fontWeight: '500', color: 'var(--rare-color)' }}>{formatNumber(item.value)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!query.trim() && totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
            <Link
              href={`/trade-calculator?page=${currentPage - 1}`}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.6rem', textDecoration: 'none', pointerEvents: currentPage <= 1 ? 'none' : 'auto', opacity: currentPage <= 1 ? 0.5 : 1 }}
            >
              &larr;
            </Link>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>
              Page {currentPage} of {totalPages}
            </span>
            <Link
              href={`/trade-calculator?page=${currentPage + 1}`}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.6rem', textDecoration: 'none', pointerEvents: currentPage >= totalPages ? 'none' : 'auto', opacity: currentPage >= totalPages ? 0.5 : 1 }}
            >
              &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
