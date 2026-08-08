import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// NON-RÉGRESSION — contraste des widgets natifs sur les thèmes clairs.
//
// Signalé sur jour_ivoire et jour_ardoise : le sélecteur de modèle IA du
// bandeau affichait du texte clair sur menu clair, et le sélecteur de catégorie
// du module « Signaler un bug » du texte noir sur fond noir.
//
// Deux causes distinctes :
//
//  1. La liste déroulante d'un <select> est peinte par le NAVIGATEUR, pas par
//     notre CSS. Sa palette vient de color-scheme, qui n'était déclaré nulle
//     part : le thème n'avait donc aucune prise sur elle.
//
//  2. bugReport.js codait ses couleurs en dur pour un fond sombre, et forçait
//     localement color-scheme: dark.

const src  = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
const bugr = fs.readFileSync(new URL('../src/modules/bugReport.js', import.meta.url), 'utf8');

describe('Thème — color-scheme piloté par applyTheme', () => {
  const i = src.indexOf('function applyTheme');
  const f = src.slice(i, i + 2600);
  it('applyTheme déclare color-scheme', () => {
    expect(f.includes("setProperty('color-scheme'")).toBe(true);
  });
  it('la valeur dépend du caractère clair du thème', () => {
    expect(f.includes("isLight ? 'light' : 'dark'")).toBe(true);
  });
  it('isLight couvre bien les deux thèmes jour_*', () => {
    expect(f.includes("name.startsWith('jour_')")).toBe(true);
    expect(src.includes('jour_ivoire')).toBe(true);
    expect(src.includes('jour_ardoise')).toBe(true);
  });
});

describe('Signaler un bug — couleurs liées au thème', () => {
  it('plus de couleur de texte blanche codée en dur sur les champs', () => {
    const i = bugr.indexOf('.bugr-form input,');
    const bloc = bugr.slice(i, i + 1400);
    expect(/color:\s*rgba\(255,255,255,0\.9\);\s*font-size/.test(bloc)).toBe(false);
  });
  it('les champs suivent les variables de thème', () => {
    const i = bugr.indexOf('.bugr-form input,');
    const bloc = bugr.slice(i, i + 1400);
    expect(bloc.includes('var(--ink')).toBe(true);
    expect(bloc.includes('var(--c-lift')).toBe(true);
  });
  it('color-scheme n\'est plus forcé localement', () => {
    expect(bugr.includes('color-scheme: dark')).toBe(false);
  });
  it('les <option> déclarent une couleur de texte (sinon noir sur noir)', () => {
    const m = bugr.match(/\.bugr-form option \{[^}]*\}/);
    expect(m !== null).toBe(true);
    expect(m[0].includes('color:')).toBe(true);
  });
  it('les <option> suivent aussi les variables', () => {
    const m = bugr.match(/\.bugr-form option \{[^}]*\}/);
    expect(m[0].includes('var(--ink')).toBe(true);
  });
  it('les replis restent en place si les variables manquent', () => {
    const m = bugr.match(/\.bugr-form option \{[^}]*\}/);
    expect(m[0].includes('#1e1f24')).toBe(true);
  });
});
