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
// protection (confirmed: same request succeeds from a plain residential IP
// or from a Cloudflare Worker, but 403s from Vercel). When USBX_PROXY_URL is
// set, route every request through a small Cloudflare Worker that forwards
// to USBX instead — see usbx-trading-api.tnivens73.workers.dev. Falls back
// to hitting USBX directly when unset (local dev, where the direct call
// already works fine).
function resolveUsbxRequest(path: string): { url: string; headers: Record<string, string> } {
  const proxyUrlRaw = process.env.USBX_PROXY_URL;
  if (proxyUrlRaw) {
    // Tolerate the env var being entered without a scheme (e.g.
    // "usbx-proxy.workers.dev" instead of "https://usbx-proxy.workers.dev")
    // — fetch() throws an opaque "Failed to parse URL" otherwise.
    const proxyUrl = /^https?:\/\//i.test(proxyUrlRaw) ? proxyUrlRaw : `https://${proxyUrlRaw}`;
    return {
      url: `${proxyUrl.replace(/\/$/, '')}${path}`,
      headers: { 'x-proxy-secret': process.env.USBX_PROXY_SECRET || '' },
    };
  }

  return {
    url: `${USBX_ORIGIN}${path}`,
    headers: {
      // Serverless/edge fetches otherwise carry no User-Agent at all, which
      // is an easy bot-protection tripwire (Cloudflare, etc.) — send
      // something that reads as an ordinary browser request.
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

// Owners are paginated; walk every page. Used both for an exact
// unique-owner count and (on the item page) the actual owner/hoarder lists.
export async function fetchItemOwners(itemId: string | number): Promise<UsbxOwnerRow[]> {
  const all: UsbxOwnerRow[] = [];
  let cursor: string | number | undefined;
  const MAX_PAGES = 200; // 200 * 100 = 20,000 owned serials, far beyond any real item

  for (let page = 0; page < MAX_PAGES; page++) {
    const query = cursor ? `?limit=100&cursor=${cursor}` : '?limit=100';
    const json = await usbxGetRaw(`/api/marketplace/item/${itemId}/owners${query}`);
    const rows: UsbxOwnerRow[] = json.data ?? [];
    all.push(...rows);
    // Stop once a short page or an unchanged/missing cursor signals the end.
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
  // "Price" is the lowest current resale listing — closer to "what would it
  // actually cost to buy one right now" than RAP or Value.
  priceScrips: number | null;
  // Straight from the item's own normalDetails.isLimited flag.
  isLimited: boolean;
};

// Gathers everything the admin add-item flow and the pricing refresh both
// need, in one call, using the item's own currency (assume TOKENS unless
// told otherwise; the API doesn't attach a currency code to /value).
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
    // normalDetails.isLimited is the authoritative flag straight from the
    // item object; fall back to the RAP/stock heuristic only if it's ever
    // missing for some item shape we haven't seen.
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

// The list endpoint returns the same full nested item shape as fetchItem()
// per entry, so cataloging the whole marketplace doesn't need a per-item
// follow-up call.
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

// Best-effort: the API doesn't expose an explicit "is clothing" flag or a
// documented category enum, but actual garments (shirts, pants, etc.) carry
// a clothingType while accessories/hats/gear (which we want) leave it null —
// e.g. the "Mahjong Crown" hat has clothingType: null, visualCategory: "HAT".
// If real sync data shows this assumption is wrong, this is the one place
// to fix it.
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
  // Explicit, authoritative privacy flags straight from the profile summary
  // — cheap to check (this call is already made regardless) versus the
  // expensive way of finding out (attempting the full paginated inventory
  // fetch and catching the 403).
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
    // Matches our own items.id (the store listing id) — join against our
    // DB with this, not item.id or item.itemId.
    storeItemId: number;
    name: string;
    visualCategory: string | null;
    resolvedPreviewUrl: string | null;
  };
};

// Public, privacy-respecting inventory view (deliberately not
// /api/game/users/{id}, which is documented as "game-trusted" and returns
// private fields like verified emails/currency balances — wrong endpoint
// for a public profile page). Walks every page, capped generously.
export async function fetchAllProfileInventory(userId: string | number): Promise<UsbxInventoryItem[]> {
  const all: UsbxInventoryItem[] = [];
  const MAX_PAGES = 50; // 50 * 100 = 5,000 owned items, far beyond any real inventory

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

// Real-time market events (listings, relistings, purchases) — used by the
// worker script and the cron poll route to detect new activity since the
// last check. Routed through usbxGetRaw like everything else, so it picks
// up the Cloudflare Worker proxy automatically when configured.
export async function fetchPublicEvents(params: { eventTypes: string[]; limit?: number }): Promise<any[]> {
  const qs = new URLSearchParams();
  // USBX's API wants one `eventType` param per type, not a single
  // comma-joined value — the joined form 422s outright.
  for (const type of params.eventTypes) qs.append('eventType', type);
  qs.set('limit', String(params.limit ?? 50));
  const json = await usbxGetRaw(`/api/public-index/events?${qs.toString()}`);
  return json.data?.items ?? [];
}
