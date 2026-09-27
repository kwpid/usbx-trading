import { NextRequest, NextResponse } from 'next/server';
import { createOAuthState } from '@/lib/session';
import { generatePkce, generateState, buildAuthorizeUrl } from '@/lib/usbxOAuth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

// Fixed, not derived from request.nextUrl.origin — usbx.trade (apex)
// 308-redirects to www.usbx.trade at the Vercel domain level, so the origin
// a route handler actually sees depends on which host the visitor started
// from. Pinning this to the apex domain matches what's registered in the
// USBX developer dashboard and everywhere else this app names itself
// (sitemap, OG tags); the extra www redirect hop is transparent either way.
const PRODUCTION_REDIRECT_URI = 'https://usbx.trade/api/auth/callback';

export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const allowed = await checkRateLimit(`oauth-login:${ip}`, 600, 10);
  if (!allowed) {
    return NextResponse.redirect(new URL('/account?error=rate_limited', request.url));
  }

  const state = generateState();
  const { verifier, challenge } = generatePkce();
  const isLocalhost = ['localhost', '127.0.0.1'].includes(request.nextUrl.hostname);
  const redirectUri = isLocalhost ? `${request.nextUrl.origin}/api/auth/callback` : PRODUCTION_REDIRECT_URI;

  await createOAuthState({ state, codeVerifier: verifier, redirectUri });

  const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge: challenge, redirectUri });
  return NextResponse.redirect(authorizeUrl);
}
