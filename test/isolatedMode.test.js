import { describe, it, expect } from 'vitest';
import { loadGlobals } from './_load.js';

function setup(taValue) {
  const ta = { value: taValue };
  const s = loadGlobals('src/modules/isolatedMode.js', {
    document: {
      getElementById: (id) => (id === 'raw-input' ? ta : null),
      querySelector: () => null, querySelectorAll: () => [],
      addEventListener: () => {}, readyState: 'complete',
      createElement: () => ({ style:{}, classList:{add(){},remove(){}} }),
    },
    detectHeadingLevel: (l) => (l && l.trim().startsWith('#') ? 1 : 0),
    getPref: () => null,
  });
  return s;
}

describe('mode isolé — reconstitution de l’œuvre complète (anti perte de données)', () => {
  it('_isolatedGetFullText réassemble tous les chapitres + sync du chapitre courant', () => {
    const s = setup('# Chapitre 1\ncorps 1 MODIFIÉ');
    const IM = s.window.IM;
    IM.active = true; IM.activeIdx = 0;
    IM.chapters = [
      { title:'# Chapitre 1', body:'corps 1 ORIGINAL' },
      { title:'# Chapitre 2', body:'corps 2' },
      { title:'# Chapitre 3', body:'corps 3' },
    ];
    const full = s.window._isolatedGetFullText();
    expect(full).toContain('corps 1 MODIFIÉ');     // édition courante synchronisée
    expect(full).toContain('corps 2');             // autres chapitres préservés
    expect(full).toContain('corps 3');
    expect(full).not.toContain('corps 1 ORIGINAL');
    expect(IM.chapters[1].body).toBe('corps 2');   // pas de corruption
  });
  it('renvoie null hors mode isolé (fallback raw-input)', () => {
    const s = setup('texte');
    s.window.IM.active = false;
    expect(s.window._isolatedGetFullText()).toBe(null);
  });
});
