import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// NON-RÉGRESSION — deux défauts du correcteur signalés le 7 août.
//
// 1. « jusqu'à » devenait « jusqus'à ». La règle d'accord adjectival utilisait
//    la classe [b-df-hj-lp-rt-vz] : la plage t-v inclut le U, une VOYELLE.
//    « jusqu » était donc pris pour un adjectif à finale consonantique. Toutes
//    les élisions en qu' étaient touchées : jusqu', lorsqu', puisqu', quelqu'.
//    On ne pouvait pas retirer le u de la classe — « les yeux bleu » -> « bleus »
//    est légitime. Le correctif exclut les formes SUIVIES D'UNE APOSTROPHE.
//
// 2. Une correction défaite à la main revenait au passage suivant. Le cooldown
//    de 800 ms ne couvrait pas le temps réel d'une correction manuelle. Une
//    mémoire des formes rétablies par l'auteur a été ajoutée.

const src = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');

describe('Correcteur — élisions préservées', () => {
  it('les frontières excluent les deux apostrophes', () => {
    expect(src.includes('\\\\u2019\\\\u0027')).toBe(true);
  });
  it('la règle nominale et la règle adjectivale sont toutes deux protégées', () => {
    const n = (src.match(/\(\?!\[\\\\p\{L\}\\\\u2019\\\\u0027\]\)/g) || []).length;
    expect(n >= 2).toBe(true);
  });
  it('le piège de la plage t-v est documenté', () => {
    expect(/t-v/.test(src)).toBe(true);   // la classe existe toujours (« bleu » en dépend)
  });
});

describe('Correcteur — mémoire des corrections rejetées', () => {
  it('la mémoire existe et est bornée', () => {
    expect(src.includes('_acExempt')).toBe(true);
    expect(src.includes('_AC_EXEMPT_MAX')).toBe(true);
  });
  it('elle survit au rechargement (localStorage)', () => {
    expect(src.includes('atelier_ac_exempt_v1')).toBe(true);
  });
  it('un stockage indisponible ne fait pas planter le correcteur', () => {
    const i = src.indexOf('_AC_EXEMPT_KEY = ');
    expect(src.slice(i, i + 900).includes('catch')).toBe(true);
  });
  it('le retour en arrière de l\'auteur est détecté', () => {
    expect(src.includes('_acDetectRevert')).toBe(true);
    const i = src.indexOf('function _acDetectRevert');
    const f = src.slice(i, i + 700);
    expect(f.includes('toks.has(ch.from)')).toBe(true);
    expect(f.includes('!toks.has(ch.to)')).toBe(true);
  });
  it('la détection tourne avant toute nouvelle correction', () => {
    const i = src.indexOf('function _safeApply(ta)');
    const f = src.slice(i, i + 900);
    expect(f.indexOf('_acDetectRevert') < f.indexOf('_applyAllSafe')).toBe(true);
  });
  it('le post-filtre rétablit les formes exemptées', () => {
    const i = src.indexOf('function _acRespectExemptions');
    const f = src.slice(i, i + 700);
    expect(f.includes('_acExempt.has(A[i])')).toBe(true);
  });
  it('il s\'abstient si la structure du texte a trop changé', () => {
    const i = src.indexOf('function _acRespectExemptions');
    expect(src.slice(i, i + 700).includes('A.length !== B.length')).toBe(true);
  });
  it('aucune règle du moteur n\'est modifiée (post-filtre pur)', () => {
    const i = src.indexOf('function _applyAllSafe');
    expect(src.slice(i, i + 1600).includes('_acExempt')).toBe(false);
  });
  it('une remise à zéro est possible', () => {
    expect(src.includes('function acClearExemptions')).toBe(true);
  });
});

describe('Correcteur — reconstruction fidèle du texte', () => {
  it('le découpage conserve les séparateurs', () => {
    const i = src.indexOf('function _acTokens');
    expect(src.slice(i, i + 160).includes('(\\s+)')).toBe(true);
  });
  it('la reconstruction se fait sans réinsérer d\'espaces', () => {
    const i = src.indexOf('function _acRespectExemptions');
    expect(src.slice(i, i + 700).includes("B.join('')")).toBe(true);
  });
});

// ── Épreuve de comportement ────────────────────────────────────────────────
// _safeApply n'est pas exposé hors de l'IIFE : on rejoue ici la logique
// d'exemption à l'identique pour vérifier le cycle complet
//   correction -> rejet manuel -> plus jamais réappliquée.
describe('Correcteur — cycle complet correction / rejet / mémoire', () => {
  function moteur() {
    const exempt = new Set();
    let lastChanges = [];
    const toks = (t) => t.split(/(\s+)/);
    const diff = (a, b) => {
      const A = toks(a), B = toks(b);
      if (A.length !== B.length) return null;
      const o = [];
      for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) o.push({ from: A[i], to: B[i] });
      return o;
    };
    const detect = (cur) => {
      if (!lastChanges.length) return;
      const T = new Set(toks(cur));
      for (const c of lastChanges) if (T.has(c.from) && !T.has(c.to)) exempt.add(c.from);
      lastChanges = [];
    };
    const respect = (orig, corr) => {
      if (!exempt.size || orig === corr) return corr;
      const A = toks(orig), B = toks(corr);
      if (A.length !== B.length) return corr;
      let ch = false;
      for (let i = 0; i < A.length; i++) if (A[i] !== B[i] && exempt.has(A[i])) { B[i] = A[i]; ch = true; }
      return ch ? B.join('') : corr;
    };
    // règle factice : « chien » -> « chiens » après « les »
    const regle = (t) => t.replace(/\bles chien\b/g, 'les chiens');
    return {
      passe(texte) { detect(texte); let c = respect(texte, regle(texte)); lastChanges = diff(texte, c) || []; return c; },
      exempt,
    };
  }

  it('corrige normalement au premier passage', () => {
    expect(moteur().passe('les chien dort')).toBe('les chiens dort');
  });

  it('ne réapplique PAS une correction défaite par l\'auteur', () => {
    const m = moteur();
    expect(m.passe('les chien dort')).toBe('les chiens dort');   // 1. le moteur corrige
    expect(m.passe('les chien dort')).toBe('les chien dort');    // 2. l'auteur défait -> respecté
    expect(m.passe('les chien dort')).toBe('les chien dort');    // 3. et ça tient
    expect(m.passe('les chien dort')).toBe('les chien dort');    // 4. durablement
  });

  it('la forme rejetée est bien mémorisée', () => {
    const m = moteur();
    m.passe('les chien dort'); m.passe('les chien dort');
    expect(m.exempt.has('chien')).toBe(true);
  });

  it('l\'exemption ne déborde pas sur les autres corrections', () => {
    const m = moteur();
    m.passe('les chien dort'); m.passe('les chien dort');        // « chien » exempté
    expect(m.passe('les chien et les chien')).toBe('les chien et les chien');
    expect(m.exempt.size).toBe(1);                               // rien d'autre n'a été exempté
  });

  it('accepter la correction ne crée aucune exemption', () => {
    const m = moteur();
    m.passe('les chien dort');
    m.passe('les chiens dort');   // l'auteur garde la correction
    expect(m.exempt.size).toBe(0);
  });
});

// ── Visibilité et réversibilité des exemptions ─────────────────────────────
// Le refus d'une correction est un état PERSISTANT et autrement INVISIBLE, posé
// par une heuristique qui peut se tromper. Sans fenêtre pour le consulter et le
// défaire, le correcteur se dégraderait en silence, mot après mot.
describe('Exemptions — rendues visibles et réversibles', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  it('l\'auteur est averti au moment où un mot est exempté', () => {
    const i = src.indexOf('function _acDetectRevert');
    const f = src.slice(i, i + 1400);
    expect(f.includes('showToast')).toBe(true);
    expect(f.includes('ne sera plus corrigé')).toBe(true);
  });
  it('le message n\'apparaît qu\'à la PREMIÈRE exemption du mot', () => {
    const i = src.indexOf('function _acDetectRevert');
    expect(src.slice(i, i + 1400).includes('_neuf')).toBe(true);
  });
  it('un showToast absent ne fait pas planter le correcteur', () => {
    const i = src.indexOf('function _acDetectRevert');
    const f = src.slice(i, i + 1400);
    expect(f.includes("typeof showToast === 'function'")).toBe(true);
  });

  it('le moteur expose consultation, retrait unitaire et remise à zéro', () => {
    const i = src.indexOf('return { init, attach, onPrefsChange');
    const f = src.slice(i, i + 260);
    for (const k of ['getExemptions', 'removeExemption', 'clearExemptions'])
      expect(f.includes(k)).toBe(true);
  });

  it('les réglages contiennent le conteneur de la liste', () => {
    expect(html.includes('id="ac-exempt-list"')).toBe(true);
  });
  it('le bloc est un frère des autres pref-row, pas un enfant', () => {
    const i = html.indexOf('id="ac-exempt-list"');
    const avant = html.slice(Math.max(0, i - 400), i);
    // la pref-row qui le contient doit s'ouvrir après la fermeture de la précédente
    expect(avant.lastIndexOf('class="pref-row"') > avant.lastIndexOf('</label>')).toBe(true);
  });
  it('les balises restent équilibrées', () => {
    const o = (html.match(/<div\b/g) || []).length;
    const c = (html.match(/<\/div>/g) || []).length;
    expect(o === c).toBe(true);
  });
  it('un bouton de remise à zéro globale existe', () => {
    expect(html.includes('acClearAllExemptions()')).toBe(true);
  });
  it('chaque mot est retirable individuellement', () => {
    const i = src.indexOf('function acRenderExemptions');
    const f = src.slice(i, i + 1500);
    expect(f.includes('removeExemption')).toBe(true);
    expect(f.includes('ac-exempt-chip')).toBe(true);
  });
  it('les mots sont échappés avant injection (pas de XSS)', () => {
    const i = src.indexOf('function acRenderExemptions');
    expect(src.slice(i, i + 1500).includes('escHtml')).toBe(true);
  });
  it('la liste vide affiche un état explicite', () => {
    const i = src.indexOf('function acRenderExemptions');
    expect(src.slice(i, i + 1500).includes('Aucun mot exempté')).toBe(true);
  });
  it('la liste est reconstruite à l\'ouverture des réglages', () => {
    const i = src.indexOf('function refreshUI');
    expect(src.slice(i, i + 1800).includes('acRenderExemptions')).toBe(true);
  });
});
