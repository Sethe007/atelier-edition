import { describe, it, expect } from 'vitest';
import { loadGlobals } from './_load.js';

const realEscHtml = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

describe('renderAiLines — sécurité XSS + gras', () => {
  const load = () => loadGlobals('src/modules/core.js', { escHtml: realEscHtml });

  it('convertit **gras** en <strong>', () => {
    const s = load();
    const out = s.renderAiLines(['Une **idée** forte']);
    expect(out).toContain('<strong>idée</strong>');
  });
  it('neutralise le HTML injecté par l’IA', () => {
    const s = load();
    const out = s.renderAiLines(['<img src=x onerror=alert(1)> et **gras**']);
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    expect(out).toContain('<strong>gras</strong>');
  });
});
