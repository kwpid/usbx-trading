'use client';

import { useEffect } from 'react';
import { checkAndAwardBadges } from './actions';
import { BadgeCollectible } from '@/lib/badges';

export default function AwardBadges({
  userId,
  totalValue,
  collectibles,
}: {
  userId: string;
  totalValue: number;
  collectibles: BadgeCollectible[];
}) {
  useEffect(() => {
    checkAndAwardBadges(userId, totalValue, collectibles).catch(console.error);
    // Collectibles is derived fresh per render from live inventory data, not
    // referentially stable — re-running on every mount is fine since award
    // checks are idempotent (already-owned badges are skipped).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, totalValue]);

  return null;
}
