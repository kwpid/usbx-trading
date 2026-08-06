'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { tokensToScrips } from '@/lib/currency';

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryRow = {
  recorded_at: string;
  rap: number | null;
  value: number | null;
  price_best_resale: number | null;
  available_owners: number | null;
  copies_sold: number | null;
};

type Sale = {
  purchasedAt: string | null;
  price: number | null;
  currency: { code: string } | null;
  buyer?: { id: number; username: string } | null;
  seller?: { id: number; username: string } | null;
  serial?: { serialNumber: string } | null;
};

type Props = {
  item: { id: number; rap?: number | null; value?: number | null };
  recentSales?: Sale[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABS = ['RAP History', 'Value', 'Copies', 'Owners', 'Recent Sales'] as const;
type Tab = (typeof TABS)[number];

function formatYAxis(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
  return String(v);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sub-Charts ───────────────────────────────────────────────────────────────

const CHART_STYLE = {
  contentStyle: {
    backgroundColor: 'var(--bg-secondary)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '8px',
  },
  itemStyle: { color: 'var(--text-primary)' },
};

function NoData({ message = 'No data yet. Run a pricing refresh to populate charts.' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: 'var(--text-secondary)', fontSize: '0.95rem', gap: '0.5rem' }}>
      <span style={{ fontSize: '1.5rem' }}>📊</span>
      {message}
    </div>
  );
}

function HistoryChart({ data }: { data: HistoryRow[] }) {
  const pts = data.filter((r) => r.rap != null).map((r) => ({ date: fmtDate(r.recorded_at), RAP: r.rap }));
  if (pts.length === 0) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={pts} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickFormatter={formatYAxis} />
        <Tooltip {...CHART_STYLE} />
        <Legend />
        <Line type="monotone" dataKey="RAP" stroke="var(--rare-color)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ValueChart({ data }: { data: HistoryRow[] }) {
  const pts = data.filter((r) => r.value != null).map((r) => ({ date: fmtDate(r.recorded_at), Value: r.value }));
  if (pts.length === 0) return <NoData message="Value is tracked manually — no history yet." />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={pts} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickFormatter={formatYAxis} />
        <Tooltip {...CHART_STYLE} />
        <Legend />
        <Line type="monotone" dataKey="Value" stroke="var(--success-color)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CopiesChart({ data }: { data: HistoryRow[] }) {
  const pts = data.filter((r) => r.copies_sold != null).map((r) => ({ date: fmtDate(r.recorded_at), 'Copies Sold': r.copies_sold }));
  if (pts.length === 0) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={pts} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <Tooltip {...CHART_STYLE} />
        <Legend />
        <Line type="monotone" dataKey="Copies Sold" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function OwnersChart({ data }: { data: HistoryRow[] }) {
  const pts = data.filter((r) => r.available_owners != null).map((r) => ({ date: fmtDate(r.recorded_at), Owners: r.available_owners }));
  if (pts.length === 0) return <NoData message="Owner tracking is only available for limited items." />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={pts} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
        <Tooltip {...CHART_STYLE} />
        <Legend />
        <Line type="monotone" dataKey="Owners" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RecentSalesChart({ sales, rap }: { sales: Sale[]; rap: number | null | undefined }) {
  if (sales.length === 0) return <NoData message="No recent sales data available for this item." />;

  // The API returns sales newest-first; take the most recent 30, then flip
  // to chronological order so the chart reads left (past) to right (recent),
  // same direction as every other chart on the site.
  const listNewestFirst = sales
    .filter((s) => s.purchasedAt && s.price != null)
    .slice(0, 30)
    .map((s) => ({
      date: fmtDateTime(s.purchasedAt),
      // Sale prices come back in whatever currency USBX used for that sale;
      // normalize everything to scrips for display, same as the rest of the site.
      Price: s.currency?.code === 'SCRIPS' ? Math.round(s.price as number) : tokensToScrips(s.price as number),
      buyer: s.buyer?.username ?? '?',
      serial: s.serial?.serialNumber ?? '?',
    }));

  const chartPts = [...listNewestFirst].reverse();

  const barColor = (price: number) => {
    if (!rap || rap <= 0) return 'var(--accent-color)';
    if (price < rap * 0.9) return 'var(--success-color)'; // sold below RAP — a deal
    if (price > rap * 1.1) return 'var(--danger-color)'; // sold above RAP — overpaid
    return 'var(--rare-color)'; // roughly at RAP
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartPts} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
          <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickFormatter={formatYAxis} />
          <Tooltip {...CHART_STYLE} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            const vsRap = rap && rap > 0 ? Math.round(((d.Price - rap) / rap) * 100) : null;
            return (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{d.date}</div>
                <div>Price: <b>{d.Price?.toLocaleString()} scrips</b></div>
                {vsRap !== null && (
                  <div>vs RAP: <b style={{ color: vsRap <= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>{vsRap > 0 ? '+' : ''}{vsRap}%</b></div>
                )}
                <div>Buyer: <b>{d.buyer}</b></div>
                <div>Serial: <b>#{d.serial}</b></div>
              </div>
            );
          }} />
          <Bar dataKey="Price" radius={[4, 4, 0, 0]}>
            {chartPts.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.Price)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Transaction list, newest first */}
      <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {listNewestFirst.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 6, fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--accent-hover)', fontWeight: 500 }}>{s.buyer}</span>
            <span style={{ color: 'var(--text-secondary)' }}>#{s.serial}</span>
            <span style={{ fontWeight: 'bold', color: barColor(s.Price) }}>{s.Price?.toLocaleString()} scrips</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{s.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ItemCharts({ item, recentSales = [] }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('RAP History');
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    fetch(`/api/items/${item.id}/price-history`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setHistory(d.history ?? []);
      })
      .catch((e) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [item.id]);

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: 'var(--text-secondary)', gap: '0.75rem' }}>
          <div style={{ width: 20, height: 20, border: '2px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading chart data…
        </div>
      );
    }
    if (fetchError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: 'var(--danger-color)', fontSize: '0.9rem' }}>
          ⚠️ {fetchError}
        </div>
      );
    }
    switch (activeTab) {
      case 'RAP History': return <HistoryChart data={history} />;
      case 'Value': return <ValueChart data={history} />;
      case 'Copies': return <CopiesChart data={history} />;
      case 'Owners': return <OwnersChart data={history} />;
      case 'Recent Sales': return <RecentSalesChart sales={recentSales} rap={item.rap} />;
    }
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="card" style={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
        {/* Tab Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`, borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.75rem 0.25rem',
                textAlign: 'center',
                border: 'none',
                borderBottom: activeTab === tab ? '3px solid var(--accent-color)' : '3px solid transparent',
                fontWeight: activeTab === tab ? 700 : 400,
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                background: 'none',
                fontSize: '0.85rem',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Chart Content */}
        <div style={{ flex: 1, padding: '1.5rem 1rem', backgroundColor: 'var(--bg-secondary)' }}>
          {renderContent()}
        </div>
      </div>
    </>
  );
}
