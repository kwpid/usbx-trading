// No hardcoded fallbacks — these previously baked real webhook URLs into
// the repo, which leaks them to anyone who can read the source. Set the env
// vars in Vercel; each sender silently no-ops until its var is set.
const RAP_WEBHOOK_URL = process.env.DISCORD_RAP_WEBHOOK_URL;
const SALES_WEBHOOK_URL = process.env.DISCORD_SALES_WEBHOOK_URL;
const DEALS_WEBHOOK_URL = process.env.DISCORD_DEALS_WEBHOOK_URL;

export type WebhookResult = { sent: boolean; error?: string };

async function postEmbed(url: string, embed: Record<string, unknown>): Promise<WebhookResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`Discord webhook rejected (${res.status}): ${body}`);
      return { sent: false, error: `Discord returned ${res.status}${body ? `: ${body}` : ''}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('Failed to send Discord webhook:', err);
    return { sent: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function sendRapUpdateWebhook(opts: {
  itemId: number;
  itemName: string;
  imageUrl?: string | null;
  oldRap: number;
  newRap: number;
  salePrice?: number | null;
  totalSales?: number | null;
}): Promise<WebhookResult> {
  if (!RAP_WEBHOOK_URL) return { sent: false, error: 'DISCORD_RAP_WEBHOOK_URL is not set.' };

  const diff = opts.newRap - opts.oldRap;
  const pctChange = opts.oldRap > 0 ? ((diff / opts.oldRap) * 100).toFixed(1) : 'n/a';
  const direction = diff >= 0 ? '📈' : '📉';

  return postEmbed(RAP_WEBHOOK_URL, {
    title: `${direction} RAP Update: ${opts.itemName}`,
    url: `https://usbx.trade/items/${opts.itemId}`,
    color: diff >= 0 ? 0x22c55e : 0xef4444,
    thumbnail: opts.imageUrl ? { url: opts.imageUrl } : undefined,
    fields: [
      { name: 'Old RAP', value: opts.oldRap.toLocaleString(), inline: true },
      { name: 'New RAP', value: opts.newRap.toLocaleString(), inline: true },
      { name: 'Change', value: `${diff >= 0 ? '+' : ''}${diff.toLocaleString()} (${pctChange}%)`, inline: true },
      ...(opts.salePrice != null
        ? [{ name: 'Sale Price', value: opts.salePrice.toLocaleString(), inline: true }]
        : []),
      ...(opts.totalSales != null
        ? [{ name: 'Total Sales', value: String(opts.totalSales), inline: true }]
        : []),
    ],
    timestamp: new Date().toISOString(),
  });
}

export async function sendRecentSaleWebhook(opts: {
  itemId: number;
  itemName: string;
  imageUrl?: string | null;
  price: number;
  rap?: number | null;
  serialNumber?: string | null;
  buyerUsername: string;
  buyerId: number;
  sellerUsername?: string | null;
  sellerId?: number | null;
  saleType?: string;
}): Promise<WebhookResult> {
  if (!SALES_WEBHOOK_URL) return { sent: false, error: 'DISCORD_SALES_WEBHOOK_URL is not set.' };

  const discount =
    opts.rap != null && opts.rap > 0
      ? (((opts.rap - opts.price) / opts.rap) * 100).toFixed(1)
      : null;

  return postEmbed(SALES_WEBHOOK_URL, {
    title: `💰 Recent Sale: ${opts.itemName}`,
    url: `https://usbx.trade/items/${opts.itemId}`,
    color: 0xf59e0b,
    thumbnail: opts.imageUrl ? { url: opts.imageUrl } : undefined,
    fields: [
      { name: 'Price', value: opts.price.toLocaleString(), inline: true },
      ...(opts.rap != null ? [{ name: 'RAP', value: opts.rap.toLocaleString(), inline: true }] : []),
      ...(discount != null
        ? [{ name: 'vs RAP', value: `${Number(discount) >= 0 ? discount + '% below' : Math.abs(Number(discount)) + '% above'}`, inline: true }]
        : []),
      { name: 'Buyer', value: `[${opts.buyerUsername}](https://usbx.trade/player/${opts.buyerId})`, inline: true },
      ...(opts.sellerUsername && opts.sellerId
        ? [{ name: 'Seller', value: `[${opts.sellerUsername}](https://usbx.trade/player/${opts.sellerId})`, inline: true }]
        : [{ name: 'Seller', value: 'Official Release', inline: true }]),
      ...(opts.serialNumber ? [{ name: 'Serial', value: `#${opts.serialNumber}`, inline: true }] : []),
      ...(opts.saleType ? [{ name: 'Type', value: opts.saleType, inline: true }] : []),
    ],
    timestamp: new Date().toISOString(),
  });
}

// Fires when a live listing crosses the "good deal" discount threshold —
// meant to reach people who don't have the Deals page open, since being
// fast to a good deal only matters if you actually see it in time.
export async function sendDealWebhook(opts: {
  itemId: number;
  itemName: string;
  imageUrl?: string | null;
  price: number;
  rap: number;
  discountPct: number;
  storeName?: string | null;
  sellerUsername?: string | null;
}): Promise<WebhookResult> {
  if (!DEALS_WEBHOOK_URL) return { sent: false, error: 'DISCORD_DEALS_WEBHOOK_URL is not set.' };

  return postEmbed(DEALS_WEBHOOK_URL, {
    title: `🔥 New Deal: ${opts.itemName}`,
    url: `https://usbx.trade/items/${opts.itemId}`,
    color: 0x22c55e,
    thumbnail: opts.imageUrl ? { url: opts.imageUrl } : undefined,
    fields: [
      { name: 'Price', value: opts.price.toLocaleString(), inline: true },
      { name: 'RAP', value: opts.rap.toLocaleString(), inline: true },
      { name: 'Discount', value: `${opts.discountPct.toFixed(0)}% below RAP`, inline: true },
      ...(opts.storeName ? [{ name: 'Store', value: opts.storeName, inline: true }] : []),
      ...(opts.sellerUsername ? [{ name: 'Seller', value: opts.sellerUsername, inline: true }] : []),
    ],
    timestamp: new Date().toISOString(),
  });
}
