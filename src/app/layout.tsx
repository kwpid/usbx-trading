import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "usbx.trade | Trading & Items",
  description: "Track and trade exclusive items",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="navbar" style={{ padding: '1rem 2rem', borderBottom: 'none', backgroundColor: '#212620', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', justifyContent: 'center', position: 'relative' }}>
          <Link href="/" className="nav-brand" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', textDecoration: 'none', position: 'absolute', left: '2rem' }}>
            <span style={{ color: '#e2b955' }}>usbx</span><span style={{ color: '#8353e4' }}>.</span>trade
          </Link>
          <div className="nav-links" style={{ gap: '2.5rem', display: 'flex', justifyContent: 'center' }}>
            <div className="nav-dropdown-container">
              <div className="nav-icon-link" style={{ cursor: 'pointer' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
                <span>Trading</span>
              </div>
              <div className="nav-dropdown-menu">
                <Link href="/item-value-changes" className="nav-dropdown-item">Value Changes</Link>
                <Link href="/recent-sales" className="nav-dropdown-item">Recent Sales</Link>
                <Link href="/trade-calculator" className="nav-dropdown-item">Trade Calculator</Link>
                <Link href="/projected-items" className="nav-dropdown-item">Projected Items</Link>
              </div>
            </div>
            
            <Link href="/market" className="nav-icon-link">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <span>Market</span>
            </Link>
            
            <div className="nav-dropdown-container">
              <div className="nav-icon-link" style={{ cursor: 'pointer' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>Players</span>
              </div>
              <div className="nav-dropdown-menu">
                <Link href="/player-lookup" className="nav-dropdown-item">Player Lookup</Link>
                <Link href="/leaderboards" className="nav-dropdown-item">Leaderboards</Link>
              </div>
            </div>
            <Link href="/deals" className="nav-icon-link">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              <span>Deals</span>
            </Link>
            <Link href="#" className="nav-icon-link">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span>Search</span>
            </Link>
            <Link href="/account" className="nav-icon-link">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>Account</span>
            </Link>
            <Link href="/admin" className="nav-icon-link">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              <span>More</span>
            </Link>
          </div>
        </nav>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
