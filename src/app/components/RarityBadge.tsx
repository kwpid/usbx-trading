import { getRarity, RARITY_EMOJI, RARITY_LABEL } from '@/lib/rarity';

// `copies` is TOTAL copies in circulation (items.copies_sold), not unique
// owner count — see the comment in lib/rarity.ts for why that distinction
// matters for the rarity tier itself.
export default function RarityBadge({ copies }: { copies: number | null | undefined }) {
  const rarity = getRarity(copies);
  const emoji = RARITY_EMOJI[rarity];
  if (!emoji) return null;

  return (
    <div
      style={{ position: 'absolute', bottom: '8px', right: '8px', fontSize: '1.2rem', zIndex: 10, filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.8))' }}
      title={`${RARITY_LABEL[rarity]} (${copies} copies)`}
    >
      {emoji}
    </div>
  );
}
