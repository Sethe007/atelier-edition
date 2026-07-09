import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

// Recherche éditeur : l'option « mot entier » (activée par défaut) ne doit matcher
// que des mots complets — « pour » ne doit PAS remonter « poursuivre »/« pourvoir ».

function loadCtx() {
  const code = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
  const noop = () => {};
  const el = () => ({ style:{}, classList:{add:noop,remove:noop,toggle:noop,contains:()=>false}, setAttribute:noop, appendChild:noop, addEventListener:noop, querySelector:()=>null, querySelectorAll:()=>[], dataset:{}, insertAdjacentHTML:noop, remove:noop, focus:noop, value:'' });
  const s = {
    console, setTimeout:noop, clearTimeout:noop, setInterval:noop, clearInterval:noop, requestAnimationFrame:noop,
    localStorage:{_d:{},getItem(k){return this._d[k]??null;},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}},
    navigator:{language:'fr',languages:['fr'],storage:{}},
    location:{href:'',search:'',pathname:'/'},
    document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:noop,createElement:el,head:{appendChild:noop},body:{appendChild:noop,classList:{add:noop,remove:noop}},documentElement:{setAttribute:noop,style:{}},readyState:'complete',cookie:''},
    indexedDB:{open:()=>({})}, fetch:()=>Promise.reject(new Error('no-net')),
    XMLHttpRequest:function(){this.open=noop;this.send=noop;this.setRequestHeader=noop;},
    crypto:{subtle:{}}, alert:noop, confirm:()=>true, prompt:()=>null,
  };
  s.window=s; s.self=s; s.globalThis=s;
  vm.createContext(s);
  try { vm.runInContext(code, s, {filename:'legacy-bundle.js'}); } catch(_e){}
  return s;
}
const ctx = loadCtx();
const words = (txt, q) => ctx._esBuildMatches(txt, q).map(m => txt.slice(m.start, m.end));

describe('Recherche éditeur — mot entier (défaut)', () => {
  const T = 'Il faut pour poursuivre, pourvoir et Pour finir : pour.';

  it('« pour » ne matche que le mot entier, pas poursuivre/pourvoir', () => {
    const w = words(T, 'pour');
    expect(w.length).toBe(3);            // pour, Pour, pour
    expect(w.every(x => x.toLowerCase() === 'pour')).toBe(true);
  });

  it('insensible à la casse', () => {
    expect(words('Chat chat CHAT', 'chat').length).toBe(3);
  });

  it('gère les accents (frontières Unicode)', () => {
    expect(words('les élèves, un élève.', 'élève')).toEqual(['élève']);
    expect(words('un français, des françaises', 'français')).toEqual(['français']);
  });

  it('exclut les mots plus longs qui contiennent la requête', () => {
    expect(words('le chat, un chateau, des chats', 'chat')).toEqual(['chat']);
  });

  it('traite la requête comme littérale (pas de méta-regex)', () => {
    expect(words('c.a puis cxa', 'c.a')).toEqual(['c.a']);
  });

  it('bascule vers la recherche sous-chaîne puis revient', () => {
    try { ctx.esToggleWholeWord(); } catch(_e){}     // -> sous-chaîne
    expect(words('pour poursuivre pourvoir', 'pour').length).toBe(3);
    try { ctx.esToggleWholeWord(); } catch(_e){}     // -> mot entier
    expect(words('pour poursuivre pourvoir', 'pour').length).toBe(1);
  });
});
