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
  // SECURITE : le bypass 'dev' n'est accepté QUE hors production
  // (VERCEL_ENV: 'production' | 'preview' | 'development').
  if (secret === 'dev') {
    const env = (typeof process !== 'undefined' && process.env && process.env.VERCEL_ENV) || '';
    if (env !== 'production') return;
    // ACCESS_SECRET='dev' en production = configuration invalide -> accès refusé.
    return new Response('Server misconfigured (ACCESS_SECRET)', { status: 503 });
  }

  // Secret manquant = mauvaise config = on bloque par sécurité
  if (!secret) {
    const url = new URL(request.url);
    const dest = 'https://scrivaelo.com/login/?auth_error=misconfigured&app_redirect=1&next=' + encodeURIComponent(url.pathname);
    return Response.redirect(dest, 302);
  }

  const cookieHeader = request.headers.get('cookie') || '';

  // Plusieurs cookies sv_session peuvent coexister dans l'en-tête : un ancien
  // scopé au domaine (Domain=.scrivaelo.com, signé avec l'ancien ACCESS_SECRET)
  // et le nouveau, host-only. .match() ne renvoyait que le PREMIER : si le
  // périmé arrivait en tête, la vérification échouait et l'utilisateur était
  // renvoyé vers la connexion, qui reposait un cookie... toujours placé en
  // second. D'où une boucle de connexion infinie.
  //
  // On accepte donc si AU MOINS UN des cookies présents est valide.
  // Correctif porté depuis scrivaelo-site (a653147), où il était déjà appliqué.
  const _toks = [...cookieHeader.matchAll(/(?:^|;\s*)sv_session=([^;]+)/g)].map(x => x[1]);
  for (const _t of _toks) {
    if (await verifyCookie(_t, secret)) return; // cookie valide → pass-through
  }

  const url = new URL(request.url);
  const next = url.pathname + url.search;
  return Response.redirect('https://scrivaelo.com/login/?app_redirect=1&next=' + encodeURIComponent(next), 302);
}