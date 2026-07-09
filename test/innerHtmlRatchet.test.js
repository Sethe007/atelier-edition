import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// S-8 — RATCHET anti-XSS : le nombre d'affectations `innerHTML =` dans le bundle
// ne doit JAMAIS augmenter. Toute nouvelle injection de contenu doit passer par
// setHTML()/sanitizeHTML() (DOMPurify) ou textContent. Si ce test échoue après
// une modification légitime *qui réduit* le total, abaissez le plafond.
// 123 = 121 + 2 affectations SÛRES de resetAnalysisModules (restauration de
// l'état vide capturé depuis le markup de l'app, et clear par chaîne vide) —
// aucune donnée utilisateur, pas de surface XSS.
const CEILING = 123;

describe('S-8 — ratchet innerHTML', () => {
  it(`le bundle contient au plus ${CEILING} affectations innerHTML`, () => {
    const src = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
    const count = (src.match(/innerHTML\s*=/g) || []).length;
    expect(count <= CEILING).toBe(true);
  });
});
