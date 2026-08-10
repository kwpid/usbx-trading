'use client';

import { useState } from 'react';
import { setBypassPrivacyLock } from '../settingsActions';

export default function BypassPrivacyToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    const next = !enabled;
    setIsBusy(true);
    setError(null);
    const result = await setBypassPrivacyLock(next);
    setIsBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      setEnabled(next);
    }
  };

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Show inventory even if USBX privacy is stuck private</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            There&apos;s a known bug on USBX where some accounts get stuck showing a private inventory even
            after switching the setting back to public. If that&apos;s happening to you, turning this on lets
            usbx.trade show your limiteds (only limiteds, nothing else) on this site regardless of your live
            USBX privacy setting. Turn it back off any time.
          </p>
        </div>

        <button
          onClick={handleToggle}
          disabled={isBusy}
          role="switch"
          aria-checked={enabled}
          style={{
            flexShrink: 0, width: '48px', height: '26px', borderRadius: '999px', position: 'relative',
            backgroundColor: enabled ? 'var(--success-color)' : 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)', opacity: isBusy ? 0.6 : 1,
          }}
        >
          <span
            style={{
              position: 'absolute', top: '2px', left: enabled ? '24px' : '2px',
              width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff',
              transition: 'left 0.15s ease',
            }}
          />
        </button>
      </div>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: enabled ? 'var(--success-color)' : 'var(--text-secondary)' }}>
        {enabled ? 'On: your limiteds are visible on usbx.trade regardless of your USBX privacy setting.' : 'Off: your inventory follows your live USBX privacy setting, same as everyone else.'}
      </div>
    </div>
  );
}
