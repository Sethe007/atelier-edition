import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

// ANTI-CRÉATION DE FAUTES — l'autocorrection ne doit JAMAIS dégrader une phrase
// correcte. Chaque cas ci-dessous provient d'un faux positif identifié dans les
// règles (pronoms non 3e-pluriel, homographes de dictionnaire, génitifs,
// doublons légitimes, noms propres, abréviations, heures/URL…).

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
const ALL = { quotes: true, punctuation: true, repetitions: true, dblSpaces: true,
  pluralNoun: true, pluralVerb: true, pluralAdj: true, capitals: true,
  spell: true, participes: true, apostrophes: false, ellipsis: true, trailingSpaces: false };
const run = (text, lang, extra) => ctx.SafeCorrectionEngine.applyAll(text, { enabled: true, lang, ...ALL, ...(extra || {}) });

// Phrases CORRECTES : la sortie doit être STRICTEMENT identique à l'entrée.
const INTACT = {
  fr: [
    'On mange ensemble ce soir.',
    'Nous nous sommes levés tôt.',
    'Vous vous trompez de porte.',
    'Il nous a vus dans la rue.',
    'On a besoin de temps.',
    'La peur du noir le paralysait.',
    'Il ouvrit la porte du grand salon.',
    'Les Dupont arrivent demain.',
    'Le bruit des vagues est doux.',
    'Elle portait une robe bleu clair.',
    'La cote de popularité montait.',
    'Une tache sombre maculait le mur.',
    'M. le maire entra sans bruit.',
    'Le train part à 14:30 précises.',
  ],
  en: [
    'As was his wont, he waited.',
    'The peoples of the realm gathered.',
    'The boss runs the meeting.',
    'The sound of the waves has faded.',
    'I know that that is true.',
  ],
  es: [
    'Esta casa es muy vieja.',
    'Caminó hacia la puerta.',
    'La mujer sabia sonrió.',
    'La casa de los abuelos está lejos.',
    'Algunas veces pienso en ti.',
  ],
  de: [
    'Menschen, die die Stadt lieben, bleiben.',
    'Haben sie sie gesehen?',
    'Ich weiß, dass es geht.',
  ],
  pt: ['Se se atrever, venha.'],
  hu: ['Az az ember magas.'],
  it: ['Il loro amico è simpatico.'],
  fi: ['He ovat täällä.'],
  da: ['De går hjem nu.'],
  ru: ['Они идут домой.'],
};

describe('Anti-création de fautes — les phrases correctes restent intactes', () => {
  for (const [lang, phrases] of Object.entries(INTACT)) {
    for (const p of phrases) {
      it(`[${lang}] « ${p} »`, () => {
        expect(run(p, lang)).toBe(p);
      });
    }
  }
});

describe('Les vraies fautes restent corrigées', () => {
  const CASES = [
    ['fr', 'ils mange leur soupe.', 'mangent'],
    ['fr', 'Voici des chat.', 'des chats'],
    ['fr', 'Les enfants mange trop vite.', 'Les enfants mangent'],
    ['fr', 'Il arrive. voici la suite.', '. Voici'],
    ['en', 'they runs every day.', 'They run'],
    ['es', 'ellos habla mucho.', 'Ellos hablan'],
    ['it', 'loro parla troppo.', 'Loro parlano'],
    ['pt', 'eles fala demais.', 'Eles falam'],
    ['ru', 'они идёт домой.', 'Они идут'],
    ['el', 'αυτοί θέλει νερό.', 'Αυτοί θέλουν'],
    ['fi', 'he menee kotiin.', 'He menevät'],
    ['hu', 'ők megy haza.', 'Ők mennek'],
    ['ru', 'это будующий город.', 'будущий'],
    ['da', 'Vi ses idag.', 'i dag'],
    ['el', 'αυτος ειναι καλός.', 'είναι'],
    ['fi', 'se ei tarkottaa mitään.', 'tarkoittaa'],
    ['hu', 'ez muszály volt.', 'muszáj'],
    ['de', 'Ich weiß, daß du kommst.', 'dass du'],
    ['it', 'Non so perche piove.', 'perché'],
    ['pt', 'Eu nao sei.', 'não'],
  ];
  for (const [lang, input, expected] of CASES) {
    it(`[${lang}] « ${input} » contient « ${expected} »`, () => {
      expect(run(input, lang)).toContain(expected);
    });
  }
});
