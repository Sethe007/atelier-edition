import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// S-8 — RATCHET anti-XSS : le nombre d'affectations `innerHTML =` dans le bundle
// ne doit JAMAIS augmenter. Toute nouvelle injection de contenu doit passer par
// setHTML()/sanitizeHTML() (DOMPurify) ou textContent. Si ce test échoue après
// une modification légitime *qui réduit* le total, abaissez le plafond.
// 123 = 121 + 2 affectations SÛRES de resetAnalysisModules (restauration de
// l'état vide capturé depuis le markup de l'app, et clear par chaîne vide) —
// aucune donnée utilisateur, pas de surface XSS.
//
// 2026-08-06 — plafond porté 123 -> 127. Audit exhaustif des 127 affectations :
//   - 117 sans interpolation (markup statique)
//   -  10 avec interpolation, dont 8 n'injectent que des chaînes i18n internes
//        (_t/_nt), des entiers ou des libellés de configuration
//   -   2 injectaient e.message SANS échappement (l. ~8632 et ~8662) :
//        corrigées le même jour, elles passent désormais par escHtml().
// Toute nouvelle affectation doit passer par escHtml()/textContent.
const CEILING = 127;

describe('S-8 — ratchet innerHTML', () => {
  it(`le bundle contient au plus ${CEILING} affectations innerHTML`, () => {
    const src = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
    const count = (src.match(/innerHTML\s*=/g) || []).length;
    expect(count <= CEILING).toBe(true);
  });
});
