import { NextRequest, NextResponse } from 'next/server';
import { createSession, getOAuthState, clearOAuthState } from '@/lib/session';
import { exchangeCodeForToken, fetchOAuthUserinfo } from '@/lib/usbxOAuth';
import { resolveUsbxAssetUrl } from '@/lib/usbxAssets';
import { finalizeVerifiedAccount } from '@/lib/verifiedAccount';
import { revalidatePath } from 'next/cache';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const oauthError = params.get('error');
  const code = params.get('code');
  const state = params.get('state');

  const pending = await getOAuthState();
  await clearOAuthState();

  if (oauthError) {
    return NextResponse.redirect(new URL(`/account?error=${encodeURIComponent(oauthError)}`, request.url));
  }
  if (!pending || !code || !state || state !== pending.state) {
    return NextResponse.redirect(new URL('/account?error=invalid_state', request.url));
  }

  try {
    const tokens = await exchangeCodeForToken({
      code,
      redirectUri: pending.redirectUri,
      codeVerifier: pending.codeVerifier,
    });

    const userinfo = await fetchOAuthUserinfo(tokens.access_token);
    const usbxUserId = Number(userinfo.sub);
    if (!usbxUserId || Number.isNaN(usbxUserId)) {
      throw new Error('USBX did not return a usable user id.');
    }

    const username = userinfo.preferred_username || null;
    const avatarUrl = resolveUsbxAssetUrl(userinfo.picture || null);

    const result = await finalizeVerifiedAccount(usbxUserId, username, avatarUrl);
    if ('error' in result) {
      return NextResponse.redirect(new URL(`/account?error=${encodeURIComponent(result.error)}`, request.url));
    }

    await createSession(usbxUserId);
    revalidatePath('/account');
  } catch (err) {
    console.error('OAuth callback failed:', err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL('/account?error=oauth_failed', request.url));
  }

  return NextResponse.redirect(new URL('/account', request.url));
}
