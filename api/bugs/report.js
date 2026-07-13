// api/bugs/report.js — Réception des reports de bugs (dashboard site + app).
// Auth : Bearer token Supabase (dashboard) OU cookie sv_session HMAC (app).
// Crée le ticket en BDD (service role) puis un post dans le forum Discord.
export const config = { runtime: 'edge' };

const CATEGORIES = ['editeur', 'export', 'projets', 'compte', 'performance', 'autre'];
const SEVERITES = ['bloquant', 'majeur', 'mineur'];
const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'da', 'el', 'fi', 'hu'];
const MAX_PAR_HEURE = 5;

// Alias possibles des noms de tags Discord par langue (comparés normalisés :
// minuscules, sans accents). Le forum utilise un tag par langue.
const LANG_TAG_ALIASES = {
  fr: ['francais', 'french', 'fr'],
  en: ['english', 'anglais', 'en'],
  es: ['espanol', 'spanish', 'espagnol', 'es'],
  de: ['deutsch', 'german', 'allemand', 'de'],
  it: ['italiano', 'italian', 'italien', 'it'],
  pt: ['portugues', 'portuguese', 'portugais', 'pt'],
  ru: ['русскии', 'русский', 'russian', 'russe', 'ru'],
  da: ['dansk', 'danish', 'danois', 'da'],
  el: ['ελληνικα', 'greek', 'grec', 'el'],
  fi: ['suomi', 'finnish', 'finnois', 'fi'],
  hu: ['magyar', 'hungarian', 'hongrois', 'hu'],
};

// ── Helpers auth (mêmes primitives que api/auth/activate.js) ──
async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}

async function verifySvSession(value, secret) {
  const parts = (value || '').split('.');
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  if (Date.now() - Number(ts) > 30 * 24 * 60 * 60 * 1000) return null;
  const expected = await hmac(secret, userId + ':' + ts);
  return timingSafeEqual(expected, sig) ? userId : null;
}

// Renvoie le userId authentifié, ou null.
async function authenticate(request) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const auth = request.headers.get('authorization') || '';

  // 1) Token Supabase (dashboard du site)
  if (auth.startsWith('Bearer ') && url && anon) {
    try {
      const r = await fetch(url + '/auth/v1/user', {
        headers: { Authorization: auth, apikey: anon },
      });
      if (r.ok) {
        const u = await r.json();
        if (u?.id) return u.id;
      }
    } catch { /* ignore */ }
    return null;
  }

  // 2) Cookie sv_session signé (app embarquée sous /app/)
  const secret = process.env.ACCESS_SECRET;
  const cookie = getCookie(request, 'sv_session');
  if (secret && secret !== 'dev' && cookie) {
    return await verifySvSession(cookie, secret);
  }
  return null;
}

// ── Supabase REST (service role) ──
function sb(path, init = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fetch(url + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

// ── Discord REST ──
function discord(path, init = {}) {
  return fetch('https://discord.com/api/v10' + path, {
    ...init,
    headers: {
      Authorization: 'Bot ' + process.env.DISCORD_BOT_TOKEN,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

export default async function handler(request) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(503, { error: 'server_misconfigured' });
  }

  const userId = await authenticate(request);
  if (!userId) return json(401, { error: 'unauthorized' });

  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'invalid_json' }); }

  const title = String(body.title || '').trim().slice(0, 120);
  const description = String(body.description || '').trim().slice(0, 4000);
  const category = CATEGORIES.includes(body.category) ? body.category : 'autre';
  const severity = SEVERITES.includes(body.severity) ? body.severity : 'mineur';
  const source = body.source === 'app' ? 'app' : 'site';
  const lang = LANGS.includes(body.lang) ? body.lang : 'fr';
  const context = String(body.context || '').slice(0, 500);
  if (title.length < 3 || description.length < 10) return json(400, { error: 'invalid_fields' });

  // Anti-spam : max MAX_PAR_HEURE tickets / heure / utilisateur
  try {
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const rc = await sb(`bug_reports?user_id=eq.${userId}&created_at=gte.${since}&select=id&limit=${MAX_PAR_HEURE + 1}`);
    if (rc.ok) {
      const rows = await rc.json();
      if (rows.length >= MAX_PAR_HEURE) return json(429, { error: 'too_many_reports' });
    }
  } catch { /* non bloquant */ }

  // Profil (pour le post Discord)
  let prof = {};
  try {
    const pr = await sb(`profiles?id=eq.${userId}&select=name,email`);
    if (pr.ok) prof = (await pr.json())[0] || {};
  } catch { /* non bloquant */ }

  // Insertion du ticket
  const ins = await sb('bug_reports', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, title, description, category, severity, source, lang, status: 'nouveau' }),
  });
  if (!ins.ok) return json(500, { error: 'db_insert_failed' });
  const ticket = (await ins.json())[0];

  // Post dans le forum Discord (best effort : le ticket existe même si Discord échoue)
  let discordOk = false;
  try {
    const chanId = process.env.DISCORD_FORUM_CHANNEL_ID;
    if (chanId && process.env.DISCORD_BOT_TOKEN) {
      // Tags : le forum exige au moins un tag → tag de la LANGUE de l'utilisateur
      // (+ tag « Nouveau » s'il existe). Filet de sécurité : premier tag disponible.
      let appliedTags = [];
      try {
        const ch = await discord('/channels/' + chanId);
        if (ch.ok) {
          const chan = await ch.json();
          const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
          const tags = chan.available_tags || [];
          const aliases = (LANG_TAG_ALIASES[lang] || []).map(norm);
          const langTag = tags.find(t => aliases.includes(norm(t.name)))
            || tags.find(t => aliases.some(a => a.length > 2 && norm(t.name).includes(a)));
          const newTag = tags.find(t => norm(t.name) === 'nouveau');
          if (langTag) appliedTags.push(langTag.id);
          if (newTag && newTag.id !== (langTag && langTag.id)) appliedTags.push(newTag.id);
          if (!appliedTags.length && tags.length) appliedTags.push(tags[0].id);
        }
      } catch { /* non bloquant */ }

      const sevEmoji = { bloquant: '🔴', majeur: '🟠', mineur: '🟡' }[severity];
      const sevColor = { bloquant: 0xdc2626, majeur: 0xea580c, mineur: 0xeab308 }[severity];
      const payload = {
        name: `[${ticket.id.slice(0, 8)}] ${title}`.slice(0, 100),
        auto_archive_duration: 10080,
        ...(appliedTags.length ? { applied_tags: appliedTags.slice(0, 5) } : {}),
        message: {
          embeds: [{
            title,
            description,
            color: sevColor,
            fields: [
              { name: 'Catégorie', value: category, inline: true },
              { name: 'Gravité', value: `${sevEmoji} ${severity}`, inline: true },
              { name: 'Source', value: source === 'app' ? 'Application' : 'Site', inline: true },
              { name: 'Langue', value: lang.toUpperCase(), inline: true },
              { name: 'Auteur', value: `${prof.name || '—'} (${prof.email || userId})` },
              ...(context ? [{ name: 'Contexte', value: context.slice(0, 1000) }] : []),
              { name: 'Ticket', value: '`' + ticket.id + '`' },
            ],
            timestamp: new Date().toISOString(),
          }],
        },
      };
      const th = await discord(`/channels/${chanId}/threads`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (th.ok) {
        const thread = await th.json();
        await sb(`bug_reports?id=eq.${ticket.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ discord_thread_id: thread.id }),
        });
        discordOk = true;
      }
    }
  } catch { /* non bloquant */ }

  return json(200, { ok: true, id: ticket.id, status: ticket.status, discord: discordOk });
}
