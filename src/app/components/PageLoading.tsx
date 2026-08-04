export default function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="container" style={{ padding: '0', maxWidth: '1200px' }}>
      <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" />
          <div style={{ color: 'var(--text-secondary)' }}>{label}</div>
        </div>
      </div>
    </div>
  );
}
