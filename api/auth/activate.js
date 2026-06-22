// ══════════════════════════════════════════════════════════════════════════════
//  Scrivaelo — API d'activation de session
//  Vercel Serverless Function (Edge Runtime)
//
//  Flux :
//    GET /api/auth/activate?token=<supabase_jwt>[&next=<path>]
//    → Vérifie le JWT Supabase (HS256 + SUPABASE_JWT_SECRET)
//    → Pose le cookie sv_session signé 30j sur .scrivaelo.com
//    → Redirige vers next (défaut : /)
//
//  Fallback Phase 2 (LemonSqueezy) :
//    GET /api/auth/activate?code=<access_code>
//    → Valide contre ACCESS_CODES (liste CSV en env var)
//    → Même logique de cookie
//
//  Variables d'environnement Vercel requises :
//    ACCESS_SECRET       — clé HMAC pour signer sv_session (chaîne aléatoire longue)
//    SUPABASE_JWT_SECRET — JWT secret du projet Supabase (Settings → API → JWT Secret)
//    ACCESS_CODES        — codes d'accès fallback, séparés par virgule (Phase 2)
// ══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SESSION_DURATION_MS  = 30 * 24 * 60 * 60 * 1000; // 30 jours
const SESSION_DURATION_SEC = 30 * 24 * 60 * 60;

/** Génère un token de session interne signé HMAC-SHA256 */
async function generateSessionToken(secret, userId) {
  const payload = btoa(JSON.stringify({
    sub: userId,
    iat: Date.now(),
    exp: Date.now() + SESSION_DURATION_MS,
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const sigBuffer = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(payload)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${payload}.${sig}`;
}

// ── Vérification JWT Supabase (HS256) ─────────────────────────────────────

async function validateSupabaseToken(token) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) return { valid: false, error: 'SUPABASE_JWT_SECRET manquant dans Vercel' };

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'Token malformé' };

    const [header, payload, signature] = parts;

    // Décoder le payload
    const data = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );

    // Vérifier l'expiration
    if (!data.exp || data.exp < Date.now() / 1000) {
      return { valid: false, error: 'Session Supabase expirée — reconnectez-vous' };
    }

    // Vérifier la signature HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const sigBytes = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify(
      'HMAC', key, sigBytes,
      new TextEncoder().encode(`${header}.${payload}`)
    );

    if (!isValid) return { valid: false, error: 'Signature invalide' };

    return { valid: true, userId: data.sub || data.email || 'user' };
  } catch (e) {
    return { valid: false, error: 'Erreur de vérification : ' + e.message };
  }
}

// ── Phase 2 : codes d'accès (LemonSqueezy ou codes manuels) ─────────────────

async function validateCode(code) {
  const validCodes = (process.env.ACCESS_CODES || '')
    .split(',').map(c => c.trim()).filter(Boolean);

  if (!validCodes.length) return { valid: false, error: 'Aucun code configuré (ACCESS_CODES manquant)' };
  if (!validCodes.includes(code)) return { valid: false, error: 'Code invalide ou expiré' };

  return { valid: true, userId: 'beta-user' };
}

// ── Handler principal ──────────────────────────────────────────────────────

export default async function handler(request) {
  const url    = new URL(request.url);
  const token  = url.searchParams.get('token')?.trim();
  const code   = url.searchParams.get('code')?.trim();
  const next   = url.searchParams.get('next') || '/';
  const secret = process.env.ACCESS_SECRET;

  if (!secret) {
    return new Response('Configuration manquante (ACCESS_SECRET)', { status: 500 });
  }

  if (!token && !code) {
    return new Response(
      JSON.stringify({ error: 'Paramètre token ou code manquant.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Valider (JWT Supabase prioritaire, sinon code fallback)
  const result = token
    ? await validateSupabaseToken(token)
    : await validateCode(code);

  if (!result.valid) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `https://scrivaelo.com/login/?auth_error=${encodeURIComponent(result.error)}&app_redirect=1`,
      },
    });
  }

  // Générer le token de session interne
  const sessionToken = await generateSessionToken(secret, result.userId);

  const cookieValue = [
    `sv_session=${sessionToken}`,
    'Path=/',
    'Domain=.scrivaelo.com',
    `Max-Age=${SESSION_DURATION_SEC}`,
    'Secure',
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');

  // Sécuriser next : uniquement chemins relatifs
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  return new Response(null, {
    status: 302,
    headers: {
      'Location': safeNext,
      'Set-Cookie': cookieValue,
    },
  });
}
