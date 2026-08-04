import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

const SESSION_COOKIE = 'usbx_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const PENDING_COOKIE = 'usbx_pending_verification';
const PENDING_DURATION_MS = 10 * 60 * 1000; // 10 minutes

type SessionPayload = {
  usbxUserId: number;
};

type PendingPayload = {
  usbxUserId: number;
  code: string;
};

export async function createSession(usbxUserId: number) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await new SignJWT({ usbxUserId } satisfies SessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, encodedKey, { algorithms: ['HS256'] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Short-lived cookie holding the in-progress verification attempt (profile
// id + generated phrase), so we don't need a DB row for unverified attempts.
export async function createPendingVerification(usbxUserId: number, code: string) {
  const expiresAt = new Date(Date.now() + PENDING_DURATION_MS);
  const token = await new SignJWT({ usbxUserId, code } satisfies PendingPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey);

  const cookieStore = await cookies();
  cookieStore.set(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

export async function getPendingVerification(): Promise<PendingPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });
    return payload as unknown as PendingPayload;
  } catch {
    return null;
  }
}

export async function clearPendingVerification() {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_COOKIE);
}
