import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

// L'autocorrection ne doit JAMAIS modifier les balises internes de l'app
// ([IMAGE:], [NOTE:], [HL:], [TAG:]). La règle FR « espace insécable avant : »
// cassait [IMAGE:nom] -> [IMAGE :nom], et la prévisualisation affichait le texte
// brut au lieu de l'image. Ce test garantit que les balises passent intactes.

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
const FR = { enabled: true, lang: 'fr', quotes: true, punctuation: true, repetitions: true,
  dblSpaces: true, pluralNoun: true, pluralVerb: true, pluralAdj: true, capitals: true,
  spell: true, participes: true, ellipsis: true };
const run = (t) => ctx.SafeCorrectionEngine.applyAll(t, FR);

describe('Autocorrection — protection des balises internes', () => {
  it('[IMAGE:nom] reste intact (pas d\'espace avant les deux-points)', () => {
    const out = run('Voici la scène.\n\n[IMAGE:chateau]\n\nLa suite du récit.');
    expect(out.includes('[IMAGE:chateau]')).toBe(true);
    expect(out.includes('[IMAGE  :chateau]') || out.includes('[IMAGE :chateau]') || out.includes('[IMAGE :chateau]')).toBe(false);
  });

  it('[NOTE:], [HL:], [TAG:] restent intacts', () => {
    const out = run('[NOTE:idée à creuser]\n[HL:jaune passage clé]\n[TAG:perso Jean]');
    expect(out.includes('[NOTE:idée à creuser]')).toBe(true);
    expect(out.includes('[HL:jaune passage clé]')).toBe(true);
    expect(out.includes('[TAG:perso Jean]')).toBe(true);
  });

  it('le texte HORS balises est toujours corrigé (espace avant : ajouté)', () => {
    const out = run('Il dit ceci: bonjour [IMAGE:x] et voila');
    expect(out.includes('ceci :')).toBe(true);   // correction FR appliquée hors balise
    expect(out.includes('[IMAGE:x]')).toBe(true);      // balise préservée
  });

  it('plusieurs balises sur des lignes distinctes', () => {
    const out = run('[IMAGE:a]\n\n[IMAGE:b]\n\n[IMAGE:c]');
    expect(out.includes('[IMAGE:a]') && out.includes('[IMAGE:b]') && out.includes('[IMAGE:c]')).toBe(true);
  });
});
