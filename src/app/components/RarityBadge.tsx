import { getRarity, RARITY_EMOJI, RARITY_LABEL } from '@/lib/rarity';

export default function RarityBadge({ owners }: { owners: number | null | undefined }) {
  const rarity = getRarity(owners);
  const emoji = RARITY_EMOJI[rarity];
  if (!emoji) return null;

  return (
    <div
      style={{ position: 'absolute', bottom: '8px', right: '8px', fontSize: '1.2rem', zIndex: 10, filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.8))' }}
      title={`${RARITY_LABEL[rarity]} (${owners} owners)`}
    >
      {emoji}
    </div>
  );
}
