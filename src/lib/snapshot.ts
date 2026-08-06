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
