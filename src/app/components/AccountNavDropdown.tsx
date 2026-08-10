import Link from 'next/link';
import { getSession } from '@/lib/session';

const ACCOUNT_ICON = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

// Server Component so the dropdown only appears once we actually know
// there's a logged-in account to show Profile/Settings for — logged-out
// visitors just get the plain link straight to the verification flow.
export default async function AccountNavDropdown() {
  const session = await getSession();

  if (!session) {
    return (
      <Link href="/account" className="nav-icon-link">
        {ACCOUNT_ICON}
        <span>Account</span>
      </Link>
    );
  }

  return (
    <div className="nav-dropdown-container">
      <div className="nav-icon-link" style={{ cursor: 'pointer' }}>
        {ACCOUNT_ICON}
        <span>Account</span>
      </div>
      <div className="nav-dropdown-menu">
        <Link href={`/player/${session.usbxUserId}`} className="nav-dropdown-item">Profile</Link>
        <Link href="/account/settings" className="nav-dropdown-item">Settings</Link>
      </div>
    </div>
  );
}
