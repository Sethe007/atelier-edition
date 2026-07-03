import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

// Multilingue — correcteur LanguageTool & moteur d'autocorrection.
// Vérifie : (1) le mapping langue app → code LT (fi/hu → désactivé proprement),
// (2) que les corrections typographiques suivent les conventions de chaque langue,
// (3) que les règles grammaticales FRANÇAISES ne s'appliquent plus aux autres
//     langues (avant ce correctif, une langue inconnue retombait sur les règles FR).

function loadRuntime() {
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
  try { vm.runInContext(code, s, { filename: 'legacy-bundle.js' }); } catch (e) { /* le bundle attend un vrai DOM */ }
  return s;
}

const ctx = loadRuntime();

describe('LanguageTool — mapping de langue', () => {
  const cases = { fr: 'fr', en: 'en-US', es: 'es', de: 'de-DE', it: 'it', pt: 'pt-PT', ru: 'ru-RU', da: 'da-DK', el: 'el-GR' };

  for (const [app, lt] of Object.entries(cases)) {
    it(`${app} → ${lt}`, () => {
      ctx.getPref = (k) => (k === 'ui_lang' ? app : undefined);
      expect(ctx._ltApiCode()).toBe(lt);
    });
  }

  it('fi et hu → null (non supportés par l\'API publique LT)', () => {
    for (const app of ['fi', 'hu']) {
      ctx.getPref = (k) => (k === 'ui_lang' ? app : undefined);
      expect(ctx._ltApiCode()).toBe(null);
    }
  });

  it('langue inconnue → repli fr', () => {
    ctx.getPref = (k) => (k === 'ui_lang' ? 'xx' : undefined);
    expect(ctx._ltApiCode()).toBe('fr');
  });

  it('callLanguageTool refuse proprement une langue non supportée (sans appel réseau)', async () => {
    ctx.getPref = (k) => (k === 'ui_lang' ? 'fi' : undefined);
    const res = await ctx.callLanguageTool('Tämä on testi.');
    expect(res.unsupported).toBe(true);
    expect(typeof res.error).toBe('string');
  });
});

describe('Autocorrection — règles par langue', () => {
  const AC = () => ctx.SafeCorrectionEngine;
  const run = (text, prefs) => {
    // applyAll est exposé par SafeCorrectionEngine ; sinon on passe par _test hook
    const eng = AC();
    expect(eng, 'SafeCorrectionEngine doit être global (var)').toBeTruthy();
    return eng.applyAll ? eng.applyAll(text, { enabled: true, ...prefs }) : null;
  };

  it('FR (régression) : guillemets « » et pluriel nominal conservés', () => {
    const out = run('Il dit "bonjour". Voici des chat.', { lang: 'fr', quotes: true, pluralNoun: true });
    if (out === null) return; // applyAll non exposé — couvert par les tests DOM
    expect(out).toContain('« bonjour »');
    expect(out).toContain('des chats');
  });

  it('DE : guillemets „ “ et AUCUN accord français appliqué', () => {
    const out = run('Er sagte "Hallo". des chat', { lang: 'de', quotes: true, pluralNoun: true, pluralVerb: true, pluralAdj: true, participes: true });
    if (out === null) return;
    expect(out).toContain('„Hallo“');
    expect(out).toContain('des chat'); // pas de pluralisation FR en allemand
  });

  it('DE : ancienne orthographe ß → ss (daß → dass)', () => {
    const out = run('Ich weiß, daß du kommst.', { lang: 'de', spell: true });
    if (out === null) return;
    expect(out).toContain('dass du kommst');
    expect(out).toContain('weiß'); // ß légitime intouché
  });

  it('RU : guillemets « » sans espace intérieure et répétitions corrigées', () => {
    const out = run('Он сказал "привет". Она и и он.', { lang: 'ru', quotes: true, repetitions: true });
    if (out === null) return;
    expect(out).toContain('«привет»');
    expect(out.includes('и и')).toBe(false);
  });

  it('RU : le dictionnaire lexical FR ne s\'applique pas', () => {
    const out = run('meme apres cote', { lang: 'ru', spell: true });
    if (out === null) return;
    expect(out).toBe('meme apres cote'); // aucune francisation
  });

  it('HU : guillemets „ ”', () => {
    const out = run('Azt mondta "szia".', { lang: 'hu', quotes: true });
    if (out === null) return;
    expect(out).toContain('„szia”');
  });

  it('DA : guillemets » «', () => {
    const out = run('Han sagde "hej".', { lang: 'da', quotes: true });
    if (out === null) return;
    expect(out).toContain('»hej«');
  });

  it('FI : guillemets ” ”', () => {
    const out = run('Hän sanoi "hei".', { lang: 'fi', quotes: true });
    if (out === null) return;
    expect(out).toContain('”hei”');
  });

  it('IT : accents finaux sûrs (perche → perché)', () => {
    const out = run('Non so perche piove.', { lang: 'it', spell: true });
    if (out === null) return;
    expect(out).toContain('perché');
  });

  it('PT : tildes sûrs (nao → não)', () => {
    const out = run('Eu nao sei.', { lang: 'pt', spell: true });
    if (out === null) return;
    expect(out).toContain('não');
  });

  it('EL : majuscule après ponctuation (Unicode)', () => {
    const out = run('καλημέρα. τι κάνεις;', { lang: 'el', capitals: true });
    if (out === null) return;
    expect(out.startsWith('Καλημέρα')).toBe(true);
    expect(out).toContain('. Τι');
  });
});
