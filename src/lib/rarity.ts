export type Rarity = 'rare' | 'semi-rare' | 'common';

export function getRarity(owners: number | null | undefined): Rarity {
  if (owners === null || owners === undefined) return 'common';
  if (owners <= 30) return 'rare';
  if (owners <= 45) return 'semi-rare';
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
