// Obfuscation du bundle legacy — artefact de PRODUCTION uniquement.
// La SOURCE lisible reste public/legacy-bundle.js (versionnée, testée en CI) ;
// cette étape ne produit que dist/legacy-bundle.js, jamais commité.
//
// Contrainte majeure : le bundle expose ~2085 fonctions GLOBALES appelées par
// des `onclick` inline (dette A-1). On obfusque donc SANS renommer les globales
// (`renameGlobals:false`) — sinon tous les onclick casseraient. On chiffre les
// chaînes, on aplatit modérément le flux de contrôle, on injecte du code mort et
// on active l'auto-défense : le code reste techniquement récupérable mais devient
// très coûteux à comprendre et réutiliser. Pas d'anti-debug agressif (gênerait
// les utilisateurs et casse sur certains navigateurs).
//
// Réglage via env : OBFUSCATE=0 pour désactiver (build lisible), OBFUSCATE=1 (défaut).
import fs from 'node:fs';

export const OBF_OPTIONS = {
  compact: true,
  // Flux de contrôle : modéré (0.5) pour limiter l'inflation de taille et la perte de perf.
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  // Code mort : discret (0.2) — assez pour brouiller, pas pour tripler le poids.
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  // Chaînes : tableau chiffré base64, roté et mélangé.
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  numbersToExpressions: true,
  simplify: true,
  // Identifiants LOCAUX renommés en hexadécimal ; GLOBALES préservées (onclick inline).
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  // transformObjectKeys désactivé : les tables de dispatch (dictionnaires AC,
  // i18n) sont indexées par chaîne au runtime — ne pas y toucher.
  transformObjectKeys: false,
  selfDefending: true,
  // Pas d'anti-debug agressif (gêne + casse) ; console conservée pour le support.
  debugProtection: false,
  disableConsoleOutput: false,
  sourceMap: false,
  target: 'browser',
};

// Réservation défensive : ne jamais renommer les noms exposés globalement.
// (Filet de sécurité en plus de renameGlobals:false.)
OBF_OPTIONS.reservedNames = ['^_?[A-Za-z]'];

export async function obfuscateBundle(src, dest) {
  const code = fs.readFileSync(src, 'utf8');
  let mod;
  try { mod = (await import('javascript-obfuscator')).default; }
  catch { return { ok: false, reason: 'module-absent' }; }
  const result = mod.obfuscate(code, OBF_OPTIONS);
  fs.writeFileSync(dest, result.getObfuscatedCode());
  return { ok: true, in: fs.statSync(src).size, out: fs.statSync(dest).size };
}
