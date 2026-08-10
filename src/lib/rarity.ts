export type Rarity = 'rare' | 'semi-rare' | 'common';

// Rarity is based on TOTAL copies in circulation (copies_sold), not unique
// owner count — an item with 41 total copies split across 30 owners (some
// owners holding more than one) is not as rare as an item with 30 total
// copies across 30 owners, even though both show "30" if you look at
// unique owners instead.
export function getRarity(copies: number | null | undefined): Rarity {
  if (copies === null || copies === undefined) return 'common';
  if (copies <= 30) return 'rare';
  if (copies <= 45) return 'semi-rare';
  return 'common';
}

export const RARITY_EMOJI: Record<Rarity, string | null> = {
  rare: '💎',
  'semi-rare': '✨',
  common: null,
};

export const RARITY_LABEL: Record<Rarity, string | null> = {
  rare: 'Rare',
  'semi-rare': 'Semi-Rare',
  common: null,
};
