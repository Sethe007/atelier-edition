import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

// NON-RÉGRESSION — piège du \b JavaScript sur les mots à finale accentuée.
//
// \b s'appuie sur \w = [A-Za-z0-9_], qui EXCLUT les lettres accentuées. Les
// motifs « \\b(det)\\s+([a-zA-ZÀ-ž]{3,})\\b » coupaient donc le mot
// avant son accent final : « malgré » était capturé « malgr », pluralisé en
// « malgrs », et l'accent restait derrière -> « malgrsé ».
//
// Conséquence la plus grave : les gardes d'invariabilité comparaient le
// FRAGMENT tronqué aux listes de mots invariables. « malgré » y figurait bien,
// mais « malgr » non : toutes les protections étaient silencieusement
// contournées. Corrigé le 2026-08-06 par des frontières Unicode explicites
// (lookarounds \p{L} + drapeau u).

function loadCtx() {
  const code = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
  const noop = () => {};
  const el = () => ({ style:{}, classList:{ add:noop, remove:noop, toggle:noop, contains:()=>false }, setAttribute:noop, appendChild:noop, addEventListener:noop, querySelector:()=>null, querySelectorAll:()=>[], dataset:{}, insertAdjacentHTML:noop, remove:noop });
  const s = {
    console, setTimeout:noop, clearTimeout:noop, setInterval:noop, clearInterval:noop, requestAnimationFrame:noop,
    localStorage:{ _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} },
    navigator:{ language:'fr', languages:['fr'], storage:{} },
    location:{ href:'', search:'', pathname:'/' },
    document:{ getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[], addEventListener:noop, createElement:el, head:{appendChild:noop}, body:{appendChild:noop, classList:{add:noop,remove:noop}}, documentElement:{setAttribute:noop, style:{}}, readyState:'complete', cookie:'' },
    indexedDB:{ open:()=>({}) }, fetch:()=>Promise.reject(new Error('no-net')),
    XMLHttpRequest:function(){ this.open=noop; this.send=noop; this.setRequestHeader=noop; },
    crypto:{ subtle:{} }, alert:noop, confirm:()=>true, prompt:()=>null,
  };
  s.window = s; s.self = s; s.globalThis = s;
  vm.createContext(s);
  try { vm.runInContext(code, s, { filename:'legacy-bundle.js' }); } catch (e) {}
  return s;
}
const ctx = loadCtx();
const P = { enabled:true, lang:'fr', quotes:true, punctuation:true, repetitions:true,
  dblSpaces:true, trailingSpaces:true, pluralNoun:true, pluralVerb:true, pluralAdj:true,
  capitals:true, spell:true, participes:true, ellipsis:true };
const run = (t) => ctx.SafeCorrectionEngine.applyAll(t, P);

describe('AC — mots à finale accentuée après un déterminant pluriel', () => {
  const CAS = [
    ['Il partit les malgré lui.',        'malgrsé'],
    ['Elle vint les déjà prête.',        'déjsà'],
    ['Tous les excepté deux.',           'exceptsé'],
    ['Ils restèrent les auprès du feu.', 'auprsès'],
    ['Les dès le matin partirent.',      'dsès'],
  ];
  for (const [phrase, corruption] of CAS) {
    it(`« ${phrase} » ne produit pas « ${corruption} »`, () => {
      expect(run(phrase).includes(corruption)).toBe(false);
    });
  }
});

describe('AC — adverbes invariables jamais pluralisés', () => {
  const ADV = ['aussitôt','bientôt','tôt','debout','plutôt','partout','ailleurs','ainsi','encore'];
  for (const a of ADV) {
    it(`« les ${a} » reste intact`, () => {
      const out = run(`Ils arrivèrent les ${a} ensemble.`);
      expect(out.includes(a + 's')).toBe(false);
      expect(out.includes(a)).toBe(true);
    });
  }
});

describe('AC — la règle d\'accord reste fonctionnelle', () => {
  it('pluralise toujours un vrai nom', () => {
    expect(run('les chien dort').toLowerCase()).toContain('chiens');
  });
  it('pluralise toujours après « des »', () => {
    expect(run('des maison neuve').toLowerCase()).toContain('maisons');
  });
  it('idempotence : deux passes donnent le même résultat', () => {
    for (const [p] of [['Il partit les malgré lui.'],['les chien dort'],['Ils vinrent les aussitôt après.']]) {
      expect(run(run(p))).toBe(run(p));
    }
  });
});
