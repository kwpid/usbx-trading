'use client';

import { useEffect } from 'react';
import { recordPlayerSnapshot } from './actions';

export default function RecordSnapshot({ userId, totalRap, totalValue }: { userId: string, totalRap: number, totalValue: number }) {
  useEffect(() => {
    recordPlayerSnapshot(userId, totalRap, totalValue).catch(console.error);
  }, [userId, totalRap, totalValue]);

  return null;
}
