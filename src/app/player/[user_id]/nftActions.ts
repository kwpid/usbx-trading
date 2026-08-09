'use server';

import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export async function setItemNft(itemId: number, nft: boolean) {
  const session = await getSession();
  if (!session) return { error: 'You must be logged in.' };

  if (nft) {
    const { error } = await supabase
      .from('player_nft_items')
      .upsert({ usbx_user_id: session.usbxUserId, item_id: itemId }, { onConflict: 'usbx_user_id,item_id' });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from('player_nft_items')
      .delete()
      .eq('usbx_user_id', session.usbxUserId)
      .eq('item_id', itemId);
    if (error) return { error: error.message };
  }

  revalidatePath(`/player/${session.usbxUserId}`);
  return { success: true };
}
