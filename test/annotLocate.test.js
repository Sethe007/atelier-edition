import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// NON-RÉGRESSION — localisation des notes auteur (_locate).
//
// Deux défauts corrigés le 2026-08-07 :
//
//  1. « anchor.length < 3 » rejetait toute sélection de 1-2 caractères. La note
//     était bien enregistrée mais jamais localisée : invisible à l'écran. D'où
//     le réflexe de la ressaisir avec une sélection plus large.
//
//  2. text.indexOf(anchor, offset - 100) prenait la PREMIÈRE occurrence trouvée
//     à partir d'une fenêtre arbitraire. Dès que l'auteur supprimait plus de
//     100 caractères en amont, la bonne occurrence passait avant la fenêtre et
//     la note s'accrochait à une occurrence ultérieure du même texte — balise
//     décalée sur un passage identique, donc difficile à repérer.
//
// On reproduit ici la logique de _locate() en isolant la dépendance au DOM.

function makeLocate(text) {
  return function _locate(annot) {
    const anchor = annot.anchor;
    if (!anchor) return null;
    const hlLen = (annot.selLength && annot.selLength > anchor.length) ? annot.selLength : anchor.length;
    const off = annot.offset || 0;
    if (text.substr(off, anchor.length) === anchor) return { start: off, end: off + hlLen };
    const occ = [];
    for (let i = text.indexOf(anchor); i !== -1 && occ.length < 2000; i = text.indexOf(anchor, i + 1)) occ.push(i);
    if (!occ.length) return null;
    let best = occ[0], bestScore = -Infinity;
    for (const i of occ) {
      let score = 0;
      if (annot.before) {
        const b = text.slice(Math.max(0, i - annot.before.length), i);
        if (b === annot.before) score += 4;
        else if (b.slice(-10) === annot.before.slice(-10)) score += 2;
      }
      if (annot.after) {
        const a = text.slice(i + hlLen, i + hlLen + annot.after.length);
        if (a === annot.after) score += 4;
        else if (a.slice(0, 10) === annot.after.slice(0, 10)) score += 2;
      }
      score += 1 / (1 + Math.abs(i - off) / 1000);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return { start: best, end: best + hlLen };
  };
}

describe('Notes — ancres courtes', () => {
  it('une sélection de 2 caractères est localisée (et non ignorée)', () => {
    const t = 'Et puis il partit sans se retourner.';
    const r = makeLocate(t)({ anchor: 'il', selLength: 2, offset: t.indexOf('il') });
    expect(r !== null).toBe(true);
    expect(t.slice(r.start, r.end)).toBe('il');
  });
  it('une sélection d\'un seul caractère est localisée', () => {
    const t = 'Chapitre X — le retour.';
    const r = makeLocate(t)({ anchor: 'X', selLength: 1, offset: 9 });
    expect(r !== null).toBe(true);
  });
});

describe('Notes — ancre répétée après remaniement du texte', () => {
  const phrase = 'Marie sourit';
  const texte = 'PROLOGUE. '.repeat(20) + phrase + '. Le vent se leva. ' + phrase + '. Puis le silence. ' + phrase + '.';

  it("sans contexte : retourne une occurrence valide, jamais null ni une position absurde", () => {
    // LIMITE ASSUMÉE : sans contexte, si l'auteur supprime du texte EN AMONT,
    // la vraie occurrence recule alors que la proximité avec l'ancien offset
    // en désigne une plus loin. Aucune information ne permet de trancher.
    // C'est précisément ce que résout le contexte (test suivant), et les
    // annotations anciennes l'acquièrent dès leur première localisation exacte.
    const pos = texte.indexOf(phrase, 200);
    const edite = texte.slice(0, 30) + texte.slice(180);
    const r = makeLocate(edite)({ anchor: phrase, selLength: 12, offset: pos });
    expect(r !== null).toBe(true);
    expect(edite.slice(r.start, r.end)).toBe(phrase);
  });

  it('avec contexte : retrouve exactement la bonne occurrence parmi trois', () => {
    const cible = texte.indexOf(phrase, texte.indexOf(phrase, 200) + 1); // 2e occurrence
    const annot = {
      anchor: phrase, selLength: 12, offset: cible,
      before: texte.slice(Math.max(0, cible - 40), cible),
      after:  texte.slice(cible + 12, cible + 52),
    };
    const edite = 'AJOUT EN TETE. '.repeat(10) + texte;    // tout est décalé vers l'avant
    const attendu = edite.indexOf(phrase, edite.indexOf(phrase) + 1);
    expect(makeLocate(edite)(annot).start).toBe(attendu);
  });

  it('ancre absente du texte : retourne null sans planter', () => {
    expect(makeLocate('Rien ici.')({ anchor: 'introuvable', selLength: 11, offset: 0 })).toBe(null);
  });
});

describe('Notes — le bundle expose bien la version corrigée', () => {
  const src = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
  it('_locate ne rejette plus les ancres de moins de 3 caractères', () => {
    expect(src.includes("!anchor || anchor.length < 3")).toBe(false);
  });
  it('add() mémorise le contexte des nouvelles annotations', () => {
    expect(src.includes('before:    text.slice')).toBe(true);
  });
});
