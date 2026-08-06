'use client';

import { useState } from 'react';
import { resetAllBadges } from '../actions';

export default function BadgesResetPanel() {
  const [isResetting, setIsResetting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (!confirm('This wipes every badge every player has earned, site-wide. Players re-earn anything they still qualify for on their next profile visit. Continue?')) {
      return;
    }
    setIsResetting(true);
    setError(null);
    setDone(false);
    const result = await resetAllBadges();
    if (result.success) {
      setDone(true);
    } else {
      setError(result.error || 'Failed to reset badges.');
    }
    setIsResetting(false);
  };

  return (
    <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Reset Trade.Badges</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Clears every awarded badge for every player. Useful after changing badge criteria. Badges
        are re-granted automatically the next time each player&apos;s profile is visited.
      </p>

      <button className="btn btn-secondary" onClick={handleReset} disabled={isResetting} style={{ borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}>
        {isResetting ? 'Resetting…' : 'Reset All Badges'}
      </button>

      {error && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      {done && (
        <p style={{ marginTop: '1rem', color: 'var(--success-color)' }}>
          ✓ All badges reset.
        </p>
      )}
    </div>
  );
}
