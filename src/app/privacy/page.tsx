export const metadata = {
  title: 'Privacy Policy | usbx.trade',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{title}</h2>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1rem 0 3rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Last updated: October 19, 2026</p>

      <div className="page-surface">
        <Section title="1. What we collect">
          <p>
            If you sign in with your Untitled Sandbox account, we store your USBX user ID, username, and
            avatar URL. That&apos;s it, we don&apos;t collect your email, password, or any payment information,
            and USBX&apos;s sign-in flow never shares those with us in the first place.
          </p>
          <p>
            If you use the manual bio-code verification instead of signing in, we only store the same three
            things once verification succeeds, plus a temporary code used to check you.
          </p>
        </Section>

        <Section title="2. Data pulled from USBX">
          <p>
            Item prices, RAP, ownership, trade history, and player inventories are pulled from USBX&apos;s
            public APIs and stored in our own database so pages load fast. This data belongs to whoever owns it
            on USBX, we&apos;re just mirroring and displaying it.
          </p>
        </Section>

        <Section title="3. Inventory privacy">
          <p>
            If your USBX account&apos;s privacy settings mark your inventory private, we won&apos;t show it on
            your profile page, even if we have older synced data for it. This is checked live every time your
            profile is viewed, not just once. You can choose to bypass this yourself from account settings if
            you want your inventory shown regardless.
          </p>
        </Section>

        <Section title="4. Cookies and sessions">
          <p>
            We use a single session cookie to keep you signed in. It only holds your USBX user ID in a signed
            token, nothing else gets stored in your browser. We don&apos;t use advertising or tracking cookies.
          </p>
        </Section>

        <Section title="5. Who sees your data">
          <p>
            Your username, avatar, inventory (unless private), trade ads, and wishlist are public on this site
            the same way they&apos;d be visible to anyone on USBX. We don&apos;t sell or share your data with
            third parties.
          </p>
        </Section>

        <Section title="6. Data removal">
          <p>
            Want your account data removed from usbx.trade? Reach out through the site&apos;s account or
            support channels and we&apos;ll delete your stored profile, wishlist, and trade ad data. Historical
            price and ownership data for items isn&apos;t tied to you personally and stays in place.
          </p>
        </Section>

        <Section title="7. Changes">
          <p>
            This policy may change as the site evolves. Continuing to use the site after a change means you
            accept the updated policy.
          </p>
        </Section>
      </div>
    </div>
  );
}
