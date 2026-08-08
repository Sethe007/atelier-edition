import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

// NON-RÉGRESSION — espace après le point recollé (7 août).
//
// Signalé sur « C'était de l'orgueil.De l'égoïsme. » L'espace n'était pas
// ajouté, et s'il était ajouté à la main il était aussitôt retiré.
//
// Cause : une règle recollait A POSTERIORI tout « . xx » dont xx figurait dans
// une liste d'extensions de domaine — en IGNORANT LA CASSE (drapeau i). Or
// « de » y figure (Allemagne). Les 15 extensions étaient concernées : De, Net,
// Ca, Es, Ch, Co, Fr, Io, Uk, Eu, Be, Gov, Edu, Org, Com.
//
// L'espace n'était jamais ajouté parce que la règle d'espacement le posait et
// que celle-ci le retirait dans la foulée.
//
// Correctif : les vrais domaines sont MASQUÉS avant toute règle et restaurés
// à la fin. La distinction devient structurelle — un domaine est collé à son
// point et son extension est en minuscules — au lieu d'être devinée après coup.

function ctx() {
  const code = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
  const noop = () => {};
  const el = () => ({ style:{}, classList:{ add:noop, remove:noop, toggle:noop, contains:()=>false }, setAttribute:noop, appendChild:noop, addEventListener:noop, querySelector:()=>null, querySelectorAll:()=>[], dataset:{}, insertAdjacentHTML:noop, remove:noop });
  const s = { console, setTimeout:noop, clearTimeout:noop, setInterval:noop, clearInterval:noop, requestAnimationFrame:noop,
    localStorage:{ _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} },
    navigator:{ language:'fr', languages:['fr'], storage:{} }, location:{ href:'', search:'', pathname:'/' },
    document:{ getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[], addEventListener:noop, createElement:el, head:{appendChild:noop}, body:{appendChild:noop, classList:{add:noop,remove:noop}}, documentElement:{setAttribute:noop, style:{setProperty:noop, removeProperty:noop}}, readyState:'complete', cookie:'' },
    indexedDB:{ open:()=>({}) }, fetch:()=>Promise.reject(new Error('x')),
    XMLHttpRequest:function(){ this.open=noop; this.send=noop; this.setRequestHeader=noop; },
    crypto:{ subtle:{} }, alert:noop, confirm:()=>true, prompt:()=>null };
  s.window = s; s.self = s; s.globalThis = s;
  vm.createContext(s);
  try { vm.runInContext(code, s, { filename:'legacy-bundle.js' }); } catch (e) {}
  return s;
}
const S = ctx();
const P = { enabled:true, lang:'fr', quotes:true, punctuation:true, repetitions:true, dblSpaces:true,
  trailingSpaces:true, pluralNoun:true, pluralVerb:true, pluralAdj:true, capitals:true, spell:true,
  participes:true, ellipsis:true, apostrophes:true };
const run = (t) => S.SafeCorrectionEngine.applyAll(t, P);

describe('Ponctuation — espace après le point', () => {
  it('le cas signalé est corrigé', () => {
    expect(run('C’était de l’orgueil.De l’égoïsme.')).toContain('orgueil. De');
  });
  it('l\'espace posé à la main est CONSERVÉ', () => {
    const t = 'C’était de l’orgueil. De l’égoïsme.';
    expect(run(t)).toBe(t);
  });
  it('idempotence : deux passes donnent le même résultat', () => {
    const a = run('C’était de l’orgueil.De l’égoïsme.');
    expect(run(a)).toBe(a);
  });

  const EXT = ['com','fr','net','org','io','co','uk','de','es','eu','be','ch','ca','gov','edu'];
  for (const e of EXT) {
    const mot = e.charAt(0).toUpperCase() + e.slice(1);
    it(`« ${mot} » en début de phrase n'est pas recollé au point`, () => {
      expect(run('Il se tut. ' + mot + ' fut la fin.')).toContain('. ' + mot);
    });
  }
});

describe('Ponctuation — les vrais domaines restent intacts', () => {
  for (const d of ['scrivaelo.com','example.fr','site.net','mon-site.org','test.io','a.co']) {
    it(`${d} n'est pas disloqué`, () => {
      expect(run('Rendez-vous sur ' + d + ' demain.')).toContain(d);
    });
  }
  it('une adresse électronique reste intacte', () => {
    expect(run('Écrivez à contact@scrivaelo.com.')).toContain('contact@scrivaelo.com');
  });
  it('une URL complète reste intacte', () => {
    expect(run('Voir https://scrivaelo.com/app pour la suite.')).toContain('https://scrivaelo.com/app');
  });
  it('plusieurs domaines dans la même phrase', () => {
    const o = run('Comparez example.fr et scrivaelo.com aujourd’hui.');
    expect(o).toContain('example.fr');
    expect(o).toContain('scrivaelo.com');
  });
});

describe('Ponctuation — cas voisins non régressés', () => {
  it('nombre décimal', () => { expect(run('Le prix est de 3.14 euros.')).toContain('3.14'); });
  it('abréviation', () => { expect(run('M. Dupont arriva.')).toContain('M. Dupont'); });
  it('ellipse', () => { expect(run('Il hésita...Puis il partit.')).toContain('... Puis'); });
  it('numéro de chapitre', () => { expect(run('Chapitre 1.Le départ.')).toContain('1. Le'); });
  it('guillemets français', () => {
    const t = '« Non. » Elle recula.';
    expect(run(t)).toBe(t);
  });
});

describe('Ponctuation — le recollage a posteriori a disparu', () => {
  const src = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
  it('plus aucune règle ne recolle « . extension » après coup', () => {
    expect(/\\\. \(com\|fr\|net/.test(src)).toBe(false);
  });
  it('les domaines sont masqués avant traitement', () => {
    const i = src.indexOf('applyPunctuation(text, lang)');
    expect(src.slice(i, i + 1800).includes('_domaines')).toBe(true);
  });
  it('et restaurés à la sortie', () => {
    const i = src.indexOf('applyPunctuation(text, lang)');
    expect(src.slice(i, i + 4000).includes('_restaurerDomaines')).toBe(true);
  });
});
