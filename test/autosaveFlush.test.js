import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// NON-RÉGRESSION — P1-2 : perte des dernières secondes de frappe.
//
// scheduleAutosave() arme un timer de 3 s. Tant qu'il n'a pas expiré, la frappe
// récente n'existe QUE dans le DOM. Deux familles de pertes en découlaient :
//
//   1. Tout ce qui remplace le contenu (nouveau projet, chargement, clearAll,
//      clearAllSafe) vidait raw-input sans désarmer le timer : le texte partait
//      sans laisser de trace.
//   2. Toute sortie de page emportait le contenu en attente. beforeunload ne
//      faisait qu'AVERTIR, sans sauvegarder — et n'est de toute façon pas
//      déclenché de façon fiable sur iOS Safari ni Android Chrome, où une page
//      en arrière-plan peut être supprimée par le système.
//
// Ces tests portent sur la source : ils vérifient que le garde-fou est présent
// à chacun des 7 points concernés. Un test de comportement exigerait un DOM
// complet et un contrôle du temps que le harnais maison ne fournit pas.

const src = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');

describe('Autosave — mécanique de purge', () => {
  it('flushAutosave() existe', () => {
    expect(/function flushAutosave\s*\(/.test(src)).toBe(true);
  });
  it('un drapeau distingue « sauvegarde en attente » de « rien à faire »', () => {
    expect(src.includes('_autosavePending')).toBe(true);
  });
  it('ne réécrit pas quand aucune sauvegarde n\'est en attente', () => {
    expect(/if \(!_autosavePending\) return false;/.test(src)).toBe(true);
  });
  it('désarme le timer avant d\'écrire (pas de double écriture)', () => {
    const f = src.slice(src.indexOf('function flushAutosave'), src.indexOf('function flushAutosave') + 600);
    expect(f.includes('clearTimeout(_autosaveTimer)')).toBe(true);
    expect(f.includes('autosaveToLS()')).toBe(true);
  });
  it('scheduleAutosave arme bien le drapeau', () => {
    const f = src.slice(src.indexOf('function scheduleAutosave'), src.indexOf('function scheduleAutosave') + 260);
    expect(f.includes('_autosavePending = true')).toBe(true);
  });
  it('une écriture échouée ne fait pas planter l\'appelant', () => {
    const f = src.slice(src.indexOf('function flushAutosave'), src.indexOf('function flushAutosave') + 600);
    expect(f.includes('catch')).toBe(true);
  });
});

describe('Autosave — purge avant tout remplacement de contenu', () => {
  const FONCTIONS = ['confirmProjectChoice', 'applyProjectData', 'clearAll', 'clearAllSafe'];
  for (const nom of FONCTIONS) {
    it(`${nom}() purge avant d'écraser le texte`, () => {
      const i = src.indexOf('function ' + nom + '(');
      expect(i > -1).toBe(true);
      const debut = src.slice(i, i + 400);
      const posFlush = debut.indexOf('flushAutosave');
      const posWipe  = debut.indexOf("setDomVal('raw-input'");
      expect(posFlush > -1).toBe(true);
      // la purge doit précéder l'écrasement quand les deux sont dans la fenêtre
      if (posWipe > -1) expect(posFlush < posWipe).toBe(true);
    });
  }
});

describe('Autosave — sortie de page, tous navigateurs', () => {
  it('beforeunload sauvegarde, il ne se contente plus d\'avertir', () => {
    const i = src.indexOf("addEventListener('beforeunload'");
    expect(src.slice(i, i + 260).includes('flushAutosave')).toBe(true);
  });
  it('visibilitychange est écouté (seul signal fiable sur mobile)', () => {
    expect(src.includes("addEventListener('visibilitychange'")).toBe(true);
  });
  it('visibilitychange ne purge qu\'à l\'état « hidden »', () => {
    const i = src.indexOf("addEventListener('visibilitychange'");
    const bloc = src.slice(i, i + 220);
    expect(bloc.includes("visibilityState === 'hidden'")).toBe(true);
    expect(bloc.includes('flushAutosave')).toBe(true);
  });
  it('pagehide est écouté (navigation avec bfcache)', () => {
    const i = src.indexOf("addEventListener('pagehide'");
    expect(i > -1).toBe(true);
    expect(src.slice(i, i + 160).includes('flushAutosave')).toBe(true);
  });
  it('la sauvegarde de sortie passe par localStorage (écriture synchrone)', () => {
    const i = src.indexOf('function autosaveToLS');
    expect(src.slice(i, i + 1200).includes('localStorage.setItem')).toBe(true);
  });
});
