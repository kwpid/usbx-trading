import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchSerialLifecycle, UsbxLifecycleEvent } from "@/lib/usbxApi";
import { resolveUsbxAssetUrl } from "@/lib/usbxAssets";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

function timeAgo(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const diff = Date.now() - new Date(dateString).getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m} month${m > 1 ? 's' : ''} ago`;
  const y = Math.floor(d / 365);
  return `${y} year${y > 1 ? 's' : ''} ago`;
}

function getEventColor(type: string) {
  switch (type.toUpperCase()) {
    case 'CREATED': return 'var(--text-secondary)';
    case 'TRADED': return '#9b59b6';
    case 'PURCHASED': return 'var(--success-color)';
    case 'SOLD': return 'var(--rare-color)';
    default: return 'var(--text-secondary)';
  }
}

function getEventIcon(type: string) {
  switch (type.toUpperCase()) {
    case 'CREATED': return '✨';
    case 'TRADED': return '🔄';
    case 'PURCHASED': return '🛒';
    case 'SOLD': return '💰';
    default: return '📦';
  }
}

export default async function SerialLifecyclePage(props: { params: Promise<{ serial_id: string }> }) {
  const params = await props.params;
  const serialId = params.serial_id;

  let events: UsbxLifecycleEvent[] = [];
  try {
    events = await fetchSerialLifecycle(serialId);
  } catch (err) {
    console.error('Failed to load serial lifecycle:', err instanceof Error ? err.message : err);
    notFound();
  }

  if (events.length === 0) {
    return (
      <div className="container" style={{ maxWidth: '800px', marginTop: '2rem' }}>
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No lifecycle events found for this serial ID.
        </div>
      </div>
    );
  }

  // The lifecycle array is chronological, earliest -> latest.
  // We want to show earliest at the bottom and latest at the top, or vice versa?
  // Usually, a timeline shows the newest events at the top. Let's reverse it.
  const timeline = [...events].reverse();

  // The lifecycle API's inline fromUser/toUser.profile.headshotUrl is
  // unreliable (often missing), so cross-reference our own synced profiles
  // table for a real avatar per user instead.
  const userIds = [
    ...new Set(
      events
        .flatMap((e) => [e.fromUser?.id, e.toUser?.id])
        .filter((id): id is number => id != null)
    ),
  ];

  let avatarByUserId = new Map<number, string | null>();
  if (userIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('usbx_user_id, usbx_avatar_url')
      .in('usbx_user_id', userIds);
    avatarByUserId = new Map((data || []).map((p) => [p.usbx_user_id, p.usbx_avatar_url]));
  }

  function avatarFor(user: { id: number; profile?: { headshotUrl: string | null } } | null): string | null {
    if (!user) return null;
    return avatarByUserId.get(user.id) || resolveUsbxAssetUrl(user.profile?.headshotUrl) || null;
  }

  return (
    <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>UAID #{serialId}</h1>
        <div style={{ color: 'var(--accent-color)', fontSize: '1.1rem' }}>Ownership History</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
        {/* Vertical line connecting the timeline */}
        <div style={{ position: 'absolute', left: '24px', top: '20px', bottom: '20px', width: '2px', backgroundColor: 'var(--border-color)', zIndex: 0 }}></div>

        {timeline.map((event, index) => {
          const isLatest = index === 0;
          const isCreation = index === timeline.length - 1;

          return (
            <div key={index} style={{ display: 'flex', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
              
              {/* Timeline Marker */}
              <div style={{ 
                width: '50px', height: '50px', borderRadius: '25px', 
                backgroundColor: 'var(--bg-secondary)', border: `2px solid ${getEventColor(event.eventType)}`, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: '1.5rem', flexShrink: 0 
              }}>
                {getEventIcon(event.eventType)}
              </div>

              {/* Event Card */}
              <div className="card" style={{ flex: 1, padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ 
                      display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px', 
                      backgroundColor: `${getEventColor(event.eventType)}22`, 
                      color: getEventColor(event.eventType), fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.5rem' 
                    }}>
                      {event.eventType}
                    </span>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {timeAgo(event.createdAt)} ({new Date(event.createdAt).toLocaleString()})
                    </div>
                  </div>
                  {isLatest && <span style={{ color: 'var(--success-color)', fontWeight: 'bold', fontSize: '0.85rem' }}>CURRENT OWNER</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px' }}>
                  
                  {/* From User */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</div>
                    {event.fromUser ? (
                      <Link href={`/player/${event.fromUser.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '20px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)' }}>
                          {avatarFor(event.fromUser) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarFor(event.fromUser)!} alt={event.fromUser.username} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>?</div>
                          )}
                        </div>
                        <span style={{ fontWeight: 'bold' }}>{event.fromUser.username}</span>
                      </Link>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✨</div>
                        <span>System (Minted)</span>
                      </div>
                    )}
                  </div>

                  {/* To User */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</div>
                    {event.toUser ? (
                      <Link href={`/player/${event.toUser.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '20px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)' }}>
                          {avatarFor(event.toUser) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarFor(event.toUser)!} alt={event.toUser.username} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>?</div>
                          )}
                        </div>
                        <span style={{ fontWeight: 'bold' }}>{event.toUser.username}</span>
                      </Link>
                    ) : (
                      <div style={{ color: 'var(--text-secondary)' }}>Unknown</div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
