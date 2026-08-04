'use client';

import { useRef, useState } from 'react';

export default function DealsSyncPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [upserted, setUpserted] = useState(0);
  const [done, setDone] = useState(false);
  const stopRef = useRef(false);

  const runSync = async () => {
    setIsRunning(true);
    setError(null);
    setPages(0);
    setUpserted(0);
    setDone(false);
    stopRef.current = false;

    let cursor: number | undefined;
    let startedAt: string | undefined;

    while (!stopRef.current) {
      const params = new URLSearchParams();
      if (cursor !== undefined) params.set('cursor', String(cursor));
      if (startedAt) params.set('startedAt', startedAt);

      let json: any;
      try {
        const res = await fetch(`/api/admin/sync-deals?${params.toString()}`);
        json = await res.json();
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      } catch (err: any) {
        setError(err.message || 'Sync failed.');
        break;
      }

      startedAt = json.startedAt;
      setPages((p) => p + 1);
      setUpserted((u) => u + json.upserted);

      if (json.done || !json.nextCursor) {
        setDone(true);
        break;
      }
      cursor = json.nextCursor;
    }

    setIsRunning(false);
  };

  return (
    <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Sync Deals / Active Listings</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Walks the live USBX marketplace listings feed and mirrors currently-active limited
        listings into our own table, so the Deals page loads instantly instead of hitting
        USBX live. Any listing not seen this run (sold out, delisted, expired) is retired
        automatically. The market worker also keeps this table current in real time as
        listings are posted or sold.
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={runSync} disabled={isRunning}>
          {isRunning ? 'Syncing…' : 'Resync Deals'}
        </button>
        {isRunning && (
          <button className="btn btn-secondary" onClick={() => { stopRef.current = true; }}>
            Stop
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      {(pages > 0 || done) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          {[['Pages fetched', pages], ['Listings synced', upserted]].map(([label, val]) => (
            <div key={label as string} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {done && (
        <p style={{ marginTop: '1rem', color: 'var(--success-color)' }}>
          ✓ Deals sync complete.
        </p>
      )}
    </div>
  );
}
