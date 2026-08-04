import 'server-only';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';

export type Role = 'user' | 'mod' | 'admin';

export type CurrentProfile = {
  usbxUserId: number;
  username: string | null;
  avatarUrl: string | null;
  role: Role;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const session = await getSession();
  if (!session) return null;

  const { data } = await supabase
    .from('profiles')
    .select('usbx_user_id, usbx_username, usbx_avatar_url, role')
    .eq('usbx_user_id', session.usbxUserId)
    .single();

  if (!data) return null;

  return {
    usbxUserId: data.usbx_user_id,
    username: data.usbx_username,
    avatarUrl: data.usbx_avatar_url,
    role: (data.role as Role) || 'user',
  };
}

export async function requireAdmin(): Promise<CurrentProfile | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'admin') return null;
  return profile;
}
