import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// NON-RÉGRESSION — boucle de connexion infinie (P0-5).
//
// Plusieurs cookies sv_session peuvent coexister : un ancien scopé au domaine
// (Domain=.scrivaelo.com, signé avec l'ancien ACCESS_SECRET) et le nouveau,
// host-only. .match() ne renvoyait que le PREMIER. Si le périmé arrivait en
// tête, la vérification échouait, l'utilisateur était renvoyé vers la
// connexion, qui reposait un cookie... toujours placé en second. Boucle.
//
// Le correctif existait déjà côté scrivaelo-site mais n'avait jamais été
// propagé ici. Ces tests verrouillent le comportement dans les deux dépôts.

process.env.ACCESS_SECRET = 'secret-de-test';
const SECRET = 'secret-de-test';

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function cookieValide(userId = 'u-123') {
  const ts = String(Date.now());
  return `${userId}.${ts}.${await hmac(SECRET, userId + ':' + ts)}`;
}
const COOKIE_PERIME = 'u-999.1700000000000.ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

const { default: middleware } = await import('../middleware.js');
const appel = (cookie) => middleware(new Request('https://app.scrivaelo.com/projet', {
  headers: cookie ? { cookie } : {},
}));

describe('Middleware — cookies sv_session multiples', () => {
  it('un cookie valide seul laisse passer', async () => {
    const r = await appel('sv_session=' + await cookieValide());
    expect(r === undefined).toBe(true);
  });

  it('CAS DU BUG : cookie périmé en PREMIER, valide en second -> laisse passer', async () => {
    const r = await appel(`sv_session=${COOKIE_PERIME}; sv_session=${await cookieValide()}`);
    expect(r === undefined).toBe(true);
  });

  it('valide en premier, périmé en second -> laisse passer', async () => {
    const r = await appel(`sv_session=${await cookieValide()}; sv_session=${COOKIE_PERIME}`);
    expect(r === undefined).toBe(true);
  });

  it('cookie noyé parmi d\'autres cookies applicatifs -> laisse passer', async () => {
    const r = await appel(`theme=dark; sv_session=${COOKIE_PERIME}; lang=fr; sv_session=${await cookieValide()}; x=1`);
    expect(r === undefined).toBe(true);
  });

  it('aucun cookie valide -> redirection vers la connexion', async () => {
    const r = await appel('sv_session=' + COOKIE_PERIME);
    expect(r && r.status).toBe(302);
  });

  it('aucun cookie du tout -> redirection vers la connexion', async () => {
    const r = await appel(null);
    expect(r && r.status).toBe(302);
  });

  it('signature falsifiée -> redirection (pas de contournement)', async () => {
    const r = await appel('sv_session=u-123.' + Date.now() + '.' + 'a'.repeat(64));
    expect(r && r.status).toBe(302);
  });
});

describe('Middleware — parité entre les deux dépôts', () => {
  it('la lecture multi-cookies est bien en place (matchAll, pas match)', () => {
    const src = fs.readFileSync(new URL('../middleware.js', import.meta.url), 'utf8');
    expect(src.includes('matchAll')).toBe(true);
    expect(/cookieHeader\.match\(/.test(src)).toBe(false);
  });
});
