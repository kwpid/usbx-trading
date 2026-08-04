const RAP_WEBHOOK_URL =
  process.env.DISCORD_RAP_WEBHOOK_URL ??
  'https://discord.com/api/webhooks/1534283249608687667/bVFoQjyNRhidC2ItqILB3Wibj3Se4rQn-HNbdBwrLd8nQ9pMv6dTLFrOGlag24XkzaeY';

const SALES_WEBHOOK_URL =
  process.env.DISCORD_SALES_WEBHOOK_URL ??
  'https://discord.com/api/webhooks/1534283311147651278/K6m3vHVyAksZMveEU7daOE4388_iJ94oPPdjKsWsFEcFa-3D45lJq7V08CwUPoJ5rU0z';

async function postEmbed(url: string, embed: Record<string, unknown>) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error('Failed to send Discord webhook:', err);
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
}) {
  const diff = opts.newRap - opts.oldRap;
  const pctChange = opts.oldRap > 0 ? ((diff / opts.oldRap) * 100).toFixed(1) : '—';
  const direction = diff >= 0 ? '📈' : '📉';

  await postEmbed(RAP_WEBHOOK_URL, {
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
}) {
  const discount =
    opts.rap != null && opts.rap > 0
      ? (((opts.rap - opts.price) / opts.rap) * 100).toFixed(1)
      : null;

  await postEmbed(SALES_WEBHOOK_URL, {
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
