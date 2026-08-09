import Link from 'next/link';
import { getCurrentProfile } from '@/lib/roles';

// Server Component so the check happens with the request's session cookie —
// keeps the "More" (admin dashboard) link out of the DOM entirely for
// non-admins rather than just hiding it with CSS, since the goal is that
// non-admins don't even know it's there, not just that they can't click it.
export default async function AdminNavLink() {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') return null;

  return (
    <Link href="/admin" className="nav-icon-link">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      <span>More</span>
    </Link>
  );
}
