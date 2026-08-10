'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SearchTrigger from './SearchTrigger';

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const MarketIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
    <path d="M3 6h18"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);

const TradeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3L4 7l4 4"/>
    <path d="M4 7h16"/>
    <path d="M16 21l4-4-4-4"/>
    <path d="M20 17H4"/>
  </svg>
);

const PlayersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

export default function MobileBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact = false) => {
    if (exact || href === '/') return pathname === href;
    return pathname.startsWith(href);
  };

  const isPlayersActive =
    isActive('/player-lookup') ||
    isActive('/player/') ||
    isActive('/leaderboards');

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <Link href="/" className={`mobile-tab${isActive('/') ? ' active' : ''}`}>
        <HomeIcon />
        <span>Home</span>
      </Link>

      <Link href="/market" className={`mobile-tab${isActive('/market') ? ' active' : ''}`}>
        <MarketIcon />
        <span>Market</span>
      </Link>

      <Link href="/trade-ads" className={`mobile-tab${isActive('/trade-ads') ? ' active' : ''}`}>
        <TradeIcon />
        <span>Trading</span>
      </Link>

      <Link href="/player-lookup" className={`mobile-tab${isPlayersActive ? ' active' : ''}`}>
        <PlayersIcon />
        <span>Players</span>
      </Link>

      {/* Reuse existing SearchTrigger — styles are overridden to match the tab bar */}
      <SearchTrigger />
    </nav>
  );
}
