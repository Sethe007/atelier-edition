import fs from 'node:fs';
import vm from 'node:vm';

// Charge un fichier source "globals" (non-ESM) dans un sandbox isolé avec des
// mocks, et renvoie le sandbox (les `function`/`var` top-level y sont exposés).
export function loadGlobals(relPath, mocks = {}) {
  const code = fs.readFileSync(new URL('../' + relPath, import.meta.url), 'utf8');
  const noop = () => {};
  const sandbox = {
    console,
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
    localStorage: { _d: {}, getItem(k){return this._d[k] ?? null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} },
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: noop,
      createElement: () => ({ style:{}, classList:{ add:noop, remove:noop }, setAttribute:noop, appendChild:noop }),
      head: { appendChild: noop },
      body: { appendChild: noop },
      readyState: 'complete',
    },
    indexedDB: { open: () => ({}) },
    ...mocks,
  };
  sandbox.window = sandbox.window || sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}
