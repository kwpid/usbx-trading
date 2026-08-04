'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type HistoryRow = {
  recorded_at: string;
  total_rap: number;
  total_value: number;
};

type Props = {
  history: HistoryRow[];
};

function formatYAxis(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
  return String(v);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CHART_STYLE = {
  contentStyle: {
    backgroundColor: 'var(--bg-secondary)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '8px',
  },
  itemStyle: { color: 'var(--text-primary)' },
};

export default function PlayerChart({ history }: Props) {
  if (!history || history.length === 0) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No historical data available yet. Visit this profile again tomorrow to start seeing charts!
      </div>
    );
  }

  // Format data for Recharts
  const data = history.map((row) => ({
    date: fmtDate(row.recorded_at),
    RAP: row.total_rap,
    Value: row.total_value,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '300px' }}>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 800 }}>Portfolio History</h2>
      
      <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
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
            <Tooltip {...CHART_STYLE} />
            <Legend />
            <Area type="monotone" dataKey="RAP" stroke="var(--rare-color)" fillOpacity={1} fill="url(#colorRap)" strokeWidth={2} activeDot={{ r: 6 }} />
            <Area type="monotone" dataKey="Value" stroke="var(--success-color)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
