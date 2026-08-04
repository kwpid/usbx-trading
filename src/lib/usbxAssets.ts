// USBX sometimes returns full CDN URLs for avatars/headshots (custom
// uploads) and sometimes a relative path like "/content/img/decorations/
// headshot.png" (default placeholder). Rendering the relative form directly
// resolves against OUR origin and 404s. No 'server-only' here — this needs
// to run in client components too (search results, etc.).
const USBX_ORIGIN = 'https://beta.untitled-sandbox.com';

export function resolveUsbxAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${USBX_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
