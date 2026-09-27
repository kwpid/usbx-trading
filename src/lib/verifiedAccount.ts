import 'server-only';
import { supabase } from '@/lib/supabase';

// Shared by both sign-in paths (OAuth and the manual bio-code fallback) —
// whichever one proved identity, this is what "becoming a verified account"
// actually does: upsert the cached profile row and award the Verified badge
// once. is_verified is only ever set true from here; the leaderboard sync
// job upserts the same row but never touches it.
export async function finalizeVerifiedAccount(
  usbxUserId: number,
  username: string | null,
  avatarUrl: string | null
): Promise<{ error: string } | { success: true }> {
  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      {
        usbx_user_id: usbxUserId,
        usbx_username: username,
        usbx_avatar_url: avatarUrl,
        last_login_at: new Date().toISOString(),
        is_verified: true,
      },
      { onConflict: 'usbx_user_id' }
    );

  if (upsertError) {
    return { error: upsertError.message };
  }

  // No unique constraint on player_badges, so check first to avoid a
  // duplicate row on re-verification.
  const { data: existingBadge } = await supabase
    .from('player_badges')
    .select('badge_id')
    .eq('usbx_user_id', usbxUserId)
    .eq('badge_id', 'verified')
    .maybeSingle();
  if (!existingBadge) {
    const { error: badgeError } = await supabase
      .from('player_badges')
      .insert({ usbx_user_id: usbxUserId, badge_id: 'verified' });
    if (badgeError) console.error('Failed to award verified badge:', badgeError.message);
  }

  return { success: true };
}
