import { describe, it, expect } from 'vitest';
import { loadGlobals } from './_load.js';

// Chemin "navigateur compatible" : on mocke l'API File System Access.
function makeHandle(name, sink) {
  return {
    name,
    async queryPermission() { return 'granted'; },
    async requestPermission() { return 'granted'; },
    async getFile() { return { name, async text() { return JSON.stringify({ meta:{}, texte:'hello' }); } }; },
    async createWritable() { let buf=''; return { async write(t){buf=t;}, async close(){ sink.last = buf; } }; },
  };
}

describe('fileSystem — chemin compatible (File System Access)', () => {
  function load(sink) {
    return loadGlobals('src/modules/fileSystem.js', {
      window: {
        showSaveFilePicker: async (o) => makeHandle(o.suggestedName || 'new.json', sink),
        showOpenFilePicker: async () => [ makeHandle('roman.json', sink) ],
      },
      currentProject: { nom: 'Mon Roman' },
      showToast: () => {}, markSaved: () => {},
      collectProjectData: () => ({ meta:{ derniereSauvegarde:'2026' }, texte:'content' }),
      applyProjectData: () => { sink.applied = true; },
    });
  }
  it('fsSaveProjectAs écrit un JSON valide et mémorise le handle', async () => {
    const sink = {};
    const s = load(sink);
    expect(s.fsSupported()).toBe(true);
    await s.fsSaveProjectAs();
    expect(JSON.parse(sink.last).texte).toBe('content');
  });
  it('fsOpenProject applique le projet chargé', async () => {
    const sink = {};
    const s = load(sink);
    await s.fsOpenProject();
    expect(sink.applied).toBe(true);
  });
});
