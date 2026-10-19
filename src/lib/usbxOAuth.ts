import 'server-only';
import crypto from 'crypto';
import { resolveUsbxRequest } from '@/lib/usbxApi';

const OAUTH_ORIGIN = 'https://untitled-sandbox.com';
// This one's a real browser navigation (the user's own browser hitting
// USBX directly), not a server-side fetch from Vercel — no proxy needed.
const AUTHORIZE_URL = `${OAUTH_ORIGIN}/oauth/authorize`;
// These two ARE server-side fetches from our route handlers, so they go
// through resolveUsbxRequest like every other USBX call in this app —
// Vercel's IP range gets Cloudflare-blocked otherwise (an HTML challenge
// page back instead of JSON).
const TOKEN_PATH = '/api/oauth/token';
// Not /api/oauth/userinfo — that path returns a plain-text cookie-session
// error ("You are not logged in") instead of a proper OAuth bearer-token
// response. /api/v1/userinfo is the one that actually follows the spec.
const USERINFO_PATH = '/api/v1/userinfo';

// Public client (PKCE, no client secret) — this app was registered without
// one, and the token endpoint accepts client_id in the body for that case.
const CLIENT_ID = process.env.USBX_OAUTH_CLIENT_ID || '';

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return base64url(crypto.randomBytes(16));
}

export function buildAuthorizeUrl(opts: { state: string; codeChallenge: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: opts.redirectUri,
    scope: 'identity',
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export class UsbxOAuthError extends Error {}

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
};

export async function exchangeCodeForToken(opts: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const { url, headers } = resolveUsbxRequest(TOKEN_PATH);
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: opts.code,
      redirect_uri: opts.redirectUri,
      client_id: CLIENT_ID,
      code_verifier: opts.codeVerifier,
    }),
    cache: 'no-store',
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UsbxOAuthError(`Non-JSON response from token endpoint (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new UsbxOAuthError(json?.error_description || json?.error || 'Token exchange failed.');
  }
  return json;
}

export type UsbxUserinfo = {
  sub: string;
  preferred_username?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
};

export async function fetchOAuthUserinfo(accessToken: string): Promise<UsbxUserinfo> {
  const { url, headers } = resolveUsbxRequest(USERINFO_PATH);
  const res = await fetch(url, {
    headers: { ...headers, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UsbxOAuthError(`Non-JSON response from userinfo endpoint (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new UsbxOAuthError(json?.error_description || json?.error || 'Could not fetch userinfo.');
  }
  return json;
}
