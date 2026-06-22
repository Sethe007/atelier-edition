// ══════════════════════════════════════════════════════════════════════════════
//  Scrivaelo — API d'activation de session
//  Vercel Serverless Function (Edge Runtime)
//
//  Usage Phase 1 (codes d'accès) :
//    GET  /api/auth/activate?code=VOTRE_CODE
//    → Valide le code, pose un cookie sv_session 30j, redirige vers /
//
//  Usage Phase 2 (LemonSqueezy) :
//    Remplacer validateCode() par un appel à l'API LemonSqueezy :
//    POST https://api.lemonsqueezy.com/v1/licenses/validate
//    → body: { license_key: code }
//    → si valide : même logique de cookie
//
//  Variables d'environnement Vercel requises :
//    ACCESS_SECRET   — clé secrète pour signer les cookies (chaîne aléatoire longue)
//    ACCESS_CODES    — codes d'accès valides, séparés par virgule (Phase 1 seulement)
//    LEMON_API_KEY   — clé API LemonSqueezy (Phase 2)
// ══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SESSION_DURATION_MS  = 30 * 24 * 60 * 60 * 1000; // 30 jours
const SESSION_DURATION_SEC = 30 * 24 * 60 * 60;

/** Génère un token de session signé HMAC-SHA256 */
async function generateSessionToken(secret, userId = 'subscriber') {
  const payload = btoa(JSON.stringify({
    sub: userId,
    iat: Date.now(),
    exp: Date.now() + SESSION_DURATION_MS,
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${payload}.${sig}`;
}

// ── Phase 1 : validation par code d'accès ─────────────────────────────────

async function validateCode(code) {
  const validCodes = (process.env.ACCESS_CODES || '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

  if (!validCodes.length) return { valid: false, error: 'Aucun code configuré (ACCESS_CODES manquant)' };
  if (!validCodes.includes(code)) return { valid: false, error: 'Code invalide ou expiré' };

  return { valid: true, userId: 'beta-user' };
}

// ── Phase 2 (à décommenter quand LemonSqueezy est prêt) ───────────────────

/*
async function validateLemonSqueezy(licenseKey) {
  const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LEMON_API_KEY}`,
    },
    body: JSON.stringify({ license_key: licenseKey }),
  });
  const data = await res.json();
  if (!data.valid) return { valid: false, error: 'Licence invalide ou expirée' };
  return { valid: true, userId: data.meta?.customer_email || licenseKey };
}
*/

// ── Handler principal ──────────────────────────────────────────────────────

export default async function handler(request) {
  const url    = new URL(request.url);
  const code   = url.searchParams.get('code')?.trim();
  const secret = process.env.ACCESS_SECRET;

  // Vérifications préliminaires
  if (!secret) {
    return new Response('Configuration manquante (ACCESS_SECRET)', { status: 500 });
  }
  if (!code) {
    return new Response(
      JSON.stringify({ error: 'Paramètre code manquant. Usage : /api/auth/activate?code=VOTRE_CODE' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Valider le code (Phase 1) — remplacer par validateLemonSqueezy(code) en Phase 2
  const result = await validateCode(code);

  if (!result.valid) {
    // Rediriger vers scrivaelo.com avec un message d'erreur
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `https://scrivaelo.com/?auth_error=${encodeURIComponent(result.error)}&app_redirect=1`,
      },
    });
  }

  // Générer le token de session
  const token = await generateSessionToken(secret, result.userId);

  // Cookie sur .scrivaelo.com (accessible par app. ET scrivaelo.com)
  const cookieValue = [
    `sv_session=${token}`,
    'Path=/',
    'Domain=.scrivaelo.com',
    `Max-Age=${SESSION_DURATION_SEC}`,
    'Secure',
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');

  // Rediriger vers l'app après avoir posé le cookie
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': cookieValue,
    },
  });
}
