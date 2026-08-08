'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startVerification, completeVerification } from './actions';

type PendingState = {
  usbxUserId: number;
  code: string;
  avatarUrl: string | null;
  username: string | null;
};

export default function VerificationPanel() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingState | null>(null);
  const [profileUrl, setProfileUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!pending) return;

    try {
      await navigator.clipboard.writeText(pending.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {
      // The Clipboard API throws NotAllowedError in some contexts (e.g. the
      // document briefly loses focus right after a click) — fall back to
      // the older selection-based copy, which works off the same click's
      // user gesture instead of needing focus.
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = pending.code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // fall through to manual-copy hint below
    }

    setError('Could not copy automatically — select the code above and copy it manually.');
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setError(null);
    const result = await startVerification(profileUrl);
    setIsBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      setPending({
        usbxUserId: result.usbxUserId!,
        code: result.code!,
        avatarUrl: result.avatarUrl ?? null,
        username: result.username ?? null,
      });
    }
  };

  const handleComplete = async () => {
    setIsBusy(true);
    setError(null);
    const result = await completeVerification();
    setIsBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  };

  if (pending) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          {pending.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pending.avatarUrl} alt="USBX avatar" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
          )}
          <p style={{ fontSize: '0.95rem' }}>
            Is this you? <strong>{pending.username || `Profile #${pending.usbxUserId}`}</strong>
          </p>
        </div>

        <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Paste this phrase into your description at{' '}
          <a href="https://beta.untitled-sandbox.com/user/settings" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>
            beta.untitled-sandbox.com/user/settings
          </a>:
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <code style={{ flex: 1, display: 'block', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', border: '1px solid var(--border-color)', wordBreak: 'break-all' }}>
            {pending.code}
          </code>
          <button type="button" className="btn btn-secondary" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleComplete} disabled={isBusy}>
          {isBusy ? 'Checking...' : 'Complete'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Enter your USBX profile URL to verify and log in. If you&apos;ve logged out before, you&apos;ll need to verify again.
      </p>

      <form onSubmit={handleStart}>
        <div className="input-group">
          <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Your USBX profile URL</label>
          <input
            type="url"
            className="input"
            placeholder="https://beta.untitled-sandbox.com/user/profile/15"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            required
          />
        </div>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={isBusy}>
          {isBusy ? 'Looking up...' : 'Verify'}
        </button>
      </form>
    </div>
  );
}
