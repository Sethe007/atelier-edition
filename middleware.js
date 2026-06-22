const COOKIE = 'sv_session';

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function verifyCookie(value, secret) {
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [userId, ts, sig] = parts;
  if (Date.now() - Number(ts) > 30 * 24 * 60 * 60 * 1000) return false;
  const expected = await hmac(secret, userId + ':' + ts);
  return expected === sig;
}

export const config = {
  matcher: ['/((?!api/|_vercel|favicon\\.svg|assets/).*)'],
};

export default async function middleware(request) {
  const secret = process.env.ACCESS_SECRET;
  if (!secret || secret === 'dev') return;

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  const token = match ? match[1] : null;

  if (token && await verifyCookie(token, secret)) return;

  const url = new URL(request.url);
  const next = url.pathname + url.search;
  const dest = 'https://scrivaelo.com/login/?app_redirect=1&next=' + encodeURIComponent(next);
  return Response.redirect(dest, 302);
}