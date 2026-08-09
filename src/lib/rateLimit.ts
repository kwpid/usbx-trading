import 'server-only';
import { headers } from 'next/headers';
import { supabase } from './supabase';

// Backed by a Postgres function (check_rate_limit) that does the read +
// increment atomically in one statement, so concurrent requests from the
// same key can't race past the limit the way a read-then-write from here
// could. Fails open (allows the request) if the RPC itself errors — a
// rate-limiter outage shouldn't be able to take down the feature it guards.
export async function checkRateLimit(key: string, windowSeconds: number, maxCount: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max_count: maxCount,
  });
  if (error) {
    console.error('Rate limit check failed, allowing request:', error.message);
    return true;
  }
  return Boolean(data);
}

// Vercel (and our own dev server behind nothing) sets x-forwarded-for on
// every request; first entry is the original client. Falls back to a
// constant so local dev without the header still shares one bucket instead
// of throwing.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('x-real-ip') || 'unknown';
}
