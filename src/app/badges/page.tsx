import { supabase } from "@/lib/supabase";
import { BADGES, BadgeCategory, BADGE_TIER_COLOR } from "@/lib/badges";
import BadgeIcon from "@/app/components/BadgeIcon";

export const revalidate = 60;

const CATEGORY_ORDER: BadgeCategory[] = ['Values', 'Other', 'Items', 'Community'];

export default async function BadgesPage() {
  let countsById = new Map<string, number>();
  try {
    const { data } = await supabase.from('player_badges').select('badge_id');
    for (const row of data || []) {
      countsById.set(row.badge_id, (countsById.get(row.badge_id) || 0) + 1);
    }
  } catch (err) {
    console.error('Failed to load badge counts:', err instanceof Error ? err.message : err);
  }

  return (
    <div className="container" style={{ padding: '0', maxWidth: '1000px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>
          <span style={{ color: '#e2b955' }}>Trade</span><span style={{ color: '#8353e4' }}>.</span>Badges
        </h1>
        <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.25rem' }}>
          Earned automatically from your inventory, just by visiting your profile
        </div>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const badges = BADGES.filter((b) => b.category === category);
        if (badges.length === 0) return null;

        return (
          <div key={category} style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>{category}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="card"
                  style={{ padding: '1.25rem', borderTop: `3px solid ${BADGE_TIER_COLOR[badge.tier]}` }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <BadgeIcon badge={badge} size={48} />
                    <div style={{ fontWeight: 700 }}>{badge.name}</div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{badge.description}</div>
                  <div style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }}>
                    {(countsById.get(badge.id) || 0).toLocaleString()} player{countsById.get(badge.id) === 1 ? '' : 's'} earned
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
