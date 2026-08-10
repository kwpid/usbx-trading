'use client';

import { useState } from 'react';
import { setMaintenanceMode } from '../actions';

export default function MaintenanceTogglePanel({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !enabled;
    setIsSaving(true);
    setError(null);
    const result = await setMaintenanceMode(next);
    if (result.success) {
      setEnabled(next);
    } else {
      setError(result.error || 'Failed to update maintenance mode.');
    }
    setIsSaving(false);
  };

  return (
    <div
      className="card"
      style={{
        padding: '2rem',
        marginBottom: '1.5rem',
        border: enabled ? '1px solid var(--danger-color)' : '1px solid var(--border-color)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h3 style={{ marginBottom: '0.35rem', fontSize: '1.1rem' }}>Maintenance Mode</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px' }}>
            When on, every visitor except signed-in admins sees a maintenance screen instead of
            the site: nothing renders, nothing is browsable. You stay logged in and can keep
            working normally. The verification/login page always stays reachable so you can
            re-authenticate if your session ever expires.
          </p>
        </div>

        <button
          onClick={toggle}
          disabled={isSaving}
          style={{
            flexShrink: 0,
            width: '56px',
            height: '30px',
            borderRadius: '15px',
            backgroundColor: enabled ? 'var(--danger-color)' : 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            position: 'relative',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease',
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '2px',
              left: enabled ? '28px' : '2px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              transition: 'left 0.2s ease',
            }}
          />
        </button>
      </div>

      {enabled && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px', fontSize: '0.9rem' }}>
          Maintenance mode is currently ON. The live site is hidden from everyone but admins.
        </div>
      )}

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}
    </div>
  );
}
