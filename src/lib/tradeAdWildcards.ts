// Rolimons-style "wildcard" request categories — a request slot can be a
// specific item OR one of these broader asks, since a trader is often happy
// with "anything rare" rather than one exact item. "Projecteds" mirrors the
// site's own /projected-items page (items expected to become limited/valuable
// soon); "Wishlist" mirrors a trader's own player-profile wishlist. Scrips
// and Tokens are the site's own two currencies (see src/lib/currency.ts) —
// used here instead of Rolimons' "Robux" since USBX doesn't have that.
export type WildcardTag =
  | 'any'
  | 'demand'
  | 'rares'
  | 'rap'
  | 'wishlist'
  | 'scrips'
  | 'tokens'
  | 'upgrade'
  | 'downgrade'
  | 'adds'
  | 'projecteds';

export const WILDCARD_TAGS: WildcardTag[] = [
  'any', 'demand', 'rares', 'rap', 'wishlist', 'scrips', 'tokens', 'upgrade', 'downgrade', 'adds', 'projecteds',
];

export const WILDCARD_INFO: Record<WildcardTag, { label: string; emoji: string; description: string; color: string }> = {
  any: { label: 'Any', emoji: '🔀', description: 'Open to anything.', color: '#22c55e' },
  demand: { label: 'Demand', emoji: '📈', description: 'Wants high-demand items.', color: '#a855f7' },
  rares: { label: 'Rares', emoji: '💎', description: 'Wants rare items (low owner count).', color: '#3b82f6' },
  rap: { label: 'RAP', emoji: '💰', description: 'Wants items worth their RAP, value not required.', color: '#f97316' },
  wishlist: { label: 'Wishlist', emoji: '⭐', description: 'Wants anything on their wishlist.', color: '#e2b955' },
  scrips: { label: 'Scrips', emoji: '💵', description: 'Open to a Scrips offer.', color: '#22c55e' },
  tokens: { label: 'Tokens', emoji: '🪙', description: 'Open to a Tokens offer.', color: '#22c55e' },
  upgrade: { label: 'Upgrade', emoji: '⬆️', description: 'Looking to upgrade to something worth more.', color: '#22c55e' },
  downgrade: { label: 'Downgrade', emoji: '⬇️', description: 'Open to downgrading for other value.', color: '#ef4444' },
  adds: { label: 'Adds', emoji: '➕', description: 'Wants extra items added to sweeten the deal.', color: '#ef4444' },
  projecteds: { label: 'Projecteds', emoji: '⚠️', description: 'Wants items projected to rise in value.', color: '#eab308' },
};
