import TradeCalculator from './TradeCalculator';

export default function TradeCalculatorPage() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Trade Calculator</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Add items to each side to simulate a trade and compare total RAP/Value.
      </p>
      <TradeCalculator />
    </div>
  );
}
