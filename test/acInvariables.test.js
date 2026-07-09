import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

// NON-RÉGRESSION — l'autocorrection ne doit JAMAIS pluraliser une préposition/
// adverbe invariable placé après un nom pluriel (« ses épaules avec » ne doit pas
// devenir « ses épaules avecs »). Bug critique déjà corrigé une fois : ce test
// verrouille le comportement en français ET dans les autres langues supportées.

function loadCtx() {
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
  try { vm.runInContext(code, s, { filename: 'legacy-bundle.js' }); } catch (e) {}
  return s;
}
const ctx = loadCtx();
const P = (lang) => ({ enabled: true, lang, quotes: true, punctuation: true, repetitions: true,
  dblSpaces: true, trailingSpaces: true, pluralNoun: true, pluralVerb: true, pluralAdj: true,
  capitals: true, spell: true, participes: true, ellipsis: true });
const run = (t, lang) => ctx.SafeCorrectionEngine.applyAll(t, P(lang));

describe('AC — les prépositions invariables ne sont jamais pluralisées', () => {
  // Cas d'origine du bug (FR)
  const FR = [
    'ses épaules avec', 'ses dés avec', 'Les vivants avec', 'les gens sans',
    'des mains pour', 'les cris sous', 'ces mots vers', 'les jours après',
    'des yeux contre', 'les bras sur', 'les pieds sous', 'les idées sans',
  ];
  for (const t of FR) {
    it(`[fr] « ${t} » ne gagne pas de s`, () => {
      const out = run(t, 'fr');
      expect(/\b(avecs|sanss|pours|pars|surs|souss|verss|aprèss|contres)\b/i.test(out)).toBe(false);
      expect(out.toLowerCase()).toContain(t.split(' ').pop().toLowerCase()); // la préposition reste intacte
    });
  }

  it('[fr] idempotence : deux passes donnent le même résultat', () => {
    for (const t of FR) {
      const a = run(t, 'fr'); const b = run(a, 'fr');
      expect(b).toBe(a);
    }
  });

  it('[fr] « avecs » saisi par erreur est corrigé en « avec »', () => {
    expect(run('ses épaules avecs', 'fr').toLowerCase()).toContain('épaules avec');
    expect(run('ses épaules avecs', 'fr').toLowerCase()).not.toContain('avecs');
  });

  // Autres langues : préposition invariable après nom pluriel
  const OTHER = {
    es: ['las manos con', 'los ojos sin', 'unas casas por'],
    it: ['le mani con', 'gli occhi senza'],
    pt: ['as mãos com', 'os olhos sem'],
    de: ['die Hände mit', 'die Augen ohne'],
    en: ['the hands with', 'the eyes without'],
  };
  for (const [lang, arr] of Object.entries(OTHER)) {
    for (const t of arr) {
      it(`[${lang}] « ${t} » — préposition non altérée`, () => {
        const out = run(t, lang);
        const prep = t.split(' ').pop();
        expect(out.toLowerCase()).toContain(prep.toLowerCase());
        expect(out.toLowerCase()).not.toContain((prep + 's').toLowerCase());
      });
    }
  }
});
