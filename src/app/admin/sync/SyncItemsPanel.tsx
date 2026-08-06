'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

// ─── Catalog Sync Panel ────────────────────────────────────────────────────

function CatalogSyncPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [upserted, setUpserted] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [done, setDone] = useState(false);
  const stopRef = useRef(false);

  const runSync = async () => {
    setIsRunning(true);
    setError(null);
    setPages(0);
    setUpserted(0);
    setSkipped(0);
    setDone(false);
    stopRef.current = false;

    let cursor: number | undefined;

    while (!stopRef.current) {
      const query = cursor !== undefined ? `?cursor=${cursor}` : '';
      let json: any;
      try {
        const res = await fetch(`/api/admin/sync-items${query}`);
        json = await res.json();
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      } catch (err: any) {
        setError(err.message || 'Sync failed.');
        break;
      }

      setPages((p) => p + 1);
      setUpserted((u) => u + json.upserted);
      setSkipped((s) => s + json.skipped);

      if (!json.nextCursor || json.count === 0) {
        setDone(true);
        break;
      }
      cursor = json.nextCursor;
    }

    setIsRunning(false);
  };

  return (
    <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Catalog Sync</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Walks the entire USBX marketplace and saves non-clothing items. Fetches RAP &amp;
        owner counts for each item during sync. Uses the store listing ID (not item catalog
        ID) for enrichment — so data should be accurate from the start.
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={runSync} disabled={isRunning}>
          {isRunning ? 'Syncing…' : 'Start Full Sync'}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[['Pages fetched', pages], ['Items saved', upserted], ['Skipped (clothing)', skipped]].map(([label, val]) => (
            <div key={label as string} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {done && (
        <p style={{ marginTop: '1rem', color: 'var(--success-color)' }}>
          ✓ Catalog sync complete.
        </p>
      )}
    </div>
  );
}

// ─── Refresh All Items Panel ───────────────────────────────────────────────

function RefreshAllItemsPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(0);
  const [failed, setFailed] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [done, setDone] = useState(false);
  const stopRef = useRef(false);

  const runRefresh = async () => {
    setIsRunning(true);
    setError(null);
    setUpdated(0);
    setFailed(0);
    setCurrentPage(0);
    setTotalPages(0);
    setTotalItems(0);
    setDone(false);
    stopRef.current = false;

    let page = 1;

    while (!stopRef.current) {
      let json: any;
      try {
        const res = await fetch(`/api/admin/refresh-all-items?page=${page}`);
        json = await res.json();
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      } catch (err: any) {
        setError(err.message || 'Refresh failed.');
        break;
      }

      setUpdated((u) => u + json.updated);
      setFailed((f) => f + json.failed);
      setCurrentPage(json.page);
      setTotalPages(json.totalPages);
      setTotalItems(json.totalItems);

      if (json.done) {
        setDone(true);
        break;
      }
      page++;
    }

    setIsRunning(false);
  };

  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Refresh All Items Data</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Re-fetches RAP, owner counts, and price data for every item already in the database.
        Use this to backfill items that are missing data. Does not add new items — run
        Catalog Sync for that.
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          className="btn btn-primary"
          onClick={runRefresh}
          disabled={isRunning}
          style={{ backgroundColor: 'var(--accent-hover)' }}
        >
          {isRunning ? 'Refreshing…' : 'Refresh All Items'}
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

      {(currentPage > 0 || done) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Progress bar */}
          {isRunning && totalPages > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                <span>Page {currentPage} of {totalPages}</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: 8, backgroundColor: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--accent-color)', borderRadius: 4, transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {[
              ['Total Items', totalItems],
              ['Updated', updated],
              ['Failed', failed],
            ].map(([label, val]) => (
              <div key={label as string} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: label === 'Failed' && (val as number) > 0 ? 'var(--danger-color)' : undefined }}>
                  {val}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {done && (
        <p style={{ marginTop: '1rem', color: 'var(--success-color)' }}>
          ✓ All items refreshed. Charts and item pages now have current data.
        </p>
      )}
    </div>
  );
}

import SyncPlayersPanel from './SyncPlayersPanel';
import DealsSyncPanel from './DealsSyncPanel';
import BadgesResetPanel from './BadgesResetPanel';
import CommunityBadgesPanel from './CommunityBadgesPanel';

// ─── Composite Export ──────────────────────────────────────────────────────

export default function SyncItemsPanel() {
  return (
    <div>
      <CatalogSyncPanel />
      <RefreshAllItemsPanel />
      <DealsSyncPanel />
      <CommunityBadgesPanel />
      <BadgesResetPanel />
      <SyncPlayersPanel />
    </div>
  );
}
