import { describe, it, expect } from 'vitest';
import { loadGlobals } from './_load.js';

const baseMocks = (extra={}) => ({
  currentProject: { nom: 'Mon Roman' },
  showToast: () => {},
  markSaved: () => {},
  collectProjectData: () => ({ meta: { derniereSauvegarde: 'x' } }),
  applyProjectData: () => {},
  ...extra,
});

describe('fileSystem — détection & nom de fichier', () => {
  it('fsSupported() = false quand l’API absente', () => {
    const s = loadGlobals('src/modules/fileSystem.js', baseMocks({ window: {} }));
    expect(s.fsSupported()).toBe(false);
  });
  it('_fsProjectFileName() slugifie le nom du projet', () => {
    const s = loadGlobals('src/modules/fileSystem.js', baseMocks({ window: {} }));
    expect(s._fsProjectFileName()).toBe('mon-roman.json');
  });
});

describe('fileSystem — repli sans API', () => {
  it('fsSaveProject retombe sur saveProject (download)', async () => {
    let called = 0;
    const s = loadGlobals('src/modules/fileSystem.js', baseMocks({ window: {}, saveProject: () => { called++; } }));
    await s.fsSaveProject();
    expect(called).toBe(1);
  });
});

describe('fileSystem — horodatage & élagage des backups', () => {
  it('_fsTimestamp formate AAAAMMJJ-HHmmss', () => {
    const s = loadGlobals('src/modules/fileSystem.js', baseMocks({ window: {} }));
    expect(s._fsTimestamp(new Date(2026, 5, 23, 9, 7, 5))).toBe('20260623-090705');
  });
  it('_fsSelectBackupsToDelete garde N et n’élague que ce projet', () => {
    const s = loadGlobals('src/modules/fileSystem.js', baseMocks({ window: {} }));
    const names = [
      'mon-roman.json',
      'autre-20260101-000000.json',
      'mon-roman-20260620-100000.json',
      'mon-roman-20260621-100000.json',
      'mon-roman-20260622-100000.json',
    ];
    const del = s._fsSelectBackupsToDelete(names, 'mon-roman', 2);
    expect(del).toEqual(['mon-roman-20260620-100000.json']);
  });
  it('ne touche pas un projet au préfixe voisin (roman vs roman-deux)', () => {
    const s = loadGlobals('src/modules/fileSystem.js', baseMocks({ window: {} }));
    const names = [
      'roman-20260101-000000.json',
      'roman-20260102-000000.json',
      'roman-deux-20260101-000000.json',
    ];
    const del = s._fsSelectBackupsToDelete(names, 'roman', 1);
    expect(del).toEqual(['roman-20260101-000000.json']);
  });
});
