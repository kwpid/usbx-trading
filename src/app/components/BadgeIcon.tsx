import { BadgeDef } from '@/lib/badges';

export default function BadgeIcon({ badge, size = 64 }: { badge: BadgeDef; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={badge.icon}
      alt={badge.name}
      title={`${badge.name} — ${badge.description}`}
      style={{ width: size, height: size, flexShrink: 0, objectFit: 'contain' }}
    />
  );
}
