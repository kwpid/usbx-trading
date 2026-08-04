import { requireAdmin } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import SyncItemsPanel from './SyncItemsPanel';
import MaintenanceTogglePanel from './MaintenanceTogglePanel';

export default async function SyncItemsPage() {
  const admin = await requireAdmin();

  if (!admin) {
    return (
      <div className="card" style={{ padding: '2rem', maxWidth: '500px', margin: '3rem auto', textAlign: 'center' }}>
        <p>Admins only.</p>
      </div>
    );
  }

  const { data: settings } = await supabase
    .from('site_settings')
    .select('maintenance_mode')
    .eq('id', 1)
    .maybeSingle();

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', paddingTop: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Sync Marketplace Items</h1>
      <MaintenanceTogglePanel initialEnabled={Boolean(settings?.maintenance_mode)} />
      <SyncItemsPanel />
    </div>
  );
}
