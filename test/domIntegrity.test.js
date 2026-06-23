import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Audit automatisé : aucun getElementById('literal') du runtime ne doit pointer
// vers un élément absent à la fois d'index.html ET de toute création JS.
// Ce test a été ajouté après la découverte de plusieurs "éléments morts"
// (modales substitution/aide/recherche globale, champs Fiche Œuvre) dus à une
// dérive HTML/JS. Il échoue si un NOUVEL élément mort apparaît.

const bundle = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
const html   = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// IDs encore tolérés : vestiges gardés par if(el), sans CSS/structure de
// référence pour les reconstruire (aucun crash). À résorber un jour, pas un bug.
const ALLOWLIST = new Set([
  'acc-persos', 'acc-lieux', 'acc-oeuvre',
  'btn-view-edit', 'btn-view-split',
  'chapter-timeline-inner',
  'wt-api-dot', 'wt-api-section', 'wt-api-compact-label',
]);

function computeDead() {
  const referenced = new Set([...bundle.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]));
  const defined = new Set();
  for (const src of [html, bundle]) {
    for (const m of src.matchAll(/id\s*=\s*["']([^"'${}]+)["']/g)) defined.add(m[1]);
  }
  for (const m of bundle.matchAll(/\.id\s*=\s*["']([^"']+)["']/g)) defined.add(m[1]);
  for (const m of bundle.matchAll(/setAttribute\(\s*['"]id['"]\s*,\s*['"]([^'"]+)['"]/g)) defined.add(m[1]);
  return [...referenced]
    .filter(id => !defined.has(id))
    .filter(id => !id.includes('$') && !id.includes('{')); // exclut les templates dynamiques
}

describe('Intégrité DOM (audit anti-régression)', () => {
  it('aucun nouvel élément "mort" hors allowlist', () => {
    const unexpected = computeDead().filter(id => !ALLOWLIST.has(id));
    expect(unexpected).toEqual([]);
  });

  it('les éléments réparés cette session existent bien', () => {
    const mustExist = [
      'ia-prop-overlay', 'help-modal', 'global-search-modal', 'gs-input', 'gs-results',
      'oeuvre-type', 'oeuvre-genre', 'oeuvre-epoque', 'oeuvre-notes',
    ];
    for (const id of mustExist) {
      expect(html.includes(`id="${id}"`), `#${id} manquant dans index.html`).toBe(true);
    }
  });
});
