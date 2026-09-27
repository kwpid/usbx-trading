import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import VerificationPanel from './VerificationPanel';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'That sign-in attempt expired or was tampered with. Please try again.',
  oauth_failed: 'Untitled Sandbox sign-in failed. Please try again, or verify manually below.',
  rate_limited: 'Too many sign-in attempts. Please wait a few minutes and try again.',
  access_denied: 'Sign-in was cancelled.',
};

export default async function AccountPage(props: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();

  if (session) {
    redirect(`/player/${session.usbxUserId}`);
  }

  const searchParams = await props.searchParams;
  const errorMessage = searchParams.error
    ? ERROR_MESSAGES[searchParams.error] || 'Something went wrong signing in. Please try again.'
    : null;

  return (
    <div className="card" style={{ padding: '2rem', maxWidth: '500px', margin: '3rem auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Sign in to usbx.trade</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Sign in with your Untitled Sandbox account to link your profile, no code to paste anywhere.
      </p>

      {errorMessage && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px', fontSize: '0.9rem' }}>
          {errorMessage}
        </div>
      )}

      <a
        href="/api/auth/login"
        className="btn btn-primary"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0.85rem', fontSize: '1rem', textDecoration: 'none' }}
      >
        Sign in with Untitled Sandbox
      </a>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
        By signing in, you agree to our <a href="/terms" style={{ color: 'var(--accent-color)' }}>Terms of Service</a>.
      </p>

      <details style={{ marginTop: '1.75rem' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Having trouble? Verify manually instead
        </summary>
        <div style={{ marginTop: '1rem' }}>
          <VerificationPanel />
        </div>
      </details>
    </div>
  );
}
