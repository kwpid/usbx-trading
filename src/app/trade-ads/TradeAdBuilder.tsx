'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RarityBadge from '@/app/components/RarityBadge';
import TradeCurrencyInput, { TradeCurrency } from './TradeCurrencyInput';
import { WILDCARD_TAGS, WILDCARD_INFO, WildcardTag } from '@/lib/tradeAdWildcards';
import { getMyTradeAdInventory, searchRequestCatalog, createTradeAd, RequestSlot } from './actions';

type Item = {
  id: number;
  name: string;
  item_image_url: string | null;
  rap: number | null;
  value: number | null;
  available_owners: number | null;
  price_best_resale?: number | null;
  is_limited?: boolean | null;
};

type InventoryItem = Item & { ownedCopies: number };

const MAX_SLOTS = 6;

function formatNumber(num: number | null | undefined) {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
}

function SlotBox({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%',
            background: 'var(--danger-color)', color: '#fff', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function EmptySlot() {
  return (
    <div style={{ width: '100%', height: '100%', borderRadius: '8px', border: '1px dashed var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }} />
  );
}

function ItemSlotContent({ item }: { item: Item }) {
  return (
    <div title={item.name} style={{ width: '100%', height: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <RarityBadge owners={item.available_owners} />
      {item.item_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.item_image_url} alt={item.name} style={{ maxWidth: '75%', maxHeight: '75%', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>No Image</span>
      )}
    </div>
  );
}

function WildcardSlotContent({ tag }: { tag: WildcardTag }) {
  const info = WILDCARD_INFO[tag];
  return (
    <div title={info.description} style={{ width: '100%', height: '100%', borderRadius: '8px', border: `1px solid ${info.color}`, backgroundColor: `${info.color}22`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.15rem' }}>
      <span style={{ fontSize: '1.3rem' }}>{info.emoji}</span>
      <span style={{ fontSize: '0.55rem', fontWeight: 700, color: info.color }}>{info.label}</span>
    </div>
  );
}

// Matches the /market item card layout (name header, image with LIMITED tag
// + rarity badge, Price/RAP/Value/Available rows) so items look the same
// whether you're browsing the marketplace or picking for a trade ad — just
// a button instead of a link, since clicking adds it to a slot.
function PickerItemCard({
  item,
  extraLabel,
  disabled,
  onClick,
}: {
  item: Item;
  extraLabel?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="card"
      style={{ display: 'block', textAlign: 'left', padding: 0, overflow: 'hidden', width: '100%', opacity: disabled ? 0.5 : 1 }}
    >
      <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.name}{extraLabel}
      </div>

      <div style={{ position: 'relative', height: '180px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Price</span>
          <span style={{ fontWeight: '500' }}>{formatNumber(item.price_best_resale)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>RAP</span>
          <span style={{ fontWeight: '500' }}>{formatNumber(item.rap)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Value</span>
          <span style={{ fontWeight: '500', color: 'var(--rare-color)' }}>{formatNumber(item.value)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Available</span>
          <span style={{ fontWeight: '500' }}>{item.available_owners !== null ? item.available_owners : '-'}</span>
        </div>
      </div>
    </button>
  );
}

export default function TradeAdBuilder() {
  const router = useRouter();
  const [activeSide, setActiveSide] = useState<'offer' | 'request'>('offer');

  const [offerItems, setOfferItems] = useState<Item[]>([]);
  const [offerCurrency, setOfferCurrency] = useState<TradeCurrency>(null);

  const [requestSlots, setRequestSlots] = useState<RequestSlot[]>([]);
  const [requestItemsById, setRequestItemsById] = useState<Map<number, Item>>(new Map());
  const [requestCurrency, setRequestCurrency] = useState<TradeCurrency>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<Item[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyTradeAdInventory().then((items) => {
      setInventory(items as InventoryItem[]);
      setInventoryLoading(false);
    });
  }, []);

  useEffect(() => {
    if (activeSide !== 'request') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const found = await searchRequestCatalog(catalogQuery);
      setCatalogResults(found as Item[]);
    }, 250);
  }, [catalogQuery, activeSide]);

  const addOfferItem = (item: InventoryItem) => {
    if (offerItems.length >= MAX_SLOTS || offerItems.some((i) => i.id === item.id)) return;
    setOfferItems((prev) => [...prev, item]);
  };
  const removeOfferItem = (itemId: number) => setOfferItems((prev) => prev.filter((i) => i.id !== itemId));

  const addRequestItem = (item: Item) => {
    if (requestSlots.length >= MAX_SLOTS || requestSlots.some((s) => s.type === 'item' && s.itemId === item.id)) return;
    setRequestSlots((prev) => [...prev, { type: 'item', itemId: item.id }]);
    setRequestItemsById((prev) => new Map(prev).set(item.id, item));
  };
  const addRequestWildcard = (tag: WildcardTag) => {
    if (requestSlots.length >= MAX_SLOTS || requestSlots.some((s) => s.type === 'wildcard' && s.tag === tag)) return;
    setRequestSlots((prev) => [...prev, { type: 'wildcard', tag }]);
  };
  const removeRequestSlot = (index: number) => setRequestSlots((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    setError(null);
    setIsSaving(true);
    const result = await createTradeAd({
      offerItemIds: offerItems.map((i) => i.id),
      offerCurrencyType: offerCurrency?.type ?? null,
      offerCurrencyAmount: offerCurrency?.amount ?? null,
      requestSlots,
      requestCurrencyType: requestCurrency?.type ?? null,
      requestCurrencyAmount: requestCurrency?.amount ?? null,
    });
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push('/trade-ads');
      router.refresh();
    }
  };

  return (
    <div>
      {/* Slot panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveSide('offer')}
          className="card"
          style={{ padding: '1rem', textAlign: 'left', border: activeSide === 'offer' ? '1px solid var(--accent-color)' : undefined }}
        >
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>You Offer ({offerItems.length}/{MAX_SLOTS})</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {Array.from({ length: MAX_SLOTS }).map((_, i) => {
              const item = offerItems[i];
              return (
                <SlotBox key={i} onRemove={item ? () => removeOfferItem(item.id) : undefined}>
                  {item ? <ItemSlotContent item={item} /> : <EmptySlot />}
                </SlotBox>
              );
            })}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <TradeCurrencyInput label="Offer" value={offerCurrency} onChange={setOfferCurrency} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSide('request')}
          className="card"
          style={{ padding: '1rem', textAlign: 'left', border: activeSide === 'request' ? '1px solid var(--accent-color)' : undefined }}
        >
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>You Request ({requestSlots.length}/{MAX_SLOTS})</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {Array.from({ length: MAX_SLOTS }).map((_, i) => {
              const slot = requestSlots[i];
              return (
                <SlotBox key={i} onRemove={slot ? () => removeRequestSlot(i) : undefined}>
                  {!slot ? (
                    <EmptySlot />
                  ) : slot.type === 'wildcard' ? (
                    <WildcardSlotContent tag={slot.tag} />
                  ) : requestItemsById.has(slot.itemId) ? (
                    <ItemSlotContent item={requestItemsById.get(slot.itemId)!} />
                  ) : (
                    <EmptySlot />
                  )}
                </SlotBox>
              );
            })}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <TradeCurrencyInput label="Request" value={requestCurrency} onChange={setRequestCurrency} />
          </div>
        </button>
      </div>

      {/* Picker */}
      <div className="card" style={{ padding: '1.25rem' }}>
        {activeSide === 'request' && (
          <>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>Add a category</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {WILDCARD_TAGS.map((tag) => {
                const info = WILDCARD_INFO[tag];
                const active = requestSlots.some((s) => s.type === 'wildcard' && s.tag === tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addRequestWildcard(tag)}
                    disabled={active || requestSlots.length >= MAX_SLOTS}
                    title={info.description}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                      padding: '0.5rem 0.7rem', borderRadius: '8px', border: `1px solid ${info.color}`,
                      backgroundColor: active ? `${info.color}44` : `${info.color}18`, opacity: active || requestSlots.length >= MAX_SLOTS ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{info.emoji}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: info.color }}>{info.label}</span>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              className="input"
              placeholder="Search the catalog"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              style={{ marginBottom: '1rem' }}
            />

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {catalogQuery.trim() ? 'Search results' : 'Highest value first'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {catalogResults.map((item) => {
                const added = requestSlots.some((s) => s.type === 'item' && s.itemId === item.id);
                return (
                  <PickerItemCard
                    key={item.id}
                    item={item}
                    disabled={added || requestSlots.length >= MAX_SLOTS}
                    onClick={() => addRequestItem(item)}
                  />
                );
              })}
            </div>
          </>
        )}

        {activeSide === 'offer' && (
          <>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Your inventory</div>
            {inventoryLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading your inventory...</div>
            ) : inventory.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No limiteds found in your inventory. You need a verified account with tracked items to offer something.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {inventory.map((item) => {
                  const added = offerItems.some((i) => i.id === item.id);
                  return (
                    <PickerItemCard
                      key={item.id}
                      item={item}
                      extraLabel={item.ownedCopies > 1 ? <span style={{ color: 'var(--rare-color)' }}> x{item.ownedCopies}</span> : undefined}
                      disabled={added || offerItems.length >= MAX_SLOTS}
                      onClick={() => addOfferItem(item)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSaving}
        className="btn btn-primary"
        style={{ marginTop: '1.5rem', width: '100%', padding: '0.85rem', fontSize: '1rem' }}
      >
        {isSaving ? 'Posting...' : 'Post Trade Ad'}
      </button>
    </div>
  );
}
