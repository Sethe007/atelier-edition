#!/usr/bin/env node
// Outil i18n : couverture + génération de squelettes de nouvelles langues.
//   node scripts/i18n-tools.mjs            → rapport de couverture
//   node scripts/i18n-tools.mjs --stubs    → génère i18n-stubs/<lang>.js
import fs from 'node:fs';
import vm from 'node:vm';

const NEW_LANGS = { ru:'Русский', el:'Ελληνικά', da:'Dansk', hu:'Magyar', fi:'Suomi' };

// 1) Catalogues source (fr/en/es via _registerLang)
function loadSrc(lang) {
  const cat = {};
  const ctx = { _registerLang:(c,o)=>{cat.code=c;cat.obj=o;}, window:{}, console };
  vm.createContext(ctx);
  try { vm.runInContext(fs.readFileSync(`src/i18n/${lang}.js`,'utf8'), ctx); } catch(e){ return null; }
  return cat.obj || null;
}
const srcFr = loadSrc('fr') || {}, srcEn = loadSrc('en') || {};

// 2) Blocs du bundle (fr..pt) par regex (1 clé par ligne)
const bundle = fs.readFileSync('public/legacy-bundle.js','utf8');
function bundleBlock(lang, next) {
  const start = bundle.indexOf(`\n  ${lang}: {`);
  if (start < 0) return {};
  const end = next ? bundle.indexOf(`\n  ${next}: {`, start) : bundle.indexOf('\n};', start);
  const seg = bundle.slice(start, end < 0 ? start+200000 : end);
  const out = {};
  for (const m of seg.matchAll(/^\s*([A-Za-z0-9_]+):\s*(['"])([\s\S]*?)\2,?\s*$/gm)) out[m[1]] = m[3];
  return out;
}
const order = ['fr','en','es','de','it','pt'];
const bun = {}; order.forEach((l,i)=> bun[l] = bundleBlock(l, order[i+1]));

// 3) Clés de référence = union(src fr, bundle fr)
const refKeys = new Set([...Object.keys(srcFr), ...Object.keys(bun.fr)]);
const baseVal = (k) => srcEn[k] ?? bun.en[k] ?? srcFr[k] ?? bun.fr[k] ?? '';

// 4) Rapport de couverture
console.log(`Clés de référence (fr) : ${refKeys.size}`);
for (const l of order) {
  const have = new Set(Object.keys(bun[l]||{}));
  const missing = [...refKeys].filter(k=>!have.has(k));
  console.log(`  ${l.toUpperCase()} : ${have.size}/${refKeys.size}  (${missing.length} manquantes)`);
}

// 5) Génération des squelettes
if (process.argv.includes('--stubs')) {
  for (const [code,label] of Object.entries(NEW_LANGS)) {
    const lines = [...refKeys].sort().map(k=>{
      const v = String(baseVal(k)).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return `  ${k}: '${v}',`;
    });
    const out = `// ── ${label} (${code}) — SQUELETTE À TRADUIRE ───────────────────────────────\n`
      + `// Valeurs actuellement en ANGLAIS (base de travail). Traduisez la partie droite.\n`
      + `// Repli automatique si une clé manque : ${code} -> en -> fr.\n`
      + `/* global _registerLang */\n`
      + `_registerLang('${code}', {\n${lines.join('\n')}\n});\n`;
    fs.writeFileSync(`i18n-stubs/${code}.js`, out);
    console.log(`→ i18n-stubs/${code}.js  (${lines.length} clés)`);
  }
}
