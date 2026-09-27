import { NextRequest, NextResponse } from 'next/server';
import { createOAuthState } from '@/lib/session';
import { generatePkce, generateState, buildAuthorizeUrl } from '@/lib/usbxOAuth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const allowed = await checkRateLimit(`oauth-login:${ip}`, 600, 10);
  if (!allowed) {
    return NextResponse.redirect(new URL('/account?error=rate_limited', request.url));
  }

  const state = generateState();
  const { verifier, challenge } = generatePkce();
  const redirectUri = `${request.nextUrl.origin}/api/auth/callback`;

  await createOAuthState({ state, codeVerifier: verifier, redirectUri });

  const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge: challenge, redirectUri });
  return NextResponse.redirect(authorizeUrl);
}
