// ══════════════════════════════════════════════════════════
// ── LOCAL-FIRST : VRAIS FICHIERS DISQUE (File System Access) ─
// ══════════════════════════════════════════════════════════
// Couche ADDITIVE. Ne remplace NI saveProject() (download) NI l'autosave
// localStorage : permet d'ouvrir/enregistrer le manuscrit comme un VRAI fichier
// dans le dossier choisi par l'utilisateur, avec autosave silencieux sur ce
// fichier ET des backups versionnés horodatés. Repli automatique (download /
// input file classiques) si l'API n'est pas supportée (Firefox, Safari).
// Réutilise collectProjectData() / applyProjectData().

let _fsHandle = null;          // FileSystemFileHandle du projet ouvert/enregistré
let _fsAutosaveBusy = false;   // évite les écritures concurrentes
let _fsBackupDir = null;       // FileSystemDirectoryHandle du dossier de backups
const _FS_BACKUP_KEEP = 15;    // nombre de backups conservés par projet

function fsSupported() {
  return typeof window !== 'undefined'
    && 'showSaveFilePicker' in window
    && 'showOpenFilePicker' in window;
}

function _fsSlug() {
  const nom = (typeof currentProject !== 'undefined' && currentProject && currentProject.nom) || 'projet';
  return nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').slice(0, 40) || 'projet';
}

function _fsProjectFileName() {
  return _fsSlug() + '.json';
}

async function _fsWrite(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

async function _fsHasPermission(handle, readwrite) {
  const opts = readwrite ? { mode: 'readwrite' } : {};
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

function _fsToast(msg, dur, type) {
  if (typeof showToast === 'function') showToast(msg, dur, type);
}

function _fsUpdateButton() {
  const btn = document.getElementById('btn-fs-save');
  if (!btn) return;
  const span = btn.querySelector('span');
  const _F = (typeof _t === 'function') ? _t('tb_file') : 'Fichier';
  const name = _fsHandle && _fsHandle.name;
  if (name) {
    btn.title = 'Enregistré dans : ' + name;
    btn.removeAttribute('data-fs-warn');
    if (span) span.textContent = _F;
  } else if (fsSupported()) {
    btn.title = (typeof _t === 'function') ? _t('tb_file_warn') : '\u26A0 Aucun fichier disque ouvert.';
    btn.setAttribute('data-fs-warn', '1');
    if (span) span.textContent = _F + ' \u26A0';
  } else {
    btn.title = 'Télécharger le projet dans un fichier';
    btn.removeAttribute('data-fs-warn');
    if (span) span.textContent = _F;
  }
}

// ── Ouvrir un projet depuis un VRAI fichier ────────────────
async function fsOpenProject() {
  if (!fsSupported()) {            // repli : input file classique
    const inp = document.getElementById('project-load-input');
    if (inp) inp.click();
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Projet Atelier', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });
    const file = await handle.getFile();
    const data = JSON.parse(await file.text());
    applyProjectData(data, file.name);
    _fsHandle = handle;
    _fsUpdateButton();
    if (typeof markSaved === 'function') markSaved();
    _fsToast('📂 Projet ouvert : ' + file.name);
  } catch (e) {
    if (e && e.name === 'AbortError') return; // annulé par l'utilisateur
    console.warn('fsOpenProject échec :', e);
    _fsToast('Ouverture du fichier impossible.', 5000, 'error');
  }
}

// ── Enregistrer dans le fichier courant (sinon « Enregistrer sous ») ─
async function fsSaveProject() {
  if (!fsSupported()) { saveProject(); return; } // repli : download
  try {
    if (!_fsHandle) return fsSaveProjectAs();
    if (!(await _fsHasPermission(_fsHandle, true))) return fsSaveProjectAs();
    const data = collectProjectData();
    await _fsWrite(_fsHandle, JSON.stringify(data, null, 2));
    if (typeof currentProject !== 'undefined' && currentProject) {
      currentProject.derniereSauvegarde = data.meta.derniereSauvegarde;
    }
    if (typeof markSaved === 'function') markSaved();
    _fsToast('💾 Enregistré : ' + (_fsHandle.name || _fsProjectFileName()));
    fsWriteBackup();
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    console.warn('fsSaveProject échec :', e);
    _fsToast('Enregistrement impossible.', 5000, 'error');
  }
}

// ── Enregistrer sous (toujours un nouveau fichier) ─────────
async function fsSaveProjectAs() {
  if (!fsSupported()) { saveProject(); return; }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: _fsProjectFileName(),
      types: [{ description: 'Projet Atelier', accept: { 'application/json': ['.json'] } }],
    });
    const data = collectProjectData();
    await _fsWrite(handle, JSON.stringify(data, null, 2));
    _fsHandle = handle;
    _fsUpdateButton();
    if (typeof currentProject !== 'undefined' && currentProject) {
      currentProject.derniereSauvegarde = data.meta.derniereSauvegarde;
    }
    if (typeof markSaved === 'function') markSaved();
    _fsToast('💾 Enregistré : ' + (handle.name || _fsProjectFileName()));
    fsWriteBackup();
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    console.warn('fsSaveProjectAs échec :', e);
    _fsToast('Enregistrement impossible.', 5000, 'error');
  }
}

// ── Autosave silencieux vers le fichier (si un fichier est ouvert) ─
async function fsAutosaveToFile() {
  if (!fsSupported() || !_fsHandle || _fsAutosaveBusy) return;
  _fsAutosaveBusy = true;
  try {
    if ((await _fsHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') return;
    const data = collectProjectData();
    await _fsWrite(_fsHandle, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('Autosave fichier échoué :', e);
  } finally {
    _fsAutosaveBusy = false;
  }
}

// ── L'utilisateur n'a PAS de fichier disque actif (stockage navigateur seul) ─
function fsUsingBrowserStorageOnly() {
  return !_fsHandle;
}

// ══════════════════════════════════════════════════════════
// ── BACKUPS VERSIONNÉS SUR DISQUE ──────────────────────────
// ══════════════════════════════════════════════════════════
// Un dossier choisi par l'utilisateur reçoit, à chaque enregistrement, une copie
// horodatée « slug-AAAAMMJJ-HHmmss.json ». On conserve les _FS_BACKUP_KEEP plus
// récents par projet. Restauration : il suffit d'ouvrir le backup via « Ouvrir »
// (c'est un fichier projet standard). Le dossier est mémorisé via IndexedDB.

function _fsTimestamp(d) {
  d = d || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
    + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

// Pur : parmi `names`, renvoie les backups de ce projet à supprimer (au-delà de keep).
function _fsSelectBackupsToDelete(names, slug, keep) {
  const esc = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + esc + '-\\d{8}-\\d{6}\\.json$'); // slug-AAAAMMJJ-HHmmss.json STRICT
  const mine = names.filter((n) => re.test(n));
  mine.sort(); // l'horodatage trie chronologiquement
  return mine.slice(0, Math.max(0, mine.length - keep));
}

function _fsIdb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('atelier_fs', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function _fsIdbSet(key, val) {
  const db = await _fsIdb();
  return new Promise((res, rej) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function _fsIdbGet(key) {
  const db = await _fsIdb();
  return new Promise((res, rej) => {
    const tx = db.transaction('handles', 'readonly');
    const r = tx.objectStore('handles').get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// Choisir (ou changer) le dossier de backups.
async function fsChooseBackupFolder() {
  if (!fsSupported() || !('showDirectoryPicker' in window)) {
    _fsToast('Votre navigateur ne permet pas les backups sur disque.', 5000, 'error');
    return;
  }
  try {
    const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
    _fsBackupDir = dir;
    try { await _fsIdbSet('backupDir', dir); } catch (e) {}
    _fsToast('📦 Dossier de backups défini : ' + (dir.name || 'dossier'));
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    console.warn('fsChooseBackupFolder échec :', e);
  }
}

async function _fsRestoreBackupDir() {
  try {
    const dir = await _fsIdbGet('backupDir');
    if (dir) _fsBackupDir = dir;
  } catch (e) {}
}

// Écrit une copie horodatée dans le dossier de backups, puis élague.
async function fsWriteBackup() {
  if (!fsSupported() || !_fsBackupDir) return;
  try {
    if (!(await _fsHasPermission(_fsBackupDir, true))) return;
    const slug = _fsSlug();
    const name = slug + '-' + _fsTimestamp() + '.json';
    const data = collectProjectData();
    const fh = await _fsBackupDir.getFileHandle(name, { create: true });
    await _fsWrite(fh, JSON.stringify(data, null, 2));
    // Élagage : ne garder que les _FS_BACKUP_KEEP plus récents
    const names = [];
    for await (const [n, h] of _fsBackupDir.entries()) {
      if (h.kind === 'file') names.push(n);
    }
    const toDelete = _fsSelectBackupsToDelete(names, slug, _FS_BACKUP_KEEP);
    for (const n of toDelete) {
      try { await _fsBackupDir.removeEntry(n); } catch (e) {}
    }
  } catch (e) {
    console.warn('Backup disque échoué :', e);
  }
}

// Init : état du bouton + restauration du dossier de backups au chargement.
if (typeof document !== 'undefined') {
  const _fsInit = function () {
    try { _fsUpdateButton(); } catch (e) {}
    try { _fsRestoreBackupDir(); } catch (e) {}
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _fsInit);
  } else {
    _fsInit();
  }
}
