import { requireAdmin } from '@/lib/roles';
import ScrapeItemForm from './ScrapeItemForm';

export default async function ScrapeItemPage() {
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
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Add Limited Item</h1>
      <ScrapeItemForm />
    </div>
  );
}
