export const metadata = {
  title: 'Terms of Service | usbx.trade',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{title}</h2>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1rem 0 3rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Last updated: August 9, 2026</p>

      <div className="page-surface">
        <Section title="1. What usbx.trade is">
          <p>
            usbx.trade is an independent, fan-made tracking and reference tool for items in the USBX game
            (Untitled Sandbox). We are not affiliated with, endorsed by, or operated by USBX or Untitled
            Sandbox. All item names, images, and in-game data belong to their respective owners. We display
            them for informational purposes only.
          </p>
          <p>
            No trading, buying, or selling of any in-game item, currency, or real-world payment happens on
            usbx.trade. All actual trades take place on USBX itself. Our Trade Calculator and Deals pages are
            reference tools only, not a marketplace.
          </p>
        </Section>

        <Section title="2. Data accuracy">
          <p>
            Prices, RAP, values, ownership counts, and inventory data are pulled from USBX&apos;s public APIs
            and refreshed periodically by background jobs. This data can be delayed, incomplete, or sometimes
            wrong, including from bugs on our end. Don&apos;t treat any figure on this site as guaranteed
            accurate at the moment you view it. Always check USBX itself before making a trading decision.
          </p>
        </Section>

        <Section title="3. Account linking and verification">
          <p>
            Creating an account on usbx.trade links your session to a USBX profile you prove ownership of by
            placing a one-time code in that profile&apos;s bio. Completing verification confirms the linked
            USBX profile is yours, and means you agree to us storing your USBX user ID, username, and avatar
            URL to run the site (showing your profile, wishlist, and inventory pages).
          </p>
          <p>
            We don&apos;t collect passwords, email addresses, or payment information. There&apos;s nothing to
            enter on usbx.trade beyond the verification code itself.
          </p>
        </Section>

        <Section title="4. Inventory and privacy">
          <p>
            If your USBX privacy settings mark your inventory private, usbx.trade won&apos;t display it, even
            if we previously synced ownership data for items you own. We check your live privacy setting on
            every profile visit.
          </p>
        </Section>

        <Section title="5. Acceptable use">
          <p>
            Don&apos;t abuse, scrape at excessive volume, or try to get around rate limits on this site or the
            USBX APIs it relies on. Don&apos;t use the verification flow to impersonate a profile you don&apos;t
            control. We can suspend access for accounts or IPs that abuse the service.
          </p>
        </Section>

        <Section title="6. No warranty">
          <p>
            usbx.trade is provided as is, with no warranty of any kind. We&apos;re not responsible for trading
            decisions, losses, or disputes on USBX or elsewhere based on information shown here.
          </p>
        </Section>

        <Section title="7. Changes">
          <p>
            These terms may change as the site evolves. Continuing to use the site after a change means you
            accept the updated terms.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            Questions or data removal requests can be sent through the site&apos;s account or support
            channels.
          </p>
        </Section>
      </div>
    </div>
  );
}
