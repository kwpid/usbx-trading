'use server';

import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

// Any active session already implies a verified account — createSession()
// is only ever called from completeVerification()'s success path, so there
// is no logged-in-but-unverified state to gate against here.
export async function setBypassPrivacyLock(enabled: boolean) {
  const session = await getSession();
  if (!session) return { error: 'You must be logged in.' };

  const { error } = await supabase
    .from('profiles')
    .update({ bypass_privacy_lock: enabled })
    .eq('usbx_user_id', session.usbxUserId);

  if (error) return { error: error.message };

  revalidatePath(`/player/${session.usbxUserId}`);
  revalidatePath('/account/settings');
  return { success: true };
}
