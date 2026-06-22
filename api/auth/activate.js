export const config = { runtime: 'edge' };

// Génère le cookie sv_session signé HMAC-SHA256
async function generateSessionToken(secret, userId) {
  const payload = `${userId}:${Date.now()}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${btoa(payload)}.${sigHex}`;
}

// Valide le token Supabase via l'API REST (compatible HS256 ET ECC/ES256)
async function validateSupabaseToken(token) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return { valid: false, reason: 'missing_supabase_env' };
  }

  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey,
        'Content-Type': 'application/json',
      },
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { valid: false, reason: `supabase_${resp.status}`, detail: body.slice(0, 100) };
    }
    const user = await resp.json();
    if (!user?.id) return { valid: false, reason: 'no_user_id' };
    return { valid: true, userId: user.id, email: user.email };
  } catch (err) {
    return { valid: false, reason: 'fetch_error', detail: String(err) };
  }
}

export default async function handler(request) {
  const url    = new URL(request.url);
  const token  = url.searchParams.get('token')?.trim();
  const next   = url.searchParams.get('next') || '/';
  const secret = process.env.ACCESS_SECRET;

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const errorRedirect = (msg) => {
    const dest = `https://scrivaelo.com/login/?auth_error=${encodeURIComponent(msg)}&app_redirect=1&next=${encodeURIComponent(safeNext)}`;
    return new Response(null, { status: 302, headers: { 'Location': dest } });
  };

  if (!token) return errorRedirect('missing_token');
  if (!secret) return errorRedirect('server_misconfigured');

  const result = await validateSupabaseToken(token);
  if (!result.valid) return errorRedirect(result.reason || 'invalid_token');

  const sessionToken = await generateSessionToken(secret, result.userId);
  const cookieMaxAge = 60 * 60 * 24 * 30;

  const headers = new Headers({
    'Location': `https://app.scrivaelo.com${safeNext}`,
    'Set-Cookie': [
      `sv_session=${sessionToken}`,
      'Domain=.scrivaelo.com',
      'Path=/',
      `Max-Age=${cookieMaxAge}`,
      'SameSite=Lax',
      'Secure',
      'HttpOnly',
    ].join('; '),
  });

  return new Response(null, { status: 302, headers });
}
