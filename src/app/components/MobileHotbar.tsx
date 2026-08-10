'use client';

import { useState, useEffect } from 'react';
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

type Menu = 'trading' | 'players' | null;

export default function MobileHotbar() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<Menu>(null);

  // Close menus when route changes
  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  const isActive = (href: string, exact = false) => {
    if (exact || href === '/') return pathname === href;
    return pathname.startsWith(href);
  };

  const isTradingActive =
    isActive('/item-value-changes') ||
    isActive('/recent-sales') ||
    isActive('/trade-calculator') ||
    isActive('/trade-ads') ||
    isActive('/projected-items') ||
    isActive('/badges');

  const isPlayersActive =
    isActive('/player-lookup') ||
    isActive('/player/') ||
    isActive('/leaderboards');

  const toggleMenu = (menu: Menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  return (
    <>
      {/* Invisible backdrop to close menus when clicking outside */}
      {openMenu && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 199 }} 
          onClick={() => setOpenMenu(null)}
        />
      )}

      <nav className="mobile-hotbar" aria-label="Mobile navigation">
        <Link href="/" className={`mobile-hotbar-tab${isActive('/') ? ' active' : ''}`}>
          <HomeIcon />
          <span>Home</span>
        </Link>

        <Link href="/market" className={`mobile-hotbar-tab${isActive('/market') ? ' active' : ''}`}>
          <MarketIcon />
          <span>Market</span>
        </Link>

        <div style={{ position: 'relative', display: 'flex', flex: 1 }}>
          <button 
            onClick={() => toggleMenu('trading')} 
            className={`mobile-hotbar-tab${isTradingActive ? ' active' : ''}`}
            style={{ width: '100%' }}
          >
            <TradeIcon />
            <span>Trading</span>
          </button>
          
          {openMenu === 'trading' && (
            <div className="mobile-dropup-menu">
              <Link href="/item-value-changes" className="mobile-dropup-item">Value Changes</Link>
              <Link href="/recent-sales" className="mobile-dropup-item">Recent Sales</Link>
              <Link href="/trade-calculator" className="mobile-dropup-item">Trade Calculator</Link>
              <Link href="/trade-ads" className="mobile-dropup-item">Trade Ads</Link>
              <Link href="/projected-items" className="mobile-dropup-item">Projected Items</Link>
              <Link href="/badges" className="mobile-dropup-item">Trade.Badges</Link>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', display: 'flex', flex: 1 }}>
          <button 
            onClick={() => toggleMenu('players')} 
            className={`mobile-hotbar-tab${isPlayersActive ? ' active' : ''}`}
            style={{ width: '100%' }}
          >
            <PlayersIcon />
            <span>Players</span>
          </button>

          {openMenu === 'players' && (
            <div className="mobile-dropup-menu">
              <Link href="/player-lookup" className="mobile-dropup-item">Player Lookup</Link>
              <Link href="/leaderboards" className="mobile-dropup-item">Leaderboards</Link>
            </div>
          )}
        </div>

        <div className="mobile-hotbar-tab">
          <SearchTrigger />
        </div>
      </nav>
    </>
  );
}
