import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';

// Site-wide maintenance gate. Runs on every page request (see matcher below)
// and, when maintenance_mode is on, blocks everyone except a signed-in admin
// behind a static maintenance screen — no page content, no data, nothing
// rendered. Toggled from Admin -> Sync (MaintenanceTogglePanel), no redeploy
// needed.
//
// This is Proxy (formerly "middleware"), which in this Next.js version runs
// on the Node.js runtime by default, so plain Node-compatible packages
// (jose, supabase-js) work here same as anywhere else server-side.

const SESSION_COOKIE = 'usbx_session';
const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });
    const usbxUserId = (payload as { usbxUserId?: number }).usbxUserId;
    if (!usbxUserId) return false;

    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('usbx_user_id', usbxUserId)
      .maybeSingle();

    return data?.role === 'admin';
  } catch {
    return false;
  }
}

const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>usbx.trade — Under Maintenance</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #2b3628;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background-color: #212620;
      border: 1px solid #3b4537;
      border-radius: 12px;
      padding: 2.5rem;
      max-width: 440px;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
    }
    h1 { font-size: 1.6rem; margin-bottom: 0.75rem; }
    p { color: #a1a1aa; line-height: 1.5; }
    .brand { color: #7b8b74; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand" style="margin-bottom: 1rem;">usbx.trade</div>
    <h1>We&rsquo;ll be right back</h1>
    <p>The site is undergoing maintenance right now. Check back shortly.</p>
  </div>
</body>
</html>`;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always reachable so an admin can (re-)establish a session even while
  // maintenance is on — this route has no destructive/sensitive side effects
  // for a random visitor beyond seeing the verification UI itself.
  if (pathname.startsWith('/account')) {
    return NextResponse.next();
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
    // If the settings check itself fails, fail open rather than locking
    // everyone (including admins) out of a working site over a DB hiccup.
    maintenanceOn = false;
  }

  if (!maintenanceOn) {
    return NextResponse.next();
  }

  if (await isAdminRequest(request)) {
    return NextResponse.next();
  }

  return new NextResponse(MAINTENANCE_HTML, {
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
