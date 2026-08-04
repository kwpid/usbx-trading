'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function recordPlayerSnapshot(userId: string, totalRap: number, totalValue: number) {
  const { data: recentSnapshots } = await supabase
    .from('player_value_history')
    .select('id, created_at, total_rap, total_value')
    .eq('usbx_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const lastSnapshot = recentSnapshots?.[0];
  const valueChanged = !lastSnapshot || lastSnapshot.total_rap !== totalRap || lastSnapshot.total_value !== totalValue;

  if (valueChanged) {
    await supabase.from('player_value_history').insert({
      usbx_user_id: userId,
      total_rap: totalRap,
      total_value: totalValue,
    });
    revalidatePath('/leaderboards');
  }
}
