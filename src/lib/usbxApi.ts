import 'server-only';
import { tokensToScrips } from '@/lib/currency';

const USBX_ORIGIN = 'https://beta.untitled-sandbox.com';

export const USBX_ITEM_URL_REGEX = /^https:\/\/beta\.untitled-sandbox\.com\/(?:marketplace|items?)\/(\d+)\/?$/i;

export function extractUsbxItemId(url: string): string | null {
  return url.trim().match(USBX_ITEM_URL_REGEX)?.[1] ?? null;
}

export class UsbxApiError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`USBX API request failed (${status}): ${path}`);
    this.name = 'UsbxApiError';
    this.status = status;
  }
}

// Vercel's serverless IP ranges get blocked by USBX's Cloudflare bot
// protection. When USBX_PROXY_URL is set, route through a Cloudflare
// Worker instead (usbx-trading-api.tnivens73.workers.dev); falls back to
// hitting USBX directly when unset (local dev).
function resolveUsbxRequest(path: string): { url: string; headers: Record<string, string> } {
  const proxyUrlRaw = process.env.USBX_PROXY_URL;
  if (proxyUrlRaw) {
    const proxyUrl = /^https?:\/\//i.test(proxyUrlRaw) ? proxyUrlRaw : `https://${proxyUrlRaw}`;
    return {
      url: `${proxyUrl.replace(/\/$/, '')}${path}`,
      headers: { 'x-proxy-secret': process.env.USBX_PROXY_SECRET || '' },
    };
  }

  return {
    url: `${USBX_ORIGIN}${path}`,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      Referer: `${USBX_ORIGIN}/`,
    },
  };
}

async function usbxGetRaw(path: string): Promise<any> {
  const { url, headers } = resolveUsbxRequest(path);
  const res = await fetch(url, { cache: 'no-store', headers });
  if (!res.ok) {
    throw new UsbxApiError(res.status, path);
  }
  const json = await res.json();
  if (json?.status !== 'success') {
    throw new Error(`USBX API returned an error for ${path}`);
  }
  return json;
}

async function usbxGet<T = any>(path: string): Promise<T> {
  const json = await usbxGetRaw(path);
  return json.data as T;
}

export type UsbxItem = {
  id: number;
  price: number;
  stockTotal: number | null;
  stockSold: number | null;
  currencyUsed: { code: string } | null;
  item: {
    id: number;
    name: string;
    description: string | null;
    thumbnailUrl: string | null;
    resolvedPreviewUrl: string | null;
    clothingType?: string | null;
    visualCategory?: string | null;
    normalDetails?: { isLimited: boolean; totalStock: number } | null;
  };
};

export async function fetchItem(itemId: string | number): Promise<UsbxItem> {
  return usbxGet<UsbxItem>(`/api/marketplace/item/${itemId}`);
}

export type UsbxItemRap = {
  rap: number;
  originalPrice?: number;
  currencyCode: string;
  currencyName?: string;
  totalSales: number | null;
  priceHistory?: { price: number; soldAt: string }[];
};

export async function fetchItemRap(itemId: string | number): Promise<UsbxItemRap | null> {
  return usbxGet<UsbxItemRap | null>(`/api/marketplace/item/${itemId}/rap`);
}

export type UsbxItemValue = {
  recentAveragePrice: number | null;
  lowestResalePrice: number | null;
  originalPrice: number | null;
};

export async function fetchItemValue(itemId: string | number): Promise<UsbxItemValue> {
  return usbxGet<UsbxItemValue>(`/api/marketplace/item/${itemId}/value`);
}

export type UsbxOwnerRow = {
  serialId: number;
  serialNumber: string;
  acquiredAt: string | null;
  owner: { id: number; username: string; profile?: { headshotUrl: string | null } } | null;
};

export async function fetchItemOwners(itemId: string | number): Promise<UsbxOwnerRow[]> {
  const all: UsbxOwnerRow[] = [];
  let cursor: string | number | undefined;
  const MAX_PAGES = 200;

  for (let page = 0; page < MAX_PAGES; page++) {
    const query = cursor ? `?limit=100&cursor=${cursor}` : '?limit=100';
    const json = await usbxGetRaw(`/api/marketplace/item/${itemId}/owners${query}`);
    const rows: UsbxOwnerRow[] = json.data ?? [];
    all.push(...rows);
    if (rows.length < 100 || !json.nextCursor || json.nextCursor === cursor) break;
    cursor = json.nextCursor;
  }

  return all;
}

export async function fetchItemUniqueOwnerCount(itemId: string | number): Promise<number> {
  const owners = await fetchItemOwners(itemId);
  return new Set(owners.map((row) => row.owner?.id).filter(Boolean)).size;
}

export type UsbxSale = {
  eventId: string;
  type: string;
  price: number | null;
  purchasedAt: string | null;
  currency: { code: string } | null;
  serial?: { serialNumber: string } | null;
  buyer?: { id: number; username: string; profile?: { headshotUrl: string | null } } | null;
  seller?: { id: number; username: string; profile?: { headshotUrl: string | null } } | null;
};

export async function fetchItemRecentSales(itemId: string | number): Promise<UsbxSale[]> {
  const data = await usbxGet<{ sales: UsbxSale[] } | UsbxSale[]>(`/api/marketplace/item/${itemId}/recent-sales`);
  return Array.isArray(data) ? data : data?.sales ?? [];
}

export type UsbxItemFullDetails = {
  name: string | null;
  imageUrl: string | null;
  copiesSold: number | null;
  uniqueOwners: number;
  rapScrips: number | null;
  valueScrips: number | null;
  priceScrips: number | null;
  isLimited: boolean;
};

export async function fetchItemFullDetails(itemId: string | number): Promise<UsbxItemFullDetails> {
  const [storeItem, rap, value, uniqueOwners] = await Promise.all([
    fetchItem(itemId),
    fetchItemRap(itemId),
    fetchItemValue(itemId),
    fetchItemUniqueOwnerCount(itemId),
  ]);

  const isTokens = (rap?.currencyCode ?? storeItem.currencyUsed?.code) !== 'SCRIPS';
  const toScrips = (amount: number | null | undefined) =>
    amount == null ? null : isTokens ? tokensToScrips(amount) : Math.round(amount);

  return {
    name: storeItem.item.name || null,
    imageUrl: storeItem.item.resolvedPreviewUrl || null,
    copiesSold: storeItem.stockSold,
    uniqueOwners,
    rapScrips: toScrips(rap?.rap),
    valueScrips: toScrips(value.recentAveragePrice),
    priceScrips: toScrips(value.lowestResalePrice),
    isLimited: storeItem.item.normalDetails?.isLimited ?? (rap !== null || storeItem.stockTotal !== null),
  };
}

export type UsbxMarketplaceListing = {
  id: number;
  price: number;
  listedAt: string | null;
  stockTotal: number | null;
  stockSold: number | null;
  startsAt: string | null;
  endsAt: string | null;
  store: { id: number; name: string; storeType: string } | null;
  currencyUsed: { id: number; code: string; name: string; imageUrl?: string | null } | null;
  listedBy: { id: number; username: string; profile?: { headshotUrl: string | null } } | null;
  item: {
    id: number;
    name: string;
    resolvedPreviewUrl: string | null;
    clothingType?: string | null;
    visualCategory?: string | null;
    normalDetails?: { isLimited: boolean; totalStock: number | null } | null;
  };
};

export async function fetchMarketplaceListings(
  params: { cursor?: number; limit?: number; sort?: string; search?: string; category?: string } = {}
): Promise<{ listings: UsbxMarketplaceListing[]; nextCursor: number | null }> {
  const qs = new URLSearchParams();
  if (params.cursor !== undefined) qs.set('cursor', String(params.cursor));
  qs.set('limit', String(params.limit ?? 20));
  if (params.sort) qs.set('sort', params.sort);
  if (params.search) qs.set('search', params.search);
  if (params.category) qs.set('category', params.category);

  const json = await usbxGetRaw(`/api/marketplace/items?${qs.toString()}`);
  return { listings: json.data?.items ?? [], nextCursor: json.data?.nextCursor ?? null };
}

export async function fetchItemsPage(
  params: { cursor?: number; limit?: number; sort?: string; category?: string } = {}
): Promise<{ items: UsbxItem[]; nextCursor: number | null }> {
  const qs = new URLSearchParams();
  if (params.cursor !== undefined) qs.set('cursor', String(params.cursor));
  qs.set('limit', String(params.limit ?? 50));
  if (params.sort) qs.set('sort', params.sort);
  if (params.category) qs.set('category', params.category);

  const json = await usbxGetRaw(`/api/marketplace/items?${qs.toString()}`);
  return { items: json.data?.items ?? [], nextCursor: json.data?.nextCursor ?? null };
}

// Garments carry a clothingType; accessories/hats/gear (what we track)
// leave it null. Re-check this assumption if sync data ever shows otherwise.
export function isClothingItem(entry: UsbxItem): boolean {
  return Boolean(entry.item.clothingType);
}

export type UsbxProfileSummary = {
  user: {
    id: number;
    username: string;
    profile: {
      avatarUrl: string | null;
      headshotUrl: string | null;
      bio: string | null;
    };
  };
  privacy?: {
    viewInventory?: string;
    canViewInventory?: boolean;
  };
};

export async function fetchProfileSummary(userId: string | number): Promise<UsbxProfileSummary> {
  return usbxGet<UsbxProfileSummary>(`/api/profiles/${userId}/summary?_t=${Date.now()}`);
}

export type UsbxInventoryItem = {
  id: number;
  serialId: number;
  serialNumber: string;
  acquiredAt: string | null;
  acquisitionMethod: string | null;
  inVault: boolean;
  inShowcase: boolean;
  item: {
    id: number;
    itemId: number;
    // Matches our own items.id (the store listing id) — join with this,
    // not item.id or item.itemId.
    storeItemId: number;
    name: string;
    visualCategory: string | null;
    resolvedPreviewUrl: string | null;
  };
};

// Deliberately not /api/game/users/{id}, which returns private fields
// (verified emails, currency balances) — this is the public,
// privacy-respecting endpoint.
export async function fetchAllProfileInventory(userId: string | number): Promise<UsbxInventoryItem[]> {
  const all: UsbxInventoryItem[] = [];
  const MAX_PAGES = 50;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const timestamp = Date.now();
    const json = await usbxGetRaw(`/api/profiles/${userId}/inventory?page=${page}&limit=100&_t=${timestamp}`);
    const items: UsbxInventoryItem[] = json.data?.items ?? [];
    all.push(...items);
    if (!json.data?.meta?.hasNext) break;
  }

  return all;
}

export type UsbxLifecycleEvent = {
  eventType: string;
  createdAt: string;
  fromUser: { id: number; username: string; profile?: { headshotUrl: string | null } } | null;
  toUser: { id: number; username: string; profile?: { headshotUrl: string | null } } | null;
};

export async function fetchSerialLifecycle(serialId: string | number): Promise<UsbxLifecycleEvent[]> {
  const json = await usbxGetRaw(`/api/trading/lifecycle/${serialId}`);
  return json.data ?? [];
}

export type UsbxSearchResult = { type: string; id: number; title: string; subtitle: string | null; imageUrl: string | null; href: string };

export async function searchSite(query: string): Promise<UsbxSearchResult[]> {
  const data = await usbxGet<{ results: UsbxSearchResult[] }>(`/api/search/?q=${encodeURIComponent(query)}`);
  return data?.results ?? [];
}

export async function fetchPublicEvents(params: { eventTypes: string[]; limit?: number }): Promise<any[]> {
  const qs = new URLSearchParams();
  // Repeated eventType params, not a comma-joined value — USBX 422s on that.
  for (const type of params.eventTypes) qs.append('eventType', type);
  qs.set('limit', String(params.limit ?? 50));
  const json = await usbxGetRaw(`/api/public-index/events?${qs.toString()}`);
  return json.data?.items ?? [];
}

export type UsbxRapLeaderboardEntry = {
  rank: number;
  userId: number;
  username: string;
  headshotUrl: string | null;
  rapFreemium: number;
  limitedItemCount: number;
};

export async function fetchRapLeaderboard(take: number, cursor?: number): Promise<{ entries: UsbxRapLeaderboardEntry[]; nextCursor: number | null }> {
  const qs = new URLSearchParams();
  qs.set('type', 'rap');
  qs.set('take', String(take));
  if (cursor !== undefined) qs.set('cursor', String(cursor));
  const json = await usbxGetRaw(`/api/leaderboards/?${qs.toString()}`);
  return {
    entries: json.data?.entries ?? [],
    nextCursor: json.data?.nextCursor ?? null,
  };
}
