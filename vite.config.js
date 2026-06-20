import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * En DEV  : /legacy-bundle.js est servi statiquement depuis public/
 * En PROD : on copie legacy-bundle.js dans dist/ lors du build
 */
function copyLegacyBundle() {
  return {
    name: 'copy-legacy-bundle',
    closeBundle() {
      const src  = path.resolve(__dirname, 'public/legacy-bundle.js');
      const dest = path.resolve(__dirname, 'dist/legacy-bundle.js');
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`[legacy] legacy-bundle.js copié dans dist/ (${(fs.statSync(dest).size/1024).toFixed(0)} KB)`);
      }
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [copyLegacyBundle()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: { input: 'index.html' },
  },
  server: { port: 5173, open: false },
});
