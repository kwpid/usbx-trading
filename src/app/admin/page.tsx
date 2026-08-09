import { requireAdmin } from '@/lib/roles';
import AdminPageClient from './AdminPageClient';

export default async function AdminPage() {
  const admin = await requireAdmin();

  if (!admin) {
    return (
      <div className="card" style={{ padding: '2rem', maxWidth: '500px', margin: '3rem auto', textAlign: 'center' }}>
        <p>Admins only.</p>
      </div>
    );
  }

  return <AdminPageClient />;
}
