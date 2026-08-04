'use client';

import { useEffect, useRef, useState } from 'react';
import { searchTradeItems } from './actions';

type TradeItem = {
  id: number;
  name: string;
  item_image_url: string | null;
  rap: number | null;
  value: number | null;
};

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

function TradeSide({
  label,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  items: TradeItem[];
  onAdd: (item: TradeItem) => void;
  onRemove: (index: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TradeItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
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

  const totalRap = items.reduce((sum, i) => sum + (i.rap || 0), 0);
  const totalValue = items.reduce((sum, i) => sum + (i.value || 0), 0);

  return (
    <div className="card" style={{ padding: '1.5rem', flex: 1, minWidth: 0 }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>{label}</h2>

      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <input
          type="text"
          className="input"
          placeholder="Search items to add..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
        />
        {showResults && query.trim() && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '0.25rem', maxHeight: '260px', overflowY: 'auto' }}>
            {isSearching ? (
              <div style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Searching...</div>
            ) : results.length === 0 ? (
              <div style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No items found.</div>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onAdd(item);
                    setQuery('');
                    setResults([]);
                  }}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
                >
                  {item.item_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.item_image_url} alt={item.name} style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                  )}
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>{item.name}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatNumber(item.value)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '120px', marginBottom: '1rem' }}>
        {items.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem 0' }}>No items added.</div>
        ) : (
          items.map((item, idx) => (
            <div key={`${item.id}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              {item.item_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.item_image_url} alt={item.name} style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              )}
              <span style={{ flex: 1, fontSize: '0.9rem' }}>{item.name}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>RAP {formatNumber(item.rap)}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--rare-color)' }}>Val {formatNumber(item.value)}</span>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                style={{ color: 'var(--danger-color)', fontSize: '1rem', padding: '0 0.25rem' }}
              >
                ✕
              </button>
            </div>
          ))
        )}
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

export default function TradeCalculator() {
  const [giveItems, setGiveItems] = useState<TradeItem[]>([]);
  const [receiveItems, setReceiveItems] = useState<TradeItem[]>([]);

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

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <TradeSide
          label="You Give (Sender)"
          items={giveItems}
          onAdd={(item) => setGiveItems((prev) => [...prev, item])}
          onRemove={(idx) => setGiveItems((prev) => prev.filter((_, i) => i !== idx))}
        />
        <TradeSide
          label="You Receive (Receiver)"
          items={receiveItems}
          onAdd={(item) => setReceiveItems((prev) => [...prev, item])}
          onRemove={(idx) => setReceiveItems((prev) => prev.filter((_, i) => i !== idx))}
        />
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
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
    </div>
  );
}
