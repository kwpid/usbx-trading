'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="container" style={{ padding: '0', maxWidth: '600px' }}>
      <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          This page hit an error. It&apos;s probably temporary, try again or head back home.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
