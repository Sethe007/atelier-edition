import { describe, it, expect } from 'vitest';
import { loadGlobals } from './_load.js';

// escHtml réel (depuis editor.js) — la brique d'échappement utilisée partout.
describe('escHtml (réel)', () => {
  const s = loadGlobals('src/modules/editor.js', { DOMPurify: undefined });
  it('échappe les caractères HTML dangereux', () => {
    expect(s.escHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(s.escHtml(`"x" & 'y'`)).toBe('&quot;x&quot; &amp; &#39;y&#39;');
  });
  it('sanitizeHTML retombe sur escHtml si DOMPurify absent', () => {
    expect(s.sanitizeHTML('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
    expect(s.sanitizeHTML(null)).toBe('');
  });
});
