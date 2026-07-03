import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { minify } from 'terser';

/**
 * legacy-bundle.js — stratégie source/artefact
 * --------------------------------------------------
 * `public/legacy-bundle.js` est la SOURCE lisible (non minifiée), versionnée.
 *
 * En DEV  : Vite la sert telle quelle depuis public/ (debuggable).
 * En PROD : on génère une version MINIFIÉE dans dist/legacy-bundle.js
 *           au moment du build — elle n'est jamais commitée (donc aucune
 *           dérive possible entre source et artefact).
 *
 * Minification volontairement CONSERVATRICE : whitespace + commentaires
 * uniquement. Aucun renommage (`mangle:false`), aucune réécriture de code
 * (`compress:false`). Le bundle expose ~2085 fonctions GLOBALES appelées par
 * des `onclick` inline et repose sur `this` au top-level (lib docx vendorée) :
 * tout renommage ou wrapping casserait l'application. Ce réglage garantit un
 * gain de poids (~27 %) avec zéro changement de comportement.
 */
function buildLegacyBundle() {
  return {
    name: 'build-legacy-bundle',
    async closeBundle() {
      const src  = path.resolve(__dirname, 'public/legacy-bundle.js');
      const dest = path.resolve(__dirname, 'dist/legacy-bundle.js');
      if (!fs.existsSync(src)) return;
      const code = fs.readFileSync(src, 'utf8');

      // 1) OBFUSCATION (défaut en prod) — protège l'artefact ; désactivable via OBFUSCATE=0.
      if (process.env.OBFUSCATE === '1') {
        try {
          const { obfuscateBundle } = await import('./scripts/obfuscate.mjs');
          const r = await obfuscateBundle(src, dest);
          if (r.ok) {
            console.log(`[legacy] OBFUSQUÉ → dist/ : ${(r.in/1024).toFixed(0)} KB → ${(r.out/1024).toFixed(0)} KB (×${(r.out/r.in).toFixed(1)})`);
            return;
          }
          console.warn('[legacy] javascript-obfuscator absent → repli minification (npm i -D javascript-obfuscator pour activer).');
        } catch (e) {
          console.warn('[legacy] obfuscation échouée → repli minification :', e?.message);
        }
      }

      // 2) REPLI : minification conservatrice (whitespace + commentaires).
      try {
        const result = await minify(code, {
          mangle: false,      // ne JAMAIS renommer (globales + onclick inline)
          compress: false,    // pas de réécriture de code (sécurité maximale)
          format: { comments: false },
        });
        if (result.code) {
          fs.writeFileSync(dest, result.code);
          const o = fs.statSync(src).size, m = fs.statSync(dest).size;
          console.log(`[legacy] minifié → dist/ : ${(o/1024).toFixed(0)} KB → ${(m/1024).toFixed(0)} KB (-${(100*(1-m/o)).toFixed(0)}%)`);
          return;
        }
      } catch (e) {
        console.warn('[legacy] minification échouée, fallback copie brute :', e?.message);
      }
      // Fallback : copie brute si la minification échoue (ne jamais casser le build)
      fs.copyFileSync(src, dest);
      console.log(`[legacy] copié (non minifié) → dist/ : ${(fs.statSync(dest).size/1024).toFixed(0)} KB`);
    },
  };
}

export default defineConfig(({ command }) => ({
  root: '.',
  // base relative au BUILD -> le même build fonctionne à '/' (app.scrivaelo.com)
  // ET sous '/app/' (embarqué dans le site). En dev on garde '/'.
  base: command === 'build' ? './' : '/',
  plugins: [buildLegacyBundle()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: { input: 'index.html' },
  },
  server: { port: 5173, open: false },
}));
