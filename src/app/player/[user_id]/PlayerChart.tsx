'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  ReferenceArea,
} from 'recharts';
import { PlayerHistoryRow, findHistoryIndexForTimestamp, utcDayKey } from '@/lib/snapshot';

type Props = {
  history: PlayerHistoryRow[];
};

type ChartPoint = {
  ts: number;
  date: string;
  RAP: number | null;
  Value: number | null;
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
  const real = payload.filter((entry: any) => entry.value != null);
  if (real.length === 0) {
    return (
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.85rem', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        Archived (before tracking began)
      </div>
    );
  }
  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.85rem' }}>
      <div style={{ fontWeight: 700, marginBottom: '0.35rem', fontSize: '0.85rem' }}>{fmtFullDate(point.ts)}</div>
      {real.map((entry: any) => (
        <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.8rem', color: entry.color }}>
          <span>{entry.dataKey}</span>
          <span style={{ fontWeight: 600 }}>{formatNumber(entry.value)}</span>
        </div>
      ))}
      <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Click to view inventory on this date</div>
    </div>
  );
}

export default function PlayerChart({ history }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('3m');

  const realData: ChartPoint[] = useMemo(
    () =>
      (history || []).map((row) => ({
        ts: new Date(row.recorded_at).getTime(),
        date: fmtAxisDate(new Date(row.recorded_at).getTime()),
        RAP: row.total_rap,
        Value: row.total_value,
      })),
    [history]
  );

  const activeRange = RANGES.find((r) => r.key === range)!;

  // For a fixed-length range (3M, 1Y, etc.) where real tracking doesn't go
  // back that far, prepend a null-valued boundary point so the chart's axis
  // spans the full window — that's what leaves the gap a ReferenceArea can
  // shade as "Archived Data", the same way Rolimons marks pre-tracking time.
  const { data, archivedRange } = useMemo(() => {
    if (!activeRange.days) return { data: realData, archivedRange: null as [string, string] | null };

    const cutoff = Date.now() - activeRange.days * 24 * 60 * 60 * 1000;
    const windowed = realData.filter((p) => p.ts >= cutoff);
    if (windowed.length === 0) return { data: windowed, archivedRange: null as [string, string] | null };

    const firstReal = windowed[0];
    if (utcDayKey(firstReal.ts) <= utcDayKey(cutoff)) {
      return { data: windowed, archivedRange: null as [string, string] | null };
    }

    const boundary: ChartPoint = { ts: cutoff, date: fmtAxisDate(cutoff), RAP: null, Value: null };
    return { data: [boundary, ...windowed], archivedRange: [boundary.date, firstReal.date] as [string, string] };
  }, [realData, activeRange]);

  // Rolimons-style deep link — https://usbx.trade/player/{id}?timestamp={unix
  // seconds}. The URL is the source of truth for which point is selected
  // (shareable, back-button-able); the inventory section below reads the
  // same param to swap into historical mode.
  const selectedIndex = findHistoryIndexForTimestamp(history, searchParams.get('timestamp'));
  const selected = selectedIndex >= 0 ? data.find((p) => utcDayKey(p.ts) === utcDayKey(new Date(history[selectedIndex].recorded_at).getTime())) : null;

  const selectPoint = (point: ChartPoint | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (point) {
      params.set('timestamp', String(Math.floor(point.ts / 1000)));
    } else {
      params.delete('timestamp');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

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
              // recharts v3 no longer hands back `activePayload` the way v2
              // did — the click state only carries an index/label, so we
              // look the point up ourselves from the same `data` array the
              // chart is rendering.
              const rawIndex = state?.activeTooltipIndex ?? state?.activeIndex;
              const idx = rawIndex == null ? NaN : Number(rawIndex);
              const point = !Number.isNaN(idx) ? data[idx] : data.find((p) => p.date === state?.activeLabel);
              if (point && point.RAP != null) selectPoint(point);
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
            {archivedRange && (
              <ReferenceArea
                x1={archivedRange[0]}
                x2={archivedRange[1]}
                fill="var(--text-secondary)"
                fillOpacity={0.08}
                stroke="var(--border-color)"
                strokeDasharray="4 4"
                label={{ value: 'Archived Data', position: 'insideTopLeft', fill: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 12 }}
              />
            )}
            <Area type="monotone" dataKey="RAP" stroke="var(--rare-color)" fillOpacity={1} fill="url(#colorRap)" strokeWidth={2} connectNulls={false} activeDot={{ r: 6, style: { cursor: 'pointer' } }} />
            <Area type="monotone" dataKey="Value" stroke="var(--success-color)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} connectNulls={false} activeDot={{ r: 6, style: { cursor: 'pointer' } }} />
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

      {selected && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--accent-color)', textAlign: 'right' }}>
          Viewing inventory from {fmtFullDate(selected.ts)} below.{' '}
          <button onClick={() => selectPoint(null)} style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
            back to live
          </button>
        </div>
      )}
    </div>
  );
}
