const COOKIE = 'sv_session';

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// Comparaison a temps constant (evite les attaques de timing sur la signature).
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyCookie(value, secret) {
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [userId, ts, sig] = parts;
  if (Date.now() - Number(ts) > 30 * 24 * 60 * 60 * 1000) return false;
  const expected = await hmac(secret, userId + ':' + ts);
  return timingSafeEqual(expected, sig);
}

export const config = {
  matcher: ['/((?!api/|_vercel|assets/).*)'],
};

export default async function middleware(request) {
  const secret = process.env.ACCESS_SECRET;

  // Dev bypass UNIQUEMENT si secret vaut exactement 'dev'
  if (secret === 'dev') return;

  // Secret manquant = mauvaise config = on bloque par sécurité
  if (!secret) {
    const url = new URL(request.url);
    const dest = 'https://scrivaelo.com/login/?auth_error=misconfigured&app_redirect=1&next=' + encodeURIComponent(url.pathname);
    return Response.redirect(dest, 302);
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(^|;\s*)sv_session=([^;]+)/);
  const token = match ? match[2] : null;

  if (token && await verifyCookie(token, secret)) return; // cookie valide → pass-through

  const url = new URL(request.url);
  const next = url.pathname + url.search;
  return Response.redirect('https://scrivaelo.com/login/?app_redirect=1&next=' + encodeURIComponent(next), 302);
}