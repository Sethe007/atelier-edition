import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

// _pruneAutosaves : borne l'accumulation des sauvegardes automatiques dans
// localStorage. Doit conserver la clé courante + les KEEP plus récentes (par
// meta.derniereSauvegarde) et supprimer les plus anciennes — sans jamais
// toucher aux clés hors périmètre (autres que atelier_autosave_*).

function loadCtx() {
  const code = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
  const noop = () => {};
  const store = {};
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, setAttribute: noop, appendChild: noop, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], dataset: {}, insertAdjacentHTML: noop, remove: noop });
  const s = {
    console, setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    localStorage: {
      getItem(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; },
      setItem(k,v){ store[k]=String(v); },
      removeItem(k){ delete store[k]; },
      get length(){ return Object.keys(store).length; },
      key(i){ return Object.keys(store)[i] ?? null; },
    },
    navigator: { language: 'fr', languages: ['fr'], storage: {} },
    location: { href: '', search: '', pathname: '/' },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, createElement: el, head: { appendChild: noop }, body: { appendChild: noop, classList: { add: noop, remove: noop } }, documentElement: { setAttribute: noop, style: {} }, readyState: 'complete', cookie: '' },
    indexedDB: { open: () => ({}) }, fetch: () => Promise.reject(new Error('no-net')),
    XMLHttpRequest: function(){ this.open = noop; this.send = noop; this.setRequestHeader = noop; },
    crypto: { subtle: {} }, alert: noop, confirm: () => true, prompt: () => null,
  };
  // Object.keys(localStorage) est utilisé par le code -> exposer les clés énumérables
  Object.defineProperty(s.localStorage, '_store', { value: store, enumerable: false });
  s.window = s; s.self = s; s.globalThis = s;
  vm.createContext(s);
  try { vm.runInContext(code, s, { filename: 'legacy-bundle.js' }); } catch (e) {}
  return { s, store };
}

describe('_pruneAutosaves', () => {
  const { s, store } = loadCtx();

  it('la fonction est exposée', () => {
    expect(typeof s._pruneAutosaves).toBe('function');
  });

  it('conserve la courante + les 4 plus récentes, supprime le reste', () => {
    // Object.keys(localStorage) doit renvoyer les clés -> on remplit le store
    // ET on rend les clés énumérables sur l'objet localStorage.
    const seed = (name, day) => {
      const k = 'atelier_autosave_' + name;
      const v = JSON.stringify({ meta: { derniereSauvegarde: '2026-01-' + String(day).padStart(2,'0') + 'T00:00:00Z' } });
      store[k] = v; s.localStorage[k] = v;
    };
    // 6 projets, dates croissantes (p6 = plus récent)
    for (let i = 1; i <= 6; i++) seed('p' + i, i);
    // une clé hors périmètre à ne jamais toucher
    store['atelier_prefs'] = '{}'; s.localStorage['atelier_prefs'] = '{}';

    s._pruneAutosaves('atelier_autosave_p1'); // courant = p1 (le plus ancien)

    const remaining = Object.keys(store).filter(k => k.startsWith('atelier_autosave_'));
    // 4 plus récentes = p6,p5,p4,p3 ; + la courante p1 => 5 gardées, p2 supprimée
    expect(remaining.includes('atelier_autosave_p1')).toBe(true);  // courante préservée
    expect(remaining.includes('atelier_autosave_p6')).toBe(true);  // récente préservée
    expect(remaining.includes('atelier_autosave_p2')).toBe(false); // ancienne, hors courante -> supprimée
    expect(store['atelier_prefs']).toBe('{}');                      // hors périmètre intact
  });
});
