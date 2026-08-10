'use client';

import { useState } from 'react';
import Link from 'next/link';
import { testRapWebhook, testSalesWebhook } from './actions';

type WebhookKey = 'rap' | 'sales';

export default function AdminPageClient() {
  const [busy, setBusy] = useState<WebhookKey | null>(null);
  const [results, setResults] = useState<Record<WebhookKey, { ok: boolean; message: string } | null>>({
    rap: null,
    sales: null,
  });

  const runTest = async (key: WebhookKey, action: () => Promise<{ success?: boolean; error?: string }>) => {
    setBusy(key);
    setResults((prev) => ({ ...prev, [key]: null }));
    const result = await action();
    setBusy(null);
    setResults((prev) => ({
      ...prev,
      [key]: result.success
        ? { ok: true, message: 'Sent — check the Discord channel.' }
        : { ok: false, message: result.error || 'Failed to send.' },
    }));
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>Admin Dashboard</h1>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <Link href="/admin/scrape" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          Add Limited Item (from link)
        </Link>
        <Link href="/admin/sync" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          Sync Marketplace Items
        </Link>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Test Webhooks</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Sends a dummy embed through the real sender so you can confirm the Discord webhook env vars are set and accepted, without waiting for a real RAP change or sale.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => runTest('rap', testRapWebhook)}
                disabled={busy === 'rap'}
              >
                {busy === 'rap' ? 'Sending...' : 'Test RAP Webhook'}
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>DISCORD_RAP_WEBHOOK_URL</span>
            </div>
            {results.rap && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: results.rap.ok ? 'var(--success-color)' : 'var(--danger-color)' }}>
                {results.rap.message}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => runTest('sales', testSalesWebhook)}
                disabled={busy === 'sales'}
              >
                {busy === 'sales' ? 'Sending...' : 'Test Recent Sale Webhook'}
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>DISCORD_SALES_WEBHOOK_URL</span>
            </div>
            {results.sales && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: results.sales.ok ? 'var(--success-color)' : 'var(--danger-color)' }}>
                {results.sales.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
