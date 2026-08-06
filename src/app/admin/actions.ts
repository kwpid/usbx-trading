'use server'

import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/roles';
import { fetchItemFullDetails, extractUsbxItemId } from '@/lib/usbxApi';
import { revalidatePath } from 'next/cache';
export async function fetchItemFromApiAction(itemId: string) {
  // Placeholder for future API integration
  return { error: 'API integration coming soon. Please use custom upload for testing.', success: false };
}

// Site-wide maintenance mode — gated in proxy.ts for every non-admin visitor,
// toggled here so it doesn't require a redeploy to flip on/off.
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

// Wipes every awarded badge, site-wide — for re-tuning badge criteria during
// development without stale grants sticking around. Players re-earn
// anything they're still eligible for next time they load their profile.
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

// Looks up a player by USBX user id for the Community Badges admin panel —
// returns their current badges so the panel can show grant/revoke state.
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

export async function saveItemAction(item: any) {
  if (!(await requireAdmin())) {
    return { error: 'Admins only.', success: false };
  }

  try {
    const { data, error } = await supabase
      .from('items')
      .insert([item])
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return { error: `Database error: ${error.message}. Did you create the table?`, success: false };
    }

    revalidatePath('/');
    revalidatePath('/market');

    return { 
      success: true, 
      message: `Successfully saved ${item.name}!`,
      item: data[0]
    };
  } catch (err: any) {
    console.error('Save error:', err);
    return { error: err.message || 'An unexpected error occurred during saving', success: false };
  }
}

// Re-pulls RAP/Value/Price/owners from USBX for an item that was originally
// added via the link scraper, so prices stay in sync as items resell.
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
    return { error: "This item isn't limited — USBX doesn't track RAP/resale data for it, so there's nothing to refresh.", success: false };
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
  if (!(await requireAdmin())) {
    return { error: 'Admins only.', success: false };
  }

  try {
    // 1. Fetch current item state
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

    // Compare Value
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

    // Compare Trend
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

    // Compare Demand
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

    // 2. Update item
    const { error: updateErr } = await supabase
      .from('items')
      .update(updates)
      .eq('id', itemId);

    if (updateErr) {
      return { error: `Failed to update item: ${updateErr.message}`, success: false };
    }

    // 3. Log changes
    if (changesToLog.length > 0) {
      const { error: logErr } = await supabase
        .from('item_value_changes')
        .insert(changesToLog);
      
      if (logErr) {
        console.error("Failed to log value changes:", logErr);
      }
    }

    // 4. Update chart history if value changed
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
      
    // Discord Webhook
    const embeds = [];

    if (updates.value !== undefined) {
      embeds.push({
        title: `Value Update: ${item.name}`,
        url: `https://usbx.trade/items/${itemId}`,
        color: updates.value > (item.value || 0) ? 0x22c55e : 0xef4444, // Green for increase, Red for decrease
        thumbnail: item.item_image_url ? { url: item.item_image_url } : undefined,
        fields: [
          { name: 'Old Value', value: String(item.value || 0), inline: true },
          { name: 'New Value', value: String(updates.value), inline: true },
          { name: 'Reason', value: data.reason || 'No reason provided.' }
        ]
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
        ]
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
        ]
      });
    }
    
    if (embeds.length > 0) {
      for (const embed of embeds) {
        try {
          await fetch('https://discord.com/api/webhooks/1534261990703497226/Fk8M35V7SOk20-79Z5ebLbu7EaK-0RDS4ZslISyDdjM11fSLcwYXgnfNPFipRlfKzDa5', {
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
