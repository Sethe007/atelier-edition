// ══════════════════════════════════════════════════════════
// ── LOCAL-FIRST : VRAIS FICHIERS DISQUE (File System Access) ─
// ══════════════════════════════════════════════════════════
// Couche ADDITIVE. Ne remplace NI saveProject() (download) NI l'autosave
// localStorage : permet d'ouvrir/enregistrer le manuscrit comme un VRAI fichier
// dans le dossier choisi par l'utilisateur, avec autosave silencieux sur ce
// fichier. Repli automatique (download / input file classiques) si l'API n'est
// pas supportée (Firefox, Safari). Réutilise collectProjectData()/applyProjectData().

let _fsHandle = null;         // FileSystemFileHandle du projet ouvert/enregistré
let _fsAutosaveBusy = false;  // évite les écritures concurrentes

function fsSupported() {
  return typeof window !== 'undefined'
    && 'showSaveFilePicker' in window
    && 'showOpenFilePicker' in window;
}

function _fsProjectFileName() {
  const nom = (typeof currentProject !== 'undefined' && currentProject && currentProject.nom) || 'projet';
  const slug = nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').slice(0, 40) || 'projet';
  return slug + '.json';
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
  const name = _fsHandle && _fsHandle.name;
  btn.title = name
    ? ('Enregistrer dans : ' + name)
    : 'Enregistrer le projet dans un fichier sur votre disque';
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
