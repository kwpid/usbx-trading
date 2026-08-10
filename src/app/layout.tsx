import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import SearchTrigger from "./components/SearchTrigger";
import AdminNavLink from "./components/AdminNavLink";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "usbx.trade | Trading & Items",
  description: "Track and trade exclusive items",
  icons: {
    icon: "/bg-pattern.png",
    shortcut: "/bg-pattern.png",
    apple: "/bg-pattern.png",
  },
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
                <Link href="/trade-ads" className="nav-dropdown-item">Trade Ads</Link>
                <Link href="/projected-items" className="nav-dropdown-item">Projected Items</Link>
                <Link href="/badges" className="nav-dropdown-item">Trade.Badges</Link>
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
            <SearchTrigger />
            <Link href="/account" className="nav-icon-link">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>Account</span>
            </Link>
            <AdminNavLink />
          </div>
        </nav>
        <main className="container">
          {children}
        </main>
        <footer style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <Link href="/terms" style={{ color: 'var(--text-secondary)' }}>Terms of Service</Link>
          <span style={{ margin: '0 0.5rem' }}>·</span>
          <span>Not affiliated with USBX or Untitled Sandbox.</span>
        </footer>
      </body>
    </html>
  );
}
