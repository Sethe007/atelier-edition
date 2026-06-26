import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { __run } from 'vitest';
const files = readdirSync('test').filter(f=>f.endsWith('.test.js'));
for(const f of files){ await import(pathToFileURL('test/'+f).href); }
const r = await __run();
console.log(`\n${r.pass} passed, ${r.fail} failed`);
if(r.fail){ console.log(r.fails.join('\n')); process.exit(1); }
