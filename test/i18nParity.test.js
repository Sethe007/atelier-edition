import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

// Parité i18n : chaque langue doit couvrir toutes les clés définies en français.
// Empêche qu'une clé ajoutée en FR (ou EN) soit oubliée dans une autre langue et
// retombe silencieusement sur le repli (langue -> en -> fr). Charge le _i18n RUNTIME
// (tous les mécanismes : littéraux, Object.assign tardifs, _registerLang).

const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'da', 'el', 'fi', 'hu'];

// Clés volontairement absentes de certaines langues (à documenter ici si besoin).
// clé -> [langues autorisées à ne PAS l'avoir]. Vide = parité stricte attendue.
const ALLOW_MISSING = {};

function loadRuntimeI18n() {
  const code = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
  const noop = () => {};
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, setAttribute: noop, appendChild: noop, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], dataset: {}, insertAdjacentHTML: noop, remove: noop });
  const s = {
    console, setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    localStorage: { _d: {}, getItem(k){return this._d[k] ?? null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} },
    navigator: { language: 'fr', languages: ['fr'], storage: {} },
    location: { href: '', search: '', pathname: '/' },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, createElement: el, head: { appendChild: noop }, body: { appendChild: noop, classList: { add: noop, remove: noop } }, documentElement: { setAttribute: noop, style: {} }, readyState: 'complete', cookie: '' },
    indexedDB: { open: () => ({}) }, fetch: () => Promise.reject(new Error('no-net')),
    XMLHttpRequest: function(){ this.open = noop; this.send = noop; this.setRequestHeader = noop; },
    crypto: { subtle: {} }, alert: noop, confirm: () => true, prompt: () => null,
  };
  s.window = s; s.self = s; s.globalThis = s;
  vm.createContext(s);
  try { vm.runInContext(code, s, { filename: 'legacy-bundle.js' }); } catch (e) { /* le bundle attend un vrai DOM ; l'objet _i18n est peuplé avant tout crash UI */ }
  return s._i18n || {};
}

describe('i18n — parité des clés entre langues', () => {
  const i18n = loadRuntimeI18n();
  const objOf = (l) => (i18n[l] && typeof i18n[l] === 'object') ? i18n[l] : {};
  const frKeys = Object.keys(objOf('fr'));

  it('le catalogue français n\'est pas vide', () => {
    expect(frKeys.length).toBeGreaterThanOrEqual(500);
  });

  for (const lang of LANGS) {
    if (lang === 'fr') continue;
    it(`« ${lang} » couvre toutes les clés du français`, () => {
      const has = objOf(lang);
      const missing = frKeys.filter(k => !(k in has) && !(ALLOW_MISSING[k] && ALLOW_MISSING[k].includes(lang)));
      expect(missing, `clés manquantes en ${lang} : ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '…' : ''}`).toEqual([]);
    });
  }
});
