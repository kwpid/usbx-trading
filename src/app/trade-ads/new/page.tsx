import Link from 'next/link';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { getTradeAdCooldownRemaining } from '../actions';
import TradeAdBuilder from '../TradeAdBuilder';

export default async function NewTradeAdPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="card" style={{ padding: '2rem', maxWidth: '500px', margin: '3rem auto', textAlign: 'center' }}>
        <p style={{ marginBottom: '1rem' }}>You need to be logged in to post a trade ad.</p>
        <Link href="/account" className="btn btn-primary">Log In</Link>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_verified')
    .eq('usbx_user_id', session.usbxUserId)
    .maybeSingle();

  if (!profile?.is_verified) {
    return (
      <div className="card" style={{ padding: '2rem', maxWidth: '500px', margin: '3rem auto', textAlign: 'center' }}>
        <p style={{ marginBottom: '1rem' }}>You need a verified USBX account to post a trade ad — this lets us show your real inventory to offer from.</p>
        <Link href="/account" className="btn btn-primary">Verify Account</Link>
      </div>
    );
  }

  const cooldownRemaining = await getTradeAdCooldownRemaining();

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Post a Trade Ad</h1>
      <TradeAdBuilder initialCooldownMinutes={cooldownRemaining} />
    </div>
  );
}
