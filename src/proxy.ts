import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';

// This is Proxy (formerly "middleware" pre-Next 16) — runs on the Node.js
// runtime by default, so jose/supabase-js work here directly. Also the
// site-wide maintenance gate, toggled from Admin -> Sync.

const SESSION_COOKIE = 'usbx_session';
const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function getRequestRole(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });
    const usbxUserId = (payload as { usbxUserId?: number }).usbxUserId;
    if (!usbxUserId) return null;

    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('usbx_user_id', usbxUserId)
      .maybeSingle();

    return data?.role ?? null;
  } catch {
    return null;
  }
}

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  return (await getRequestRole(request)) === 'admin';
}

async function isEditorRequest(request: NextRequest): Promise<boolean> {
  const role = await getRequestRole(request);
  return role === 'admin' || role === 'mod';
}

async function getRandomAvatarUrl(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('usbx_avatar_url')
      .not('usbx_avatar_url', 'is', null)
      .limit(30);

    const urls = (data || []).map((r) => r.usbx_avatar_url).filter(Boolean) as string[];
    if (urls.length === 0) return null;
    return urls[Math.floor(Math.random() * urls.length)];
  } catch {
    return null;
  }
}

function buildMaintenanceHtml(avatarUrl: string | null): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>usbx.trade - Under Maintenance</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #171b16;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      position: relative;
      overflow: hidden;
      background: radial-gradient(circle at 85% 15%, #2c3427 0%, #1b201a 55%, #171b16 100%);
      border: 1px solid #3b4537;
      border-radius: 16px;
      padding: 3rem 2.75rem;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 45px -10px rgba(0,0,0,0.55);
    }
    .card::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
      background-size: 18px 18px;
      pointer-events: none;
    }
    .avatar {
      position: absolute;
      bottom: 0;
      right: -20px;
      width: 240px;
      height: 240px;
      object-fit: contain;
      object-position: bottom;
      opacity: 0.5;
      filter: brightness(0);
      pointer-events: none;
    }
    .content { position: relative; z-index: 1; }
    .brand { font-size: 0.95rem; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 1.75rem; }
    .brand .gold { color: #e2b955; }
    .brand .dot { color: #8353e4; }
    h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.75rem; letter-spacing: -0.01em; }
    p { color: #a1a1aa; line-height: 1.6; max-width: 360px; }
  </style>
</head>
<body>
  <div class="card">
    ${avatarUrl ? `<img class="avatar" src="${avatarUrl}" alt="" />` : ''}
    <div class="content">
      <div class="brand"><span class="gold">usbx</span><span class="dot">.</span>trade</div>
      <h1>We&rsquo;ll be right back</h1>
      <p>The site is offline for a bit while we work on things behind the scenes. Thanks for your patience, check back shortly.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always reachable so an admin can re-establish a session during maintenance.
  if (pathname.startsWith('/account')) {
    return NextResponse.next();
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!(await isAdminRequest(request))) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  } else if (/^\/items\/[^/]+\/edit(\/|$)/.test(pathname)) {
    if (!(await isEditorRequest(request))) {
      return NextResponse.redirect(new URL(pathname.replace(/\/edit(\/|$)/, ''), request.url));
    }
  }

  let maintenanceOn = false;
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('maintenance_mode')
      .eq('id', 1)
      .maybeSingle();
    maintenanceOn = Boolean(data?.maintenance_mode);
  } catch {
    // Fail open — a DB hiccup shouldn't lock everyone out.
    maintenanceOn = false;
  }

  if (!maintenanceOn) {
    return NextResponse.next();
  }

  if (await isAdminRequest(request)) {
    return NextResponse.next();
  }

  const avatarUrl = await getRandomAvatarUrl();

  return new NextResponse(buildMaintenanceHtml(avatarUrl), {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': '3600',
    },
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
