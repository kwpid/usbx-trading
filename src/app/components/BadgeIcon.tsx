// Only the display fields are needed here — accepting a Pick instead of the
// full BadgeDef means callers that fetched a badge through a server action
// (which can't serialize the `check` function across to a Client Component)
// can pass their stripped-down copy straight through without a cast.
type BadgeIconInfo = { icon: string; name: string; description: string };

export default function BadgeIcon({ badge, size = 64 }: { badge: BadgeIconInfo; size?: number }) {
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
