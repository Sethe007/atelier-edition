import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { OBF_OPTIONS } from '../scripts/obfuscate.mjs';

// Validation du pipeline d'obfuscation. AUTO-IGNORÉ si javascript-obfuscator
// n'est pas installé (sandbox sans devDeps) — s'exécute en CI / en local /
// sur Vercel où l'install fonctionne.
//
// Enjeu critique : le bundle expose des fonctions GLOBALES appelées par des
// `onclick` inline. L'obfuscation NE DOIT PAS renommer ces globales, sinon
// l'app casse. Ce test le prouve sur un échantillon représentatif.

const require = createRequire(import.meta.url);
let obfuscator = null;
try { obfuscator = require('javascript-obfuscator'); } catch { /* absent → skip */ }

describe('Obfuscation — préservation des globales (onclick inline)', () => {
  if (!obfuscator) {
    it('ignoré (javascript-obfuscator non installé)', () => { expect(true).toBe(true); });
    return;
  }

  // Échantillon mimant le bundle : fonctions globales + dispatch par table +
  // chaîne HTML contenant un onclick, + un i18n peuplé par Object.assign.
  const sample = `
    function runCorrector(){ return 'ran:' + _ltApiCode(); }
    function _ltApiCode(){ const m={fr:'fr',en:'en-US'}; return m[getLang()] || 'fr'; }
    function getLang(){ return 'en'; }
    var SafeCorrectionEngine = { applyAll: function(t){ return t.toUpperCase(); } };
    var _i18n = { fr:{}, en:{} };
    Object.assign(_i18n.fr, { hello:'bonjour' });
    var html = '<div onclick="runCorrector()">x</div>';
    globalThis.__probe = { runCorrector, _ltApiCode, SafeCorrectionEngine, _i18n, html };
  `;

  const obf = obfuscator.obfuscate(sample, OBF_OPTIONS).getObfuscatedCode();

  it('le code obfusqué diffère de la source (transformation effective)', () => {
    expect(obf !== sample && obf.length > 0).toBe(true);
  });

  it('les noms de fonctions globales sont préservés', () => {
    expect(/runCorrector/.test(obf)).toBe(true);
    expect(/_ltApiCode/.test(obf)).toBe(true);
    expect(/SafeCorrectionEngine/.test(obf)).toBe(true);
  });

  it('le code obfusqué s\'exécute et les globales restent appelables', () => {
    const ctx = { globalThis: {}, Object, console };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(obf, ctx);
    const p = ctx.__probe;
    expect(typeof p.runCorrector).toBe('function');
    expect(p.runCorrector()).toBe('ran:en-US');           // dispatch par table intact
    expect(p.SafeCorrectionEngine.applyAll('ok')).toBe('OK');
    expect(p._i18n.fr.hello).toBe('bonjour');             // Object.assign i18n intact
    expect(p.html.includes('onclick="runCorrector()"')).toBe(true); // onclick préservé
  });
});
