import { requireAdmin } from '@/lib/roles';
import SyncItemsPanel from './SyncItemsPanel';

export default async function SyncItemsPage() {
  const admin = await requireAdmin();

  if (!admin) {
    return (
      <div className="card" style={{ padding: '2rem', maxWidth: '500px', margin: '3rem auto', textAlign: 'center' }}>
        <p>Admins only.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', paddingTop: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Sync Marketplace Items</h1>
      <SyncItemsPanel />
    </div>
  );
}
