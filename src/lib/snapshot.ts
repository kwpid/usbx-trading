// Compact per-item shape stored in player_value_history.inventory_snapshot —
// just enough to render "what they had on this date" without re-fetching
// from USBX. Shared between the server action that writes it and the chart
// component that reads it back.
export type SnapshotItem = {
  id: number;
  name: string;
  imageUrl: string | null;
  rap: number;
  value: number;
  copies: number;
  serials: string[];
};

export type PlayerHistoryRow = {
  recorded_at: string;
  total_rap: number;
  total_value: number;
  inventory_snapshot: SnapshotItem[] | null;
};

// Snapshots are one row per UTC calendar day (recordPlayerSnapshot upserts
// same-day revisits in place), so matching a Rolimons-style ?timestamp=
// param to a row means comparing UTC day, not exact millisecond.
export function utcDayKey(ts: number): number {
  return Math.floor(ts / 86_400_000);
}

// Shared between PlayerChart (sets the URL) and ProfileInventoryClient
// (reads it back) so both agree on which row a given timestamp resolves to.
export function findHistoryIndexForTimestamp(history: PlayerHistoryRow[], timestampSeconds: string | null): number {
  if (!timestampSeconds) return -1;
  const targetMs = Number(timestampSeconds) * 1000;
  if (Number.isNaN(targetMs)) return -1;
  const targetDay = utcDayKey(targetMs);
  return history.findIndex((r) => utcDayKey(new Date(r.recorded_at).getTime()) === targetDay);
}
