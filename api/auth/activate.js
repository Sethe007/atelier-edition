export const config = { runtime: 'edge' };

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function validateSupabaseToken(token) {
  const url  = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return { valid: false, reason: 'missing_env' };
  try {
    const r = await fetch(url + '/auth/v1/user', {
      headers: { 'Authorization': 'Bearer ' + token, 'apikey': anon },
    });
    if (!r.ok) return { valid: false, reason: 'supabase_' + r.status };
    const user = await r.json();
    if (!user?.id) return { valid: false, reason: 'no_user_id' };
    return { valid: true, userId: user.id };
  } catch(e) {
    return { valid: false, reason: 'fetch_error' };
  }
}

export default async function handler(request) {
  const _q = new URL(request.url).searchParams;
  const _form = request.method === 'POST' ? await request.formData() : null;
  const _get = (k) => _form ? (_form.get(k) || '').toString() : (_q.get(k) || '');
  const token   = _get('token').trim();
  const rawNext = _get('next') || '/';
  const next    = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  const secret  = process.env.ACCESS_SECRET;

  const fail = (msg) => Response.redirect(
    'https://scrivaelo.com/login/?auth_error=' + encodeURIComponent(msg) +
    '&app_redirect=1&next=' + encodeURIComponent(next), 302
  );

  if (!token)  return fail('missing_token');
  if (!secret) return fail('server_misconfigured');

  const result = await validateSupabaseToken(token);
  if (!result.valid) return fail(result.reason || 'invalid_token');

  const ts  = String(Date.now());
  const sig = await hmac(secret, result.userId + ':' + ts);
  const sv  = result.userId + '.' + ts + '.' + sig;

  const headers = new Headers();
  headers.set('Location', 'https://app.scrivaelo.com' + next);
  headers.set('Set-Cookie',
    'sv_session=' + sv +
    '; Domain=.scrivaelo.com; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly'
  );
  return new Response(null, { status: 302, headers });
}