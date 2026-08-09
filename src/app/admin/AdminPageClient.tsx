'use client';

import Link from 'next/link';

export default function AdminPageClient() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>Admin Dashboard</h1>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/admin/scrape" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          Add Limited Item (from link)
        </Link>
        <Link href="/admin/sync" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          Sync Marketplace Items
        </Link>
      </div>
    </div>
  );
}
