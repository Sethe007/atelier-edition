// État global des outils
let _wtApiKey    = '';
let _wtProvider  = 'claude'; // 'claude' | 'openai' | 'gemini' | 'groq' | 'openrouter'
let _wtModel     = 'claude-sonnet-4-20250514';
let _wtActiveTab = 'correct';
// _wiktCache supprimé — moteur full IA

// ═══════════════════════════════════════════════════════════════════
// ── CONFIGURATION DES FOURNISSEURS IA ─────────────────────────────
// ═══════════════════════════════════════════════════════════════════
const AI_PROVIDERS = {
  claude: {
    label:       'Claude (Anthropic)',
    hint:        'Optionnelle — console.anthropic.com → API Keys',
    placeholder: 'sk-ant-…',
    models: [
      { value: 'claude-sonnet-4-20250514',  label: 'Claude Sonnet 4 (recommandé)' },
      { value: 'claude-opus-4-20250514',    label: 'Claude Opus 4 (puissant)' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku (rapide)' },
    ],
  },
  openai: {
    label:       'GPT (OpenAI)',
    hint:        'Optionnelle — platform.openai.com → API Keys',
    placeholder: 'sk-…',
    models: [
      { value: 'gpt-4o',        label: 'GPT-4o (recommandé)' },
      { value: 'gpt-4o-mini',   label: 'GPT-4o Mini (rapide)' },
      { value: 'gpt-4-turbo',   label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (économique)' },
    ],
  },
  gemini: {
    label:       'Gemini (Google)',
    hint:        'Optionnelle — aistudio.google.com → Get API Key',
    placeholder: 'AIza…',
    models: [
      { value: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash (recommandé)' },
      { value: 'gemini-2.0-flash',               label: 'Gemini 2.0 Flash' },
      { value: 'gemini-1.5-pro',                 label: 'Gemini 1.5 Pro' },
    ],
  },
  groq: {
    label:       'Groq (LPU — ultra-rapide)',
    hint:        'Gratuit sans CB — console.groq.com → API Keys',
    placeholder: 'gsk_…',
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (recommandé)' },
      { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B (ultra-rapide)' },
      { value: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B (contexte long)' },
      { value: 'gemma2-9b-it',            label: 'Gemma 2 9B (compact)' },
    ],
  },
  openrouter: {
    label:       'OpenRouter (200+ modèles)',
    hint:        'Clé gratuite sans CB — openrouter.ai/keys · Modèles gratuits = suffixe :free',
    placeholder: 'sk-or-v1-…',
    models: [
      { value: 'openrouter/free',                        label: '⇄ Auto — meilleur modèle gratuit dispo' },
      { value: 'tencent/hy3-preview:free',               label: 'Tencent Hy3 — Gratuit (262K ctx)' },
      { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'NVIDIA Nemotron 3 Super 120B — Gratuit' },
      { value: 'google/gemma-4-31b-it:free',             label: 'Google Gemma 4 31B — Gratuit' },
      { value: 'openai/gpt-oss-120b:free',               label: 'OpenAI GPT-OSS 120B — Gratuit' },
      { value: 'z-ai/glm-4.5-air:free',                 label: 'GLM 4.5 Air — Gratuit' },
      { value: 'anthropic/claude-sonnet-4-5',            label: 'Claude Sonnet 4.5 (payant)' },
      { value: 'openai/gpt-4o',                          label: 'GPT-4o (payant)' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════
// ── GESTIONNAIRE DE CONFIG IA — source de vérité unique ───────────
// ═══════════════════════════════════════════════════════════════════
// Toute la config IA est lue/écrite via ces deux fonctions.
// Format localStorage : 'ia_config' → { provider, configs: { claude:{key,model,modules}, … } }

// ── COUCHE DE PERSISTANCE UNIFIÉE (localStorage + IndexedDB + mémoire) ──────────────
// IndexedDB fonctionne en file:// sur Brave/Chrome/Firefox — contrairement à localStorage.
// Stratégie : trois couches maintenues en parallèle.
// Lecture  : localStorage → mémoire → IndexedDB (seed async au démarrage)
// Écriture : localStorage + mémoire + IndexedDB (simultané)

let _iaConfigMemory = null;

// ── IndexedDB helpers ─────────────────────────────────────────────────────────────────
const _IDB_NAME  = 'AtelierEdition';
const _IDB_STORE = 'settings';
const _IDB_KEY   = 'ia_config';

// OPT #4 FIX : connexion IndexedDB mise en cache pour éviter de rouvrir à chaque get/set.
let _idbConnection = null;
function _idbOpen() {
  if (_idbConnection && _idbConnection.transaction) {
    // Vérifier que la connexion est encore utilisable (pas fermée)
    try {
      _idbConnection.transaction(_IDB_STORE, 'readonly').abort();
      return Promise.resolve(_idbConnection);
    } catch(e) {
      _idbConnection = null; // connexion invalidée, on réouvre
    }
  }
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(_IDB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(_IDB_STORE)) db.createObjectStore(_IDB_STORE);
      };
      req.onsuccess = e => {
        _idbConnection = e.target.result;
        // Réinitialiser le cache si la base est fermée de l'extérieur
        _idbConnection.onclose = () => { _idbConnection = null; };
        _idbConnection.onerror = () => { _idbConnection = null; };
        resolve(_idbConnection);
      };
      req.onerror = e => reject(e.target.error);
    } catch(err) { reject(err); }
  });
}
function _idbGet(key) {
  return _idbOpen().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(_IDB_STORE, 'readonly');
    const req = tx.objectStore(_IDB_STORE).get(key);
    req.onsuccess = e => resolve(e.target.result ?? null);
    req.onerror   = e => reject(e.target.error);
  }));
}
function _idbSet(key, value) {
  return _idbOpen().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(_IDB_STORE, 'readwrite');
    const req = tx.objectStore(_IDB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  }));
}

// Seed initial : lit IndexedDB au démarrage et alimente localStorage + cache mémoire.
// S'exécute une fois, avant toute interaction utilisateur.
(function _seedIaConfigFromIdb() {
  _idbGet(_IDB_KEY).then(val => {
    if (!val) return;
    const parsed = (typeof val === 'string') ? JSON.parse(val) : val;
    // Ne remplacer localStorage que s'il est vide ou inaccessible
    try {
      if (!localStorage.getItem('ia_config')) {
        localStorage.setItem('ia_config', JSON.stringify(parsed));
      }
    } catch(e) {}
    // Alimenter le cache mémoire si encore vide (file:// sans localStorage)
    if (!_iaConfigMemory) {
      _iaConfigMemory = parsed;
      // Resynchroniser l'UI si l'app est déjà initialisée
      if (typeof setAiProvider === 'function' && parsed.provider) {
        setAiProvider(parsed.provider);
      }
    }
  }).catch(() => {});
})();

function _loadIaConfig() {
  // 1. localStorage (source de vérité principale)
  try {
    const raw = localStorage.getItem('ia_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      _iaConfigMemory = parsed; // resync cache
      return parsed;
    }
  } catch(e) {}
  // 2. Cache mémoire (seedé depuis IDB, ou session courante)
  if (_iaConfigMemory) return JSON.parse(JSON.stringify(_iaConfigMemory));
  // 3. Rien — valeur par défaut
  return { provider: 'claude', configs: {} };
}

function _saveIaConfig(cfg) {
  // Couche 1 : mémoire (toujours)
  _iaConfigMemory = cfg;
  // Couche 2 : localStorage
  try { localStorage.setItem('ia_config', JSON.stringify(cfg)); } catch(e) {}
  // Couche 3 : IndexedDB (async, non-bloquant — survit aux sessions file://)
  _idbSet(_IDB_KEY, cfg).catch(() => {});
}

function _getProviderConfig(prov) {
  const cfg = _loadIaConfig();
  const saved = cfg.configs[prov] || {};
  // Retourner uniquement key + model — les modules sont dans ia_modules_state
  return {
    key:   saved.key   || '',
    model: saved.model || AI_PROVIDERS[prov]?.models[0]?.value || '',
  };
}

// ── Changer de fournisseur (UI seulement — ne sauvegarde PAS) ─────
function setAiProvider(prov) {
  _wtProvider = prov;
  const cfg = AI_PROVIDERS[prov];
  if (!cfg) return;

  // Boutons actifs (panneau outil + modale settings)
  ['claude','openai','gemini','groq','openrouter'].forEach(p => {
    document.getElementById('prov-' + p)?.classList.toggle('active', p === prov);
    document.getElementById('sm-prov-' + p)?.classList.toggle('active', p === prov);
  });

  // Placeholder + hint
  const keyEl = document.getElementById('wt-api-key');
  const hintEl = document.getElementById('wt-provider-hint');
  if (keyEl) keyEl.placeholder = cfg.placeholder;
  if (hintEl) hintEl.textContent = cfg.hint;

  // Charger la config sauvegardée pour ce provider
  const provCfg = _getProviderConfig(prov);

  // Remplir champ clé (panneau + modale)
  _wtApiKey = provCfg.key || '';
  if (keyEl) keyEl.value = _wtApiKey;
  const smKey = document.getElementById('sm-api-key');
  if (smKey) smKey.value = _wtApiKey;

  // Remplir select modèles (panneau)
  const sel = document.getElementById('wt-model-select');
  if (sel) {
    sel.innerHTML = cfg.models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
    _wtModel = provCfg.model && cfg.models.find(m => m.value === provCfg.model)
      ? provCfg.model : cfg.models[0].value;
    sel.value = _wtModel;
  }

  // Remplir select modèles (modale)
  const smSel = document.getElementById('sm-model-select');
  if (smSel) {
    smSel.innerHTML = cfg.models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
    smSel.value = _wtModel;
  }

  // Charger modules pour ce provider
  loadIaModulesState(prov);

  // Mettre à jour le hint dans la modale
  const hintMap = {
    claude: 'console.anthropic.com → API Keys',
    openai: 'platform.openai.com → API Keys',
    gemini: 'aistudio.google.com → Get API key',
    groq:   'console.groq.com → API Keys (gratuit)',
    openrouter: 'openrouter.ai/keys (gratuit)',
  };
  const smHint = document.getElementById('sm-provider-hint-label');
  if (smHint) smHint.textContent = '— ' + (hintMap[prov] || '');

  // Statut clé dans modale
  const smStatus = document.getElementById('sm-api-status');
  if (smStatus) {
    if (_wtApiKey) {
      smStatus.textContent = '✓ Clé configurée pour ce fournisseur';
      smStatus.style.color = '#10b981';
    } else {
      smStatus.textContent = 'Aucune clé enregistrée pour ce fournisseur.';
      smStatus.style.color = 'var(--ink-muted)';
    }
  }

  _updateApiDot();
  updateWtApiCompactLabel();
}

function onModelChange() {
  _wtModel = document.getElementById('wt-model-select')?.value || _wtModel;
  // Sync modale
  const smSel = document.getElementById('sm-model-select');
  if (smSel) smSel.value = _wtModel;
  // NE PAS sauvegarder ici — l'utilisateur doit cliquer "Enregistrer"
}

// ── Enregistrement explicite de la config provider ────────────────
// Appelé UNIQUEMENT par le bouton "💾 Enregistrer" de la modale.
function saveProviderConfig() {
  const smKey   = document.getElementById('sm-api-key');
  const smModel = document.getElementById('sm-model-select');
  const key   = (smKey?.value || '').trim();
  const model = smModel?.value || _wtModel;

  // ── Sauvegarder les modules dans leur propre clé (SÉPARÉE de ia_config) ──
  // Ceci évite que les modules écrasent/corrompent les clés API lors du rechargement.
  const modulesState = {};
  for (const toggleId of Object.keys(_IA_MODULE_MAP)) {
    modulesState[toggleId] = document.getElementById(toggleId)?.checked ?? true;
  }
  try {
    const allModules = JSON.parse(localStorage.getItem('ia_modules_state') || '{}');
    allModules[_wtProvider] = modulesState;
    localStorage.setItem('ia_modules_state', JSON.stringify(allModules));
  } catch(e) {}

  // ── Mettre à jour ia_config avec UNIQUEMENT clé + modèle (pas les modules) ──
  const globalCfg = _loadIaConfig();
  globalCfg.provider = _wtProvider;
  // Préserver les données existantes du provider, mettre à jour uniquement key+model
  const existingProvCfg = globalCfg.configs[_wtProvider] || {};
  globalCfg.configs[_wtProvider] = { key, model };
  // Supprimer les modules s'ils ont été stockés par erreur dans ia_config
  delete globalCfg.configs[_wtProvider].modules;
  _saveIaConfig(globalCfg);

  // Mettre à jour les variables runtime
  _wtApiKey = key;
  _wtModel  = model;

  // Synchroniser le panneau outil
  const keyEl = document.getElementById('wt-api-key');
  if (keyEl) keyEl.value = key;
  const sel = document.getElementById('wt-model-select');
  if (sel) sel.value = model;

  // Mettre à jour l'état visuel
  _updateApiDot();
  updateWtApiCompactLabel();
  updateIaModules();

  // Feedback
  showToast(_t('toast_config_saved').replace('{provider}', AI_PROVIDERS[_wtProvider]?.label || _wtProvider), 2500, 'ok');
  const smStatus = document.getElementById('sm-api-status');
  if (smStatus) {
    smStatus.textContent = key ? '✓ Clé et configuration enregistrées.' : '⚠ Aucune clé saisie — fournisseur sans clé.';
    smStatus.style.color = key ? '#10b981' : '#f59e0b';
  }
}

// Alias de compatibilité (appelé par l'ancien code)
function saveApiKey() { saveProviderConfig(); }
function saveApiKeyFromModal() { saveProviderConfig(); }

function loadApiKey() {
  // Charger le provider actif depuis la config unifiée
  const cfg = _loadIaConfig();
  const prov = (cfg.provider && AI_PROVIDERS[cfg.provider]) ? cfg.provider : 'claude';
  _wtProvider = prov;
  setAiProvider(prov);
}

// ── Toggle panneau outils ──────────────────────────────
function toggleWritingTools() {
  // Le panneau outils est maintenant dans la sidebar — on bascule vers le correcteur par défaut
  const isOutils = document.getElementById('nrb-correct') && document.getElementById('nrb-correct').classList.contains('active');
  if (isOutils) {
    switchSidebarTab('mise'); // fermer → retour mise en page
  } else {
    switchSidebarToolTab('correct');
  }
  // Compat: badge toolbar
  const btn = document.getElementById('wt-toggle-btn');
  if (btn) btn.classList.toggle('active', !isOutils);
}

// ── Tabs ───────────────────────────────────────────────
function switchWtTab(tab) {
  _wtActiveTab = tab;
  ['correct','style','stats','syn','rapport','coherence'].forEach(t => {
    const tabEl = document.getElementById('wt-tab-' + t);
    if (tabEl) tabEl.classList.toggle('active', t === tab);
    const paneEl = document.getElementById('wt-pane-' + t);
    if (paneEl) paneEl.style.display = t === tab ? '' : 'none';
  });
  // Rapport n'est plus un onglet — si appelé, juste afficher le panneau
  if (tab === 'rapport') {
    const rapportPane = document.getElementById('wt-pane-rapport');
    if (rapportPane) rapportPane.style.display = '';
  }
  // Mettre à jour le titre du panneau sidebar
  const toolTabLabels = { correct: 'Correcteur', style: 'Analyse de style', stats: 'Statistiques avancées', syn: 'Synonymes', coherence: 'Cohérence narrative', rapport: 'Rapport éditorial' };
  const titleEl = document.getElementById('sidebar-panel-title');
  if (titleEl && toolTabLabels[tab]) titleEl.textContent = toolTabLabels[tab];
}

// ── Onglets outils dissociés dans la nav-rail ──────────
function switchSidebarToolTab(wtTab) {
  // Ouvre le panneau outils et active directement le bon sous-onglet
  switchSidebarTab('outils');
  switchWtTab(wtTab);
  // Mettre à jour l'état actif des boutons outils nav-rail
  const toolRailMap = { correct:'nrb-correct', style:'nrb-style', stats:'nrb-stats-adv', syn:'nrb-syn', coherence:'nrb-coherence' };
  Object.entries(toolRailMap).forEach(([tab, btnId]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      const isActive = tab === wtTab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  });
  if (wtTab === 'correct' || wtTab === 'style' || wtTab === 'syn' || wtTab === 'coherence') {
    _updateApiDot && _updateApiDot();
  }
}

// ── Onglets sidebar ────────────────────────────────────
function switchSidebarTab(name) {
  // Structure fusionnée dans corkboard
  if (name === 'structure') name = 'corkboard';
  // Tous les panneaux connus
  const allPanes = ['mise','notes','images','stats','outils','versions','corkboard'];
  const flexPanes = new Set(['notes','stats','outils']); // panneaux display:flex

  const panelLabels = {
    mise: 'Mise en page', images: 'Images',
    notes: 'Notes', stats: 'Statistiques', outils: 'Outils d\'écriture',
    versions: 'Versions', corkboard: 'Vue carte',
  };
  const toolTabLabels = { correct: 'Correcteur', style: 'Analyse de style', stats: 'Statistiques avancées', syn: 'Synonymes', coherence: 'Cohérence narrative' };

  allPanes.forEach(n => {
    const pane = document.getElementById('sb-pane-' + n);
    if (pane) {
      const isActive = n === name;
      pane.classList.toggle('active', isActive);
      if (flexPanes.has(n)) {
        pane.style.display = isActive ? 'flex' : 'none';
      } else {
        pane.style.display = isActive ? '' : 'none';
        if (isActive) pane.classList.add('active'); else pane.classList.remove('active');
      }
    }
    // Anciens onglets texte (masqués, compat)
    const tab = document.getElementById('sb-tab-' + n);
    if (tab) tab.classList.toggle('active', n === name);
  });

  // Titre du panneau
  const titleEl = document.getElementById('sidebar-panel-title');
  if (titleEl) {
    if (name === 'outils') {
      // Titre affiné selon l'onglet actif
      titleEl.textContent = toolTabLabels[_wtActiveTab] || 'Outils d\'écriture';
    } else if (panelLabels[name]) {
      titleEl.textContent = panelLabels[name];
    }
  }

  // Mettre à jour les boutons nav-rail non-outils
  const railMap = { mise:'nrb-mise', images:'nrb-images', notes:'nrb-notes', stats:'nrb-stats', versions:'nrb-versions', corkboard:'nrb-corkboard' };
  Object.entries(railMap).forEach(([pane, btnId]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      const isActive = pane === name;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  });
  // Désactiver les boutons outils si on quitte le panneau outils
  if (name !== 'outils') {
    ['nrb-correct','nrb-style','nrb-stats-adv','nrb-syn','nrb-coherence'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); }
    });
  }

  if (name === 'notes') notesRefresh();
  // Sync dot API pour le panneau outils
  if (name === 'outils') { _updateApiDot && _updateApiDot(); _synUpdateDot && _synUpdateDot(); }
  // Refresh des panneaux dynamiques
  if (name === 'corkboard') corkboardRender();
  if (name === 'versions') versionsPopulateChapters();
}

// ── Zone API rétractable ───────────────────────────────
function toggleApiSection() {
  const section = document.getElementById('wt-api-section');
  if (!section) return;
  section.classList.toggle('open');
}

function _updateApiDot() {
  const hasKey = !!(_wtApiKey || (getDomVal('wt-api-key').trim()));
  ['wt-api-dot', 'wt-api-dot-sb'].forEach(id => {
    const dot = document.getElementById(id);
    if (dot) dot.classList.toggle('ok', hasKey);
  });
  // Sync dot synonymes
  _synUpdateDot && _synUpdateDot();
}

// Ouvre la zone API si aucune clé n'est encore configurée
function _initApiSection() {
  const section = document.getElementById('wt-api-section');
  if (!section) return;
  const hasKey = !!(_wtApiKey || (getDomVal('wt-api-key').trim()));
  if (!hasKey) section.classList.add('open');
  _updateApiDot();
}

// ── Badge erreurs sur le bouton Outils ────────────────
function updateErrorBadge(count) {
  // Badge toolbar (rétrocompat)
  const badge = document.getElementById('wt-error-badge');
  if (badge) {
    if (count > 0) { badge.textContent = count > 99 ? '99+' : String(count); badge.style.display = 'block'; }
    else { badge.style.display = 'none'; }
  }
  // Badge nav-rail
  const railBadge = document.getElementById('wt-error-badge-rail');
  if (railBadge) {
    if (count > 0) { railBadge.textContent = count > 99 ? '99+' : String(count); railBadge.style.display = 'flex'; }
    else { railBadge.style.display = 'none'; }
  }
}

// ── Effacer avec confirm (P5) ─────────────────────────
function clearAllSafe() {
  if (!confirm(_t('confirm_clear_text'))) return;
  setDomVal('raw-input', '');
  if (typeof paginateNodes === 'function') paginateNodes([], []);
  if (typeof updateStats  === 'function') updateStats();
  if (typeof updateChapterList === 'function') updateChapterList([]);
  if (typeof markUnsaved === 'function') markUnsaved();
  showToast(_t('toast_text_cleared'));
}

// ── Raccourcis clavier pour les outils ────────────────
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey) {
    switch(e.key) {
      case 'O': e.preventDefault(); toggleWritingTools(); break;
      case 'T': e.preventDefault(); toggleTypewriter(); break;
      case 'N': e.preventDefault();
        if (document.activeElement === document.getElementById('raw-input')) insertComment();
        break;
      case 'C': e.preventDefault(); switchSidebarToolTab('correct'); break;
      case 'Y': e.preventDefault(); switchSidebarToolTab('style'); break;
      case 'Q': e.preventDefault(); switchSidebarToolTab('stats'); break;
      case 'S': e.preventDefault(); switchSidebarToolTab('syn'); break;
    }
  }
});



