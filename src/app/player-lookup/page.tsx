import PlayerSearch from './PlayerSearch';

export default function PlayerLookupPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Player Lookup</h1>
      <PlayerSearch />
    </div>
  );
}
