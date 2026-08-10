import Link from 'next/link';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import BypassPrivacyToggle from './BypassPrivacyToggle';

export default async function AccountSettingsPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="card" style={{ padding: '2rem', maxWidth: '500px', margin: '3rem auto', textAlign: 'center' }}>
        <p style={{ marginBottom: '1rem' }}>You need to be logged in to view account settings.</p>
        <Link href="/account" className="btn btn-primary">Log In</Link>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('bypass_privacy_lock')
    .eq('usbx_user_id', session.usbxUserId)
    .maybeSingle();

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Account Settings</h1>
        <Link href={`/player/${session.usbxUserId}`} className="btn btn-secondary">Back to Profile</Link>
      </div>

      <BypassPrivacyToggle initialEnabled={Boolean(profile?.bypass_privacy_lock)} />
    </div>
  );
}
