import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import VerificationPanel from './VerificationPanel';

export default async function AccountPage() {
  const session = await getSession();

  if (session) {
    redirect(`/player/${session.usbxUserId}`);
  }

  return (
    <div className="card" style={{ padding: '2rem', maxWidth: '500px', margin: '3rem auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Verify your USBX account</h1>
      <VerificationPanel />
    </div>
  );
}
