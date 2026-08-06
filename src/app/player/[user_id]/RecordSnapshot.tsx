'use client';

import { useEffect } from 'react';
import { recordPlayerSnapshot } from './actions';
import { SnapshotItem } from '@/lib/snapshot';

export default function RecordSnapshot({
  userId,
  totalRap,
  totalValue,
  inventorySnapshot,
}: {
  userId: string;
  totalRap: number;
  totalValue: number;
  inventorySnapshot: SnapshotItem[];
}) {
  useEffect(() => {
    recordPlayerSnapshot(userId, totalRap, totalValue, inventorySnapshot).catch(console.error);
    // inventorySnapshot is derived fresh each render from live inventory —
    // not referentially stable, so it's intentionally left out of the dep
    // array (recording is idempotent per-day anyway).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, totalRap, totalValue]);

  return null;
}
