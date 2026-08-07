// Recrée le shim Vitest attendu par test/_run.mjs.
//
// test/_run.mjs importe { __run } depuis 'vitest' — une fonction qui n'existe
// que dans notre harnais maison (test/_shim.mjs), le Vitest natif plantant
// dans certains environnements. Toute installation (npm ci / npm install)
// réécrit node_modules/vitest : il faut donc reposer le shim juste avant de
// lancer la suite. Le workflow GitHub le faisait déjà en ligne de commande ;
// ce script versionne la même opération pour qu'elle soit rejouable partout
// (CI, Vercel, poste local).
import { mkdirSync, writeFileSync } from 'node:fs';

const dir = 'node_modules/vitest';
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/package.json`,
  '{"name":"vitest","version":"0.0.0","type":"module","main":"index.mjs"}');
writeFileSync(`${dir}/index.mjs`,
  'export * from "../../test/_shim.mjs";\n');
console.log('[shim] node_modules/vitest reposé');
