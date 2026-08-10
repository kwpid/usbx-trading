'use server'

import { supabase } from '@/lib/supabase';
import { createSession, deleteSession, createPendingVerification, getPendingVerification, clearPendingVerification } from '@/lib/session';
import { fetchProfileSummary } from '@/lib/usbxApi';
import { resolveUsbxAssetUrl } from '@/lib/usbxAssets';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

const USBX_PROFILE_URL_REGEX = /^https:\/\/beta\.untitled-sandbox\.com\/user\/profile\/(\d+)\/?$/;

// Step 1: visitor submits their USBX profile URL. We fetch their real
// profile summary (username/avatar/bio) via the API to confirm the account
// exists and show them who they're about to verify as, then generate a
// phrase to paste into their profile description. Checking the `bio` field
// specifically (not wall comments or any other page content) means someone
// else posting text on the profile can't fake a match — only the person who
// can actually edit that profile's description can pass this.
//
// `honeypot` is a hidden form field real users never see or fill; a bot
// that blindly fills every input in the form will populate it, so a
// non-empty value is treated as spam and rejected without doing any work
// (no USBX fetch, no pending-verification cookie).
export async function startVerification(profileUrl: string, honeypot?: string) {
  if (honeypot) {
    return { error: 'Verification failed. Please try again.' };
  }

  const ip = await getClientIp();
  const allowed = await checkRateLimit(`verify-start:${ip}`, 600, 5);
  if (!allowed) {
    return { error: 'Too many verification attempts. Please wait a few minutes and try again.' };
  }

  const match = profileUrl.trim().match(USBX_PROFILE_URL_REGEX);
  if (!match) {
    return { error: 'That doesn\'t look like a valid USBX profile URL. It should look like https://beta.untitled-sandbox.com/user/profile/15' };
  }
  const usbxUserId = parseInt(match[1], 10);

  let summary;
  try {
    summary = await fetchProfileSummary(usbxUserId);
  } catch (err: any) {
    return { error: err.message || 'Could not find that USBX profile.' };
  }

  const code = `usbx-verify-${crypto.randomBytes(4).toString('hex')}`;
  await createPendingVerification(usbxUserId, code);

  return {
    success: true,
    code,
    usbxUserId,
    avatarUrl: resolveUsbxAssetUrl(summary.user.profile.headshotUrl || summary.user.profile.avatarUrl),
    username: summary.user.username || null,
  };
}

// Step 2: visitor has (hopefully) pasted the phrase into their profile
// description. Re-fetch it fresh, check for it, and if found log them in
// (this doubles as both signup and login for returning players).
export async function completeVerification() {
  const ip = await getClientIp();
  const allowed = await checkRateLimit(`verify-complete:${ip}`, 600, 10);
  if (!allowed) {
    return { error: 'Too many verification attempts. Please wait a few minutes and try again.' };
  }

  const pending = await getPendingVerification();
  if (!pending) {
    return { error: 'Start verification first. The code expires after 10 minutes.' };
  }

  let summary;
  try {
    summary = await fetchProfileSummary(pending.usbxUserId);
  } catch (err: any) {
    return { error: err.message || 'Could not reach that USBX profile.' };
  }

  const bio = summary.user.profile.bio || '';
  if (!bio.includes(pending.code)) {
    return { error: 'Verification code not found on that profile. Make sure you saved it to your description at /user/settings and try again.' };
  }

  const username = summary.user.username || null;
  const avatarUrl = resolveUsbxAssetUrl(summary.user.profile.headshotUrl || summary.user.profile.avatarUrl);

  // is_verified is only ever set true here, on a successful bio-code check.
  // The same `profiles` row also gets upserted by the admin player-sync job
  // (to cache username/avatar for the leaderboard) for players who never
  // verified anything — that path never touches is_verified, so it can't
  // accidentally flip someone into "verified" just by existing in that table.
  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      {
        usbx_user_id: pending.usbxUserId,
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

  // Award the Verified badge once, the moment verification succeeds. There's
  // no unique constraint on player_badges to lean on (same as the rest of
  // the badge-awarding code), so check first rather than risk a duplicate
  // row every time an already-verified account re-verifies.
  const { data: existingBadge } = await supabase
    .from('player_badges')
    .select('badge_id')
    .eq('usbx_user_id', pending.usbxUserId)
    .eq('badge_id', 'verified')
    .maybeSingle();
  if (!existingBadge) {
    const { error: badgeError } = await supabase
      .from('player_badges')
      .insert({ usbx_user_id: pending.usbxUserId, badge_id: 'verified' });
    if (badgeError) console.error('Failed to award verified badge:', badgeError.message);
  }

  await clearPendingVerification();
  await createSession(pending.usbxUserId);

  revalidatePath('/account');
  return { success: true, usbxUserId: pending.usbxUserId, username, avatarUrl };
}

export async function logout() {
  await deleteSession();
  redirect('/account');
}
