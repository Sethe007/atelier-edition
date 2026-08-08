import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// NON-RÉGRESSION — bouton « dossier de backups » sur navigateur non compatible.
//
// Trois des quatre boutons disque ont un repli propre :
//   fsOpenProject  -> entrée fichier classique
//   fsSaveProject  -> OPFS, puis téléchargement
//   fsSaveProjectAs-> téléchargement
// Le quatrième, fsChooseBackupFolder, n'en a AUCUN et ne peut pas en avoir :
// écrire des versions horodatées dans un dossier choisi exige
// showDirectoryPicker, qu'aucune autre API web ne remplace.
//
// Firefox et Safari ne l'implémentent pas ; Brave la désactive volontairement.
// Le bouton était pourtant affiché et ne produisait qu'une erreur au clic.

const src = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('Backups disque — le bouton disparaît si l\'API est absente', () => {
  it('_fsUpdateButton s\'occupe de btn-fs-backup', () => {
    const i = src.indexOf('function _fsUpdateButton');
    const f = src.slice(i, i + 2200);
    expect(f.includes('btn-fs-backup')).toBe(true);
  });
  it('la visibilité dépend bien de showDirectoryPicker', () => {
    const i = src.indexOf('function _fsUpdateButton');
    const f = src.slice(i, i + 2200);
    expect(f.includes("'showDirectoryPicker' in window")).toBe(true);
    expect(/style\.display\s*=/.test(f)).toBe(true);
  });
  it('le bouton est aussi retiré de l\'arbre d\'accessibilité', () => {
    const i = src.indexOf('function _fsUpdateButton');
    expect(src.slice(i, i + 2200).includes('aria-hidden')).toBe(true);
  });
  it('_fsUpdateButton est bien appelé à l\'initialisation', () => {
    expect(src.includes("typeof _fsUpdateButton === 'function') _fsUpdateButton()")).toBe(true);
  });
});

describe('Backups disque — message actionnable', () => {
  it('le message ne se contente plus de constater l\'échec', () => {
    expect(src.includes('Votre navigateur ne permet pas les backups sur disque.')).toBe(false);
  });
  it('il nomme les navigateurs compatibles', () => {
    expect(src.includes('Chrome, Edge ou Opera')).toBe(true);
  });
  it('il donne la marche à suivre sur Brave', () => {
    expect(src.includes('brave://flags/#file-system-access-api')).toBe(true);
  });
  it('il rassure sur la sauvegarde qui, elle, fonctionne partout', () => {
    const i = src.indexOf('brave://flags');
    expect(src.slice(i - 400, i + 400).includes('Télécharger')).toBe(true);
  });
});

describe('Backups disque — les autres boutons gardent leur repli', () => {
  it('fsOpenProject retombe sur une entrée fichier classique', () => {
    const i = src.indexOf('async function fsOpenProject');
    expect(src.slice(i, i + 260).includes('!fsSupported()')).toBe(true);
  });
  it('fsSaveProject retombe sur OPFS puis téléchargement', () => {
    const i = src.indexOf('async function fsSaveProject(');
    const f = src.slice(i, i + 260);
    expect(f.includes('!fsSupported()')).toBe(true);
    expect(f.includes('saveProject()')).toBe(true);
  });
  it('les 4 boutons disque existent toujours dans le bandeau', () => {
    for (const id of ['btn-save', 'btn-fs-open', 'btn-fs-save', 'btn-fs-backup']) {
      expect(html.includes('id="' + id + '"')).toBe(true);
    }
  });
});
