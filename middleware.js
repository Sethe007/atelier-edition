// ══════════════════════════════════════════════════════════════════════════════
//  Scrivaelo — Edge Middleware d'authentification
//  Vercel Edge Runtime (s'exécute avant chaque requête, côté CDN)
//
//  Flux :
//    1. Requête entrante → vérifier le cookie sv_session
//    2. Cookie absent ou invalide → rediriger vers scrivaelo.com/login/
//    3. Cookie valide → laisser passer vers l'app
//
//  Phase 2 (LemonSqueezy) : le cookie est posé par /api/auth/activate
//  après validation d'une license key. Aucun changement ici.
// ══════════════════════════════════════════════════════════════════════════════

export const config = {
  // Protège toutes les routes sauf : API tinterne, assets Vite, favicon
  matcher: ['/((?!api/|_vercel|favicon\\.svg|assets/).*)'],
};

/**
 * Vérifie la signature HMAC-SHA256 du token de session.
 * Format : base64url(json_payload).base64url(hmac_signature)
 */
async function verifySessionToken(token, secret) {
  try {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) return false;

    const payload = token.slice(0, dotIdx);
    const sigB64  = token.slice(dotIdx + 1);

    // Décoder le payload JSON
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));

    // Vérifier l'expiration
    if (!data.exp || data.exp < Date.now()) return false;

    // Importer la clé HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Décoder la signature
    const sigBytes = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    return await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

export default async function middleware(request) {
  const secret = process.env.ACCESS_SECRET;

  // Dev local sans secret configuré → laisser passer
  if (!secret || secret === 'dev') {
    return new Response(null, { status: 200, headers: { 'x-middleware-next': '1' } });
  }

  // Extraire sv_session depuis les cookies
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)sv_session=([^.]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;

  if (token && await verifySessionToken(token, secret)) {
    // ✅ Session valide — accàs autorisé
    return new Response(null, { status: 200, headers: { 'x-middleware-next': '1' } });
  }

  // ❌ Pas de session ou expirée → rediriger directement vers le formulaire de login
  const nextPath = new URL(request.url).pathname;
  const redirectUrl = `https://scrivaelo.com/login/?app_redirect=1&next=${encodeURIComponent(nextPath)}`;

  const headers = new Headers({ 'Location': redirectUrl });

  // Effacer le cookie invalide
  if (token) {
    headers.append(
      'Set-Cookie',
      'sv_session=; Path=/; Domain=.scrivaelo.com; Max-Age=0; Secure; HttpOnly; SameSite=Lax'
    );
  }

  return new Response(null, { status: 302, headers });
}
