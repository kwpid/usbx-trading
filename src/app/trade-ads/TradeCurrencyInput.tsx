'use client';

export type TradeCurrency = { type: 'token' | 'scrip'; amount: number } | null;

export default function TradeCurrencyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TradeCurrency;
  onChange: (next: TradeCurrency) => void;
}) {
  const type = value?.type ?? 'scrip';
  const amount = value?.amount ?? 0;

  return (
    <div className="input-group">
      <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{label} Currency (optional)</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <select
          className="input"
          value={type}
          onChange={(e) => onChange(amount > 0 ? { type: e.target.value as 'token' | 'scrip', amount } : null)}
          style={{ width: '110px' }}
        >
          <option value="scrip">Scrips</option>
          <option value="token">Tokens</option>
        </select>
        <input
          type="number"
          className="input"
          min={0}
          value={amount || ''}
          placeholder="0"
          onChange={(e) => {
            const next = Math.max(0, Math.round(parseFloat(e.target.value) || 0));
            onChange(next > 0 ? { type, amount: next } : null);
          }}
        />
      </div>
    </div>
  );
}
