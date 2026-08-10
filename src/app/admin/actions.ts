'use server'

import { supabase } from '@/lib/supabase';
import { requireAdmin, requireEditor } from '@/lib/roles';
import { fetchItemFullDetails, extractUsbxItemId } from '@/lib/usbxApi';
import { sendRapUpdateWebhook, sendRecentSaleWebhook } from '@/lib/discordWebhooks';
import { revalidatePath } from 'next/cache';

export async function testRapWebhook() {
  if (!(await requireAdmin())) return { error: 'Admins only.', success: false };

  const result = await sendRapUpdateWebhook({
    itemId: 0,
    itemName: 'Test Item',
    imageUrl: null,
    oldRap: 1000,
    newRap: 1200,
    salePrice: 1150,
    totalSales: 42,
  });

  return result.sent ? { success: true } : { error: result.error || 'Failed to send.', success: false };
}

export async function testSalesWebhook() {
  if (!(await requireAdmin())) return { error: 'Admins only.', success: false };

  const result = await sendRecentSaleWebhook({
    itemId: 0,
    itemName: 'Test Item',
    imageUrl: null,
    price: 1150,
    rap: 1200,
    serialNumber: '0001',
    buyerUsername: 'TestBuyer',
    buyerId: 0,
    sellerUsername: 'TestSeller',
    sellerId: 0,
    saleType: 'RESALE_PURCHASED',
  });

  return result.sent ? { success: true } : { error: result.error || 'Failed to send.', success: false };
}

export async function setMaintenanceMode(enabled: boolean) {
  if (!(await requireAdmin())) {
    return { error: 'Admins only.', success: false };
  }

  const { error } = await supabase
    .from('site_settings')
    .update({ maintenance_mode: enabled })
    .eq('id', 1);

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath('/');
  return { success: true };
}

export async function resetAllBadges() {
  if (!(await requireAdmin())) {
    return { error: 'Admins only.', success: false };
  }

  const { error } = await supabase.from('player_badges').delete().gte('usbx_user_id', 0);

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath('/badges');
  return { success: true };
}

export async function lookupPlayerBadges(usbxUserId: number) {
  if (!(await requireAdmin())) {
    return { error: 'Admins only.', success: false as const };
  }

  const [{ data: profile }, { data: badgeRows }] = await Promise.all([
    supabase.from('profiles').select('usbx_username').eq('usbx_user_id', usbxUserId).maybeSingle(),
    supabase.from('player_badges').select('badge_id').eq('usbx_user_id', usbxUserId),
  ]);

  return {
    success: true as const,
    username: profile?.usbx_username ?? null,
    badgeIds: (badgeRows || []).map((r) => r.badge_id as string),
  };
}

export async function grantBadge(usbxUserId: number, badgeId: string) {
  if (!(await requireAdmin())) {
    return { error: 'Admins only.', success: false };
  }

  const { error } = await supabase
    .from('player_badges')
    .upsert({ usbx_user_id: usbxUserId, badge_id: badgeId }, { onConflict: 'usbx_user_id,badge_id' });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath(`/player/${usbxUserId}`);
  revalidatePath('/badges');
  return { success: true };
}

export async function revokeBadge(usbxUserId: number, badgeId: string) {
  if (!(await requireAdmin())) {
    return { error: 'Admins only.', success: false };
  }

  const { error } = await supabase
    .from('player_badges')
    .delete()
    .eq('usbx_user_id', usbxUserId)
    .eq('badge_id', badgeId);

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath(`/player/${usbxUserId}`);
  revalidatePath('/badges');
  return { success: true };
}

export async function refreshItemPricing(itemId: string) {
  if (!(await requireAdmin())) {
    return { error: 'Admins only.', success: false };
  }

  const { data: item, error: fetchError } = await supabase
    .from('items')
    .select('source_url, is_limited')
    .eq('id', itemId)
    .single();

  if (fetchError || !item?.source_url) {
    return { error: 'This item has no USBX source link to refresh from.', success: false };
  }

  if (!item.is_limited) {
    return { error: "This item isn't limited. USBX doesn't track RAP/resale data for it, so there's nothing to refresh.", success: false };
  }

  const usbxItemId = extractUsbxItemId(item.source_url);
  if (!usbxItemId) {
    return { error: 'Could not parse the USBX item ID from the saved source link.', success: false };
  }

  try {
    const details = await fetchItemFullDetails(usbxItemId);
    // Value is never touched here — it's managed manually via this site's
    // own value-changes tracking, not overwritten by whatever USBX reports.
    const updates: Record<string, any> = { available_owners: details.uniqueOwners };
    if (details.rapScrips !== null) updates.rap = details.rapScrips;
    if (details.priceScrips !== null) updates.price_best_resale = details.priceScrips;
    if (details.copiesSold !== null) updates.copies_sold = details.copiesSold;

    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', itemId)
      .select();

    if (error) {
      return { error: `Database error: ${error.message}`, success: false };
    }

    revalidatePath('/');
    revalidatePath('/market');
    revalidatePath(`/items/${itemId}`);

    return { success: true, item: data[0] };
  } catch (err: any) {
    return { error: err.message || 'Could not refresh pricing from USBX.', success: false };
  }
}

export async function updateItemAction(itemId: string, updates: any) {
  if (!(await requireAdmin())) {
    return { error: 'Admins only.', success: false };
  }

  try {
    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', itemId)
      .select();

    if (error) {
      console.error("Supabase error updating:", error);
      return { error: `Database error: ${error.message}`, success: false };
    }

    revalidatePath('/');
    revalidatePath('/market');
    revalidatePath(`/items/${itemId}`);

    return { 
      success: true, 
      message: `Successfully updated!`,
      item: data[0]
    };
  } catch (err: any) {
    console.error('Update error:', err);
    return { error: err.message || 'An unexpected error occurred during update', success: false };
  }
}

export async function updateItemValueAction(itemId: string, data: { value: number, trend: string, demand: string, reason: string }) {
  const editor = await requireEditor();
  if (!editor) {
    return { error: 'Admins and value editors only.', success: false };
  }
  const editorUsername = editor.username || `User #${editor.usbxUserId}`;

  try {
    const { data: item, error: fetchErr } = await supabase
      .from('items')
      .select('value, trend, demand, rap, available_owners, copies_sold, price_best_resale, name, item_image_url')
      .eq('id', itemId)
      .single();

    if (fetchErr) {
      return { error: `Item not found: ${fetchErr.message}`, success: false };
    }

    const updates: any = {};
    const changesToLog = [];

    if (data.value !== item.value) {
      updates.value = data.value;
      changesToLog.push({
        item_id: itemId,
        type: 'Value Changed',
        old_val: String(item.value || 0),
        new_val: String(data.value),
        is_increase: data.value > (item.value || 0),
        reason: data.reason,
      });
    }

    const currentTrend = item.trend || 'Stable';
    if (data.trend !== currentTrend) {
      updates.trend = data.trend;
      changesToLog.push({
        item_id: itemId,
        type: 'Trend Changed',
        old_val: currentTrend,
        new_val: data.trend,
        is_increase: true,
        reason: data.reason,
      });
    }

    const currentDemand = item.demand || 'Normal';
    if (data.demand !== currentDemand) {
      updates.demand = data.demand;
      changesToLog.push({
        item_id: itemId,
        type: 'Demand Changed',
        old_val: currentDemand,
        new_val: data.demand,
        is_increase: true,
        reason: data.reason,
      });
    }

    if (Object.keys(updates).length === 0) {
      return { error: 'No changes were detected.', success: false };
    }

    const { error: updateErr } = await supabase
      .from('items')
      .update(updates)
      .eq('id', itemId);

    if (updateErr) {
      return { error: `Failed to update item: ${updateErr.message}`, success: false };
    }

    if (changesToLog.length > 0) {
      const { error: logErr } = await supabase
        .from('item_value_changes')
        .insert(changesToLog);
      
      if (logErr) {
        console.error("Failed to log value changes:", logErr);
      }
    }

    if (updates.value !== undefined) {
      const { error: histErr } = await supabase
        .from('item_price_history')
        .insert({
          item_id: itemId,
          rap: item.rap,
          value: updates.value,
          price_best_resale: item.price_best_resale,
          available_owners: item.available_owners,
          copies_sold: item.copies_sold,
        });

      if (histErr) {
        console.error("Failed to insert price history snapshot:", histErr);
      }
    }
      
    const embeds = [];

    const editorFooter = { text: `Updated by ${editorUsername}` };

    if (updates.value !== undefined) {
      embeds.push({
        title: `Value Update: ${item.name}`,
        url: `https://usbx.trade/items/${itemId}`,
        color: updates.value > (item.value || 0) ? 0x22c55e : 0xef4444,
        thumbnail: item.item_image_url ? { url: item.item_image_url } : undefined,
        fields: [
          { name: 'Old Value', value: String(item.value || 0), inline: true },
          { name: 'New Value', value: String(updates.value), inline: true },
          { name: 'Reason', value: data.reason || 'No reason provided.' }
        ],
        footer: editorFooter,
      });
    }

    if (updates.trend !== undefined) {
      embeds.push({
        title: `Trend Update: ${item.name}`,
        url: `https://usbx.trade/items/${itemId}`,
        color: 0x3b82f6,
        thumbnail: item.item_image_url ? { url: item.item_image_url } : undefined,
        fields: [
          { name: 'Old Trend', value: item.trend || 'Stable', inline: true },
          { name: 'New Trend', value: updates.trend, inline: true },
          { name: 'Reason', value: data.reason || 'No reason provided.' }
        ],
        footer: editorFooter,
      });
    }

    if (updates.demand !== undefined) {
      embeds.push({
        title: `Demand Update: ${item.name}`,
        url: `https://usbx.trade/items/${itemId}`,
        color: 0x3b82f6,
        thumbnail: item.item_image_url ? { url: item.item_image_url } : undefined,
        fields: [
          { name: 'Old Demand', value: item.demand || 'Normal', inline: true },
          { name: 'New Demand', value: updates.demand, inline: true },
          { name: 'Reason', value: data.reason || 'No reason provided.' }
        ],
        footer: editorFooter,
      });
    }
    
    if (embeds.length > 0 && process.env.DISCORD_VALUE_CHANGES_WEBHOOK_URL) {
      for (const embed of embeds) {
        try {
          await fetch(process.env.DISCORD_VALUE_CHANGES_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
          });
          // Small delay to ensure Discord orders the separate messages correctly
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          console.error("Failed to send webhook:", e);
        }
      }
    }

    revalidatePath('/');
    revalidatePath('/market');
    revalidatePath(`/items/${itemId}`);
    revalidatePath(`/item-value-changes/${itemId}`);

    return { success: true };
  } catch (err: any) {
    console.error('Value update error:', err);
    return { error: err.message || 'An unexpected error occurred during update', success: false };
  }
}
