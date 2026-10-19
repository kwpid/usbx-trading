'use client';

import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: '#0a0a0b', color: '#e5e5e5', fontFamily: 'sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              textAlign: 'center',
              padding: '3rem 2rem',
              borderRadius: '12px',
              border: '1px solid #2a2a2e',
              backgroundColor: '#151517',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>usbx.trade hit a problem</h1>
            <p style={{ color: '#a1a1aa', marginBottom: '2rem' }}>
              The whole site failed to load. Try again in a moment.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: '0.6rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#7c3aed',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
