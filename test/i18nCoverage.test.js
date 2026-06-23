import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Toute clé référencée par un attribut data-i18n* dans index.html DOIT exister
// dans le catalogue (au moins en français). Empêche les data-i18n « orphelins ».
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bundle = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');

const keys = new Set();
for (const m of html.matchAll(/data-i18n(?:-title|-placeholder|-label|-aria-label)?="([^"]+)"/g)) keys.add(m[1]);

describe('i18n — couverture des clés data-i18n', () => {
  it('aucune clé data-i18n orpheline (toutes définies au catalogue)', () => {
    const missing = [...keys].filter(k => !new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ':').test(bundle));
    expect(missing, 'clés data-i18n sans entrée catalogue : ' + missing.join(', ')).toEqual([]);
  });
});
