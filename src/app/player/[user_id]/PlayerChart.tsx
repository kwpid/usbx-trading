'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
} from 'recharts';
import { SnapshotItem } from '@/lib/snapshot';

type HistoryRow = {
  recorded_at: string;
  total_rap: number;
  total_value: number;
  inventory_snapshot: SnapshotItem[] | null;
};

type Props = {
  history: HistoryRow[];
};

type ChartPoint = {
  ts: number;
  date: string;
  RAP: number;
  Value: number;
  inventory: SnapshotItem[] | null;
};

const RANGES = [
  { key: '1w', label: '1W', days: 7 },
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: '6m', label: '6M', days: 180 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: null },
] as const;

function formatYAxis(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
  return String(v);
}

function formatNumber(v: number) {
  return v.toLocaleString();
}

function fmtAxisDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// e.g. "Wed, Aug 5, 2026" — includes the weekday per the request.
function fmtFullDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const point: ChartPoint = payload[0].payload;
  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.85rem' }}>
      <div style={{ fontWeight: 700, marginBottom: '0.35rem', fontSize: '0.85rem' }}>{fmtFullDate(point.ts)}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.8rem', color: entry.color }}>
          <span>{entry.dataKey}</span>
          <span style={{ fontWeight: 600 }}>{formatNumber(entry.value)}</span>
        </div>
      ))}
      <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Click to view inventory on this date</div>
    </div>
  );
}

function InventoryOnDate({ point, onClose }: { point: ChartPoint; onClose: () => void }) {
  const items = point.inventory || [];
  const sorted = [...items].sort((a, b) => (b.value || 0) - (a.value || 0) || (b.rap || 0) - (a.rap || 0));

  return (
    <div className="card" style={{ padding: '1rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Inventory on {fmtFullDate(point.ts)}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            RAP {formatNumber(point.RAP)} · Value {formatNumber(point.Value)} · {items.length} unique item{items.length === 1 ? '' : 's'}
          </div>
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          No inventory snapshot was recorded for this date.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', maxHeight: '360px', overflowY: 'auto' }}>
          {sorted.map((item) => (
            <Link key={item.id} href={`/items/${item.id}`} className="card" style={{ padding: 0, overflow: 'hidden', textDecoration: 'none' }}>
              <div style={{ position: 'relative', height: '90px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.name} style={{ maxWidth: '75%', maxHeight: '75%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>No Image</div>
                )}
                {item.copies > 1 && (
                  <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--rare-color)', color: '#000', fontWeight: 800, fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                    x{item.copies}
                  </div>
                )}
              </div>
              <div style={{ padding: '0.5rem 0.6rem', fontSize: '0.75rem' }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.2rem' }}>{item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>RAP</span><span>{formatNumber(item.rap)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Value</span><span>{formatNumber(item.value)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlayerChart({ history }: Props) {
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('3m');
  const [selected, setSelected] = useState<ChartPoint | null>(null);

  const allData: ChartPoint[] = useMemo(
    () =>
      (history || []).map((row) => ({
        ts: new Date(row.recorded_at).getTime(),
        date: fmtAxisDate(new Date(row.recorded_at).getTime()),
        RAP: row.total_rap,
        Value: row.total_value,
        inventory: row.inventory_snapshot,
      })),
    [history]
  );

  const activeRange = RANGES.find((r) => r.key === range)!;
  const data = useMemo(() => {
    if (!activeRange.days) return allData;
    const cutoff = Date.now() - activeRange.days * 24 * 60 * 60 * 1000;
    return allData.filter((p) => p.ts >= cutoff);
  }, [allData, activeRange]);

  if (!history || history.length === 0) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No historical data available yet. Visit this profile again tomorrow to start seeing charts!
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '300px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Portfolio History</h2>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '4px',
                backgroundColor: range === r.key ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                color: range === r.key ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            onClick={(state: any) => {
              if (state?.activePayload?.[0]?.payload) {
                setSelected(state.activePayload[0].payload as ChartPoint);
              }
            }}
          >
            <defs>
              <linearGradient id="colorRap" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--rare-color)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--rare-color)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--success-color)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--success-color)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickFormatter={formatYAxis} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--accent-color)', strokeWidth: 1 }} />
            <Legend />
            <Area type="monotone" dataKey="RAP" stroke="var(--rare-color)" fillOpacity={1} fill="url(#colorRap)" strokeWidth={2} activeDot={{ r: 6, style: { cursor: 'pointer' } }} />
            <Area type="monotone" dataKey="Value" stroke="var(--success-color)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} activeDot={{ r: 6, style: { cursor: 'pointer' } }} />
            {data.length > 1 && (
              <Brush
                dataKey="date"
                height={24}
                stroke="var(--accent-color)"
                fill="var(--bg-tertiary)"
                travellerWidth={8}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {selected && <InventoryOnDate point={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
