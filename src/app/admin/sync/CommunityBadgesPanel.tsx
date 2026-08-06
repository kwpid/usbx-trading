'use client';

import { useState } from 'react';
import { lookupPlayerBadges, grantBadge, revokeBadge } from '../actions';
import { BADGES } from '@/lib/badges';

const COMMUNITY_BADGES = BADGES.filter((b) => b.category === 'Community');

export default function CommunityBadgesPanel() {
  const [userIdInput, setUserIdInput] = useState('');
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
    const id = parseInt(userIdInput, 10);
    if (!id || id <= 0) {
      setError('Enter a valid USBX user id.');
      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await lookupPlayerBadges(id);
    if (!result.success) {
      setError(result.error || 'Lookup failed.');
      setIsLoading(false);
      return;
    }

    setLoadedUserId(id);
    setUsername(result.username);
    setOwnedIds(new Set(result.badgeIds));
    setIsLoading(false);
  };

  const handleToggle = async (badgeId: string, owned: boolean) => {
    if (loadedUserId === null) return;
    setIsMutating(badgeId);
    setError(null);

    const result = owned ? await revokeBadge(loadedUserId, badgeId) : await grantBadge(loadedUserId, badgeId);

    if (!result.success) {
      setError(result.error || 'Action failed.');
    } else {
      setOwnedIds((prev) => {
        const next = new Set(prev);
        if (owned) next.delete(badgeId);
        else next.add(badgeId);
        return next;
      });
    }
    setIsMutating(null);
  };

  return (
    <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Community Badges</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Manually grant or revoke Community-category badges (Developer, Value Mod, etc.) on any
        account by USBX user id.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <input
          type="number"
          className="input"
          placeholder="USBX user id"
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
          style={{ maxWidth: '200px' }}
        />
        <button className="btn btn-primary" onClick={handleLoad} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      {loadedUserId !== null && (
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
            Editing badges for <strong>{username || `User #${loadedUserId}`}</strong> (id {loadedUserId})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {COMMUNITY_BADGES.map((badge) => {
              const owned = ownedIds.has(badge.id);
              return (
                <div
                  key={badge.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={badge.icon} alt={badge.name} style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{badge.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{badge.description}</div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => handleToggle(badge.id, owned)}
                    disabled={isMutating === badge.id}
                    style={{
                      backgroundColor: owned ? 'var(--danger-color)' : 'var(--accent-color)',
                      color: '#fff',
                      minWidth: '90px',
                    }}
                  >
                    {isMutating === badge.id ? '…' : owned ? 'Revoke' : 'Grant'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
