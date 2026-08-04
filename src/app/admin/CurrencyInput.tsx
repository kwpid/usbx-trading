'use client';

import { SCRIPS_PER_TOKEN } from '@/lib/currency';

// Always scrips — one currency, no toggle. The tokens line underneath is
// read-only reference since the game still quotes some prices in tokens.
export default function CurrencyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (scrips: number) => void;
}) {
  return (
    <div className="input-group">
      <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{label} (scrips)</label>
      <input
        type="number"
        className="input"
        value={value}
        onChange={(e) => onChange(Math.round(parseFloat(e.target.value) || 0))}
      />
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
        = {(value / SCRIPS_PER_TOKEN).toLocaleString()} tokens
        <span style={{ opacity: 0.6 }}> ({SCRIPS_PER_TOKEN} scrips = 1 token)</span>
      </div>
    </div>
  );
}
