import { getRarity } from './rarity';

// Rarity tier color — used for the colored strip on /badges cards. Badge
// icons themselves are plain images with no CSS ring; the artwork already
// bakes its own tier styling in.
export type BadgeTier = 'grey' | 'green' | 'blue' | 'orange' | 'red' | 'purple';

export const BADGE_TIER_COLOR: Record<BadgeTier, string> = {
  grey: '#9ca3af',
  green: '#22c55e',
  blue: '#3b82f6',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#a855f7',
};

export type BadgeCategory = 'Values' | 'Other' | 'Items' | 'Community';

// Minimal shape a badge check needs — matches the InventoryItem shape the
// player page already builds, so no extra data fetching is required to
// evaluate eligibility.
export type BadgeCollectible = {
  name: string;
  availableOwners: number | null | undefined;
  copies: { serialNumber: string }[];
};

export type BadgeContext = {
  usbxUserId: number;
  totalValue: number;
  collectibles: BadgeCollectible[];
};

export type BadgeDef = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  category: BadgeCategory;
  check: (ctx: BadgeContext) => boolean;
};

function rareCount(ctx: BadgeContext): number {
  return ctx.collectibles.filter((c) => getRarity(c.availableOwners) === 'rare').length;
}

function ownsFamily(ctx: BadgeContext, needle: string): boolean {
  const n = needle.toLowerCase();
  return ctx.collectibles.some((c) => c.name.toLowerCase().includes(n));
}

// The full badge roster. Add more entries here as new badges are designed —
// no schema changes needed, just drop the icon in public/badges/ and add a
// check() here.
export const BADGES: BadgeDef[] = [
  {
    id: 'value_100k',
    name: '100K Value',
    description: 'Reach a total collection value of 100,000+ scrips.',
    icon: '/badges/100k.png',
    tier: 'grey',
    category: 'Values',
    check: (ctx) => ctx.totalValue >= 100_000,
  },
  {
    id: 'value_500k',
    name: '500K Value',
    description: 'Reach a total collection value of 500,000+ scrips.',
    icon: '/badges/500k.png',
    tier: 'green',
    category: 'Values',
    check: (ctx) => ctx.totalValue >= 500_000,
  },
  {
    id: 'value_1m',
    name: '1M Value',
    description: 'Reach a total collection value of 1,000,000+ scrips.',
    icon: '/badges/1M.png',
    tier: 'blue',
    category: 'Values',
    check: (ctx) => ctx.totalValue >= 1_000_000,
  },
  {
    id: 'value_5m',
    name: '5M Value',
    description: 'Reach a total collection value of 5,000,000+ scrips.',
    icon: '/badges/5M.png',
    tier: 'orange',
    category: 'Values',
    check: (ctx) => ctx.totalValue >= 5_000_000,
  },
  {
    id: 'serial_1_owner',
    name: '#1 Serial Owner',
    description: 'Own a serial #1 copy of any limited.',
    icon: '/badges/number1.png',
    tier: 'blue',
    category: 'Other',
    // Serial numbers come back zero-padded (e.g. "0001"), so compare
    // numerically rather than against the literal string "1".
    check: (ctx) => ctx.collectibles.some((c) => c.copies.some((copy) => parseInt(copy.serialNumber, 10) === 1)),
  },
  {
    id: 'rare_owner',
    name: 'Rare Owner',
    description: 'Own at least one Rare limited (30 or fewer copies in circulation).',
    icon: '/badges/rare.png',
    tier: 'green',
    category: 'Other',
    check: (ctx) => rareCount(ctx) >= 1,
  },
  {
    id: 'rare_lover',
    name: 'Rare Lover',
    description: 'Own 3 or more different Rare limiteds.',
    icon: '/badges/rare3.png',
    tier: 'blue',
    category: 'Other',
    check: (ctx) => rareCount(ctx) >= 3,
  },
  {
    id: 'crown_collector',
    name: 'Royalty',
    description: 'Own any copy of a Crown item.',
    icon: '/badges/crown.png',
    tier: 'purple',
    category: 'Items',
    check: (ctx) => ownsFamily(ctx, 'crown'),
  },
  {
    id: 'crystal_collector',
    name: 'Crystal Keeper',
    description: 'Own any copy of a Crystalline Growth item.',
    icon: '/badges/crystal.png',
    tier: 'grey',
    category: 'Items',
    check: (ctx) => ownsFamily(ctx, 'crystalline growth'),
  },
  {
    id: 'gum_chewer',
    name: 'Gum Chewer',
    description: 'Own any copy of a Chewing Gum item.',
    icon: '/badges/gum.png',
    tier: 'grey',
    category: 'Items',
    check: (ctx) => ownsFamily(ctx, 'chewing gum'),
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Built usbx.trade.',
    icon: '/badges/developer.png',
    tier: 'purple',
    category: 'Community',
    check: (ctx) => ctx.usbxUserId === 15,
  },
  {
    id: 'value_mod',
    name: 'Value Mod',
    description: 'Helps keep item values accurate across the site.',
    icon: '/badges/value_mod.png',
    tier: 'blue',
    category: 'Community',
    // Manual-only — granted and revoked by an admin, never auto-awarded.
    check: () => false,
  },
  {
    id: 'verified',
    name: 'Verified',
    description: 'Completed USBX profile verification.',
    icon: '/badges/verified.png',
    tier: 'blue',
    category: 'Community',
    // Granted directly in completeVerification() at the moment verification
    // succeeds, not evaluated here — there's no inventory-shaped signal for
    // "verified" the way the rest of this file's checks work off.
    check: () => false,
  },
];

// Priority order for the single badge shown inline next to a username
// (profile header, leaderboard cards, search results) — highest first.
// Only ever one badge shows there at a time, unlike the full grid on
// /badges, so this picks which one wins.
export const INLINE_BADGE_PRIORITY = ['developer', 'value_mod', 'verified'];

export const BADGES_BY_ID = new Map(BADGES.map((b) => [b.id, b]));
