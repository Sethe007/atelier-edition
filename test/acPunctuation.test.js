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
const src = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');

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

// ══ Audit systématique du 7 août — quatre défauts trouvés sur corpus ═══════
describe('Audit FR — virgule décimale', () => {
  // En français la VIRGULE est le séparateur décimal. La protection existait
  // pour le point, pas pour la virgule : « 3,14 » devenait « 3, 14 ».
  for (const n of ['3,14', '72,5', '1,5', '0,1', '99,9'])
    it(`${n} n'est pas disloqué`, () => {
      expect(run('Il mesurait ' + n + ' mètres.')).toContain(n);
    });
  it('la virgule normale reçoit toujours son espace', () => {
    expect(run('Il partit,elle resta.')).toContain(', elle');
  });
});

describe('Audit FR — ponctuation expressive', () => {
  // « ?! » « !! » « ?? » sont des groupes voulus par l'auteur : le moteur
  // insérait une espace insécable entre les deux signes.
  for (const g of ['?!', '!?', '!!', '??'])
    it(`« ${g} » reste soudé`, () => {
      expect(run('Vraiment ' + g)).toContain(g);
    });
});

describe('Audit FR — passé simple après « les » pronom', () => {
  // Le passé simple est LE temps de la narration littéraire. « les » pronom
  // était pris pour un déterminant : « il les prit » -> « il les prits ».
  const OK = ['elle les regarda', 'il les prit', 'on les entendit', 'je les vis',
              'nous les vîmes', 'vous les prîtes'];
  for (const t of OK)
    it(`« ${t} » n'est pas altéré`, () => {
      const o = run(t);
      expect(o.toLowerCase()).toBe(t.toLowerCase());
    });
  it('les terminaisons en -rent sont protégées', () => {
    expect(run('les partirent').toLowerCase()).toContain('les partirent');
  });
  it('mais un vrai nom est toujours accordé', () => {
    expect(run('les chien dort').toLowerCase()).toContain('chiens');
  });
});

describe('Audit FR — incises de dialogue', () => {
  // En français l'incise reste en minuscule. Les dialogues aux guillemets
  // étaient épargnés par hasard, pas ceux au tiret cadratin — pourtant la
  // convention dominante en fiction.
  const INCISES = ['— Non ! répondit-il.', '« Pars ! » cria-t-elle.',
                   'Vraiment ?! s’étonna-t-il.', '« Oui ? » fit-il.',
                   '— Viens ! murmura-t-elle doucement.'];
  for (const t of INCISES)
    it(`« ${t.slice(0, 28)}… » garde sa minuscule`, () => {
      expect(run(t)).toBe(t);
    });

  const PHRASES = ['Attention ! Le train arrive.', 'Où va-t-il ? Personne ne sait.', 'Stop ! Ça suffit.'];
  for (const t of PHRASES)
    it(`« ${t.slice(0, 26)}… » garde sa majuscule`, () => {
      expect(run(t)).toBe(t);
    });
});

describe('Audit FR — finales ambiguës -a / -it / -ut / -int', () => {
  // Ces finales terminent à la fois des noms (« les fruit ») et le passé
  // simple (« il les prit »). La morphologie seule ne tranche pas.
  //
  // Charge de la preuve inversée : sur ces finales, on ne corrige QUE si le
  // mot figure dans une liste explicite de noms. Le pire cas devient « le
  // correcteur s'abstient » plutôt que « le correcteur abîme le texte » —
  // pour un logiciel d'écriture, une correction fautive coûte bien plus
  // qu'une correction manquée.

  const PASSE_SIMPLE = [
    'puis les détourna', 'elle les regarda', 'il les prit', 'on les entendit',
    'les posa sur la table', 'il les vendit', 'elle les ouvrit', 'on les connut',
    'il les vint chercher', 'elle les sentit', 'il les but', 'elle les rompit',
  ];
  for (const t of PASSE_SIMPLE)
    it(`« ${t} » reste intact`, () => {
      expect(run(t).toLowerCase()).toBe(t.toLowerCase());
    });

  const NOMS = [['les fruit mûrs','fruits'], ['les bruit de la nuit','bruits'],
                ['les cinéma du quartier','cinémas'], ['des but marqués','buts'],
                ['les esprit libres','esprits'], ['les droit acquis','droits'],
                ['les toit rouges','toits'], ['des récit anciens','récits']];
  for (const [t, att] of NOMS)
    it(`« ${t} » est toujours accordé`, () => {
      expect(run(t).toLowerCase()).toContain(att);
    });

  it('la liste de noms existe et est documentée', () => {
    expect(src.includes('NOM_FINALE_AMBIGUE_FR')).toBe(true);
  });
  it('les accords ordinaires ne sont pas affectés', () => {
    expect(run('les chien dort').toLowerCase()).toContain('chiens');
    expect(run('des maison neuve').toLowerCase()).toContain('maisons');
    expect(run('les yeux bleu').toLowerCase()).toContain('bleus');
  });
});
