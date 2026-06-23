// ── SAUVEGARDE JSON ────────────────────────────────────
function collectProjectData() {
  return {
    version: 3,
    meta: {
      nom: currentProject.nom || 'Mon projet',
      dateCreation: currentProject.dateCreation || new Date().toISOString(),
      derniereSauvegarde: new Date().toISOString(),
      application: APP_VERSION,
    },
    mise_en_page: {
      fontSize:      getDomVal('font-size'),
      lineHeight:    getDomVal('line-height'),
      indentSize:    getDomVal('indent-size'),
      pageFormat:    getDomVal('page-format'),
      folioStart:    getDomVal('folio-start')     || 1,
      headerCourant: getDomVal('header-courant')  || '',
    },
    page_de_garde: {
      titre:     getDomVal('pg-titre'),
      auteur:    getDomVal('pg-auteur'),
      soustitre: getDomVal('pg-soustitre'),
      genre:     getDomVal('pg-genre'),
    },
    fiche_oeuvre: {
      type:      getDomVal('oeuvre-type'),
      genre:     getDomVal('oeuvre-genre'),
      epoque:    getDomVal('oeuvre-epoque'),
      monde:     getDomVal('oeuvre-monde'),
      narration: getDomVal('oeuvre-narration'),
      temps:     getDomVal('oeuvre-temps'),
      registre:  getDomVal('oeuvre-registre'),
      notes:     getDomVal('oeuvre-notes'),
    },
    personnages: getPersos(),
    lieux: getLieux(),
    ia_config: (() => {
      // Exporter ia_config sans les modules (ils restent locaux dans ia_modules_state)
      const cfg = _loadIaConfig();
      const cleanConfigs = {};
      Object.entries(cfg.configs || {}).forEach(([prov, provCfg]) => {
        cleanConfigs[prov] = { key: provCfg.key || '', model: provCfg.model || '' };
        // modules: volontairement exclus du JSON de projet
      });
      return { provider: cfg.provider, configs: cleanConfigs };
    })(),
    texte: (function () {
      var _f = (typeof window !== 'undefined' && window._isolatedGetFullText) ? window._isolatedGetFullText() : null;
      return _f != null ? _f : getDomVal('raw-input');
    })(),
    images: Object.fromEntries(Object.entries(images).map(([k, v]) => [k, { ...v }])),
    chapterMeta: { ..._chapterMeta },
    prompts_ia: collectPrompts(),
    annotations: typeof _ANNOT !== 'undefined' ? _ANNOT.export() : [],
  };
}

function saveProject() {
  if (!currentProject.nom) {
    // Pas de projet actif → ouvrir la modale pour créer un nom
    openProjectModal();
    // openProjectModal() réinitialise elle-même l'état — ne pas appeler chooseNew()
    return;
  }
  const data = collectProjectData();
  currentProject.derniereSauvegarde = data.meta.derniereSauvegarde;

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  // Nom de fichier : projet_slug.json
  const slug = currentProject.nom.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'').slice(0, 40) || 'projet';
  a.href = url;
  a.download = slug + '.scrivaelo';
  a.click();
  URL.revokeObjectURL(url);
  markSaved();
  showToast(_t('toast_project_saved').replace('{file}', a.download));
}

// ── CHARGEMENT JSON ────────────────────────────────────
function loadProjectFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      applyProjectData(data, file.name);
    } catch(e) {
      showToast(_t('toast_invalid_file'));
    }
  };
  reader.readAsText(file);
  // Reset input pour permettre le rechargement du même fichier
  event.target.value = '';
}

function applyProjectData(data, fileName) {
  // Vider l'état actuel
  Object.keys(images).forEach(k => delete images[k]);
  setDomVal('raw-input', '');

  // Restaurer le texte
  if (data.texte !== undefined) setDomVal('raw-input', data.texte);

  // Restaurer les paramètres de mise en page
  if (data.mise_en_page) {
    const mp = data.mise_en_page;
    if (mp.fontSize)      setDomVal('font-size',      mp.fontSize);
    if (mp.lineHeight)    setDomVal('line-height',     mp.lineHeight);
    if (mp.indentSize)    setDomVal('indent-size',     mp.indentSize);
    if (mp.pageFormat)    setDomVal('page-format',     mp.pageFormat);
    if (mp.folioStart)    setDomVal('folio-start',     mp.folioStart);
    if (mp.headerCourant) setDomVal('header-courant',  mp.headerCourant);
  }

  // Restaurer la page de garde
  if (data.page_de_garde) {
    const pg = data.page_de_garde;
    if (pg.titre     !== undefined) setDomVal('pg-titre',     pg.titre);
    if (pg.auteur    !== undefined) setDomVal('pg-auteur',    pg.auteur);
    if (pg.soustitre !== undefined) setDomVal('pg-soustitre', pg.soustitre);
    if (pg.genre     !== undefined) setDomVal('pg-genre',     pg.genre);
  }

  // Restaurer la Fiche Œuvre
  if (data.fiche_oeuvre) {
    const fo = data.fiche_oeuvre;
    ['type','genre','epoque','monde','narration','temps','registre','notes'].forEach(k => {
      if (fo[k] !== undefined) setDomVal('oeuvre-' + k, fo[k]);
    });
    const hasData = Object.values(fo).some(v => v && v.trim && v.trim());
    if (hasData) {
      const acc = document.getElementById('acc-oeuvre');
      if (acc && !acc.classList.contains('open')) acc.classList.add('open');
    }
  }

  // Restaurer les Fiches Personnages
  if (data.personnages && Array.isArray(data.personnages)) {
    const list = document.getElementById('perso-list');
    if (list) list.innerHTML = '';
    _persoCount = 0;
    data.personnages.forEach(p => addPerso(p));
    if (data.personnages.length > 0) {
      const acc = document.getElementById('acc-persos');
      if (acc && !acc.classList.contains('open')) acc.classList.add('open');
    }
  }

  // Restaurer les Fiches Lieux
  if (data.lieux && Array.isArray(data.lieux)) {
    const list = document.getElementById('lieu-list');
    if (list) list.innerHTML = '';
    _lieuCount = 0;
    data.lieux.forEach(l => addLieu(l));
    if (data.lieux.length > 0) {
      const acc = document.getElementById('acc-lieux');
      if (acc && !acc.classList.contains('open')) acc.classList.add('open');
    }
  }

  // Restaurer la config IA & clés API (compatible ancien format + nouveau)
  // RÈGLE CRITIQUE : les clés API stockées localement ont TOUJOURS la priorité.
  // Le JSON du projet peut contenir le provider préféré et le modèle,
  // mais on NE remplace JAMAIS les clés API locales par celles du projet.
  if (data.ia_config) {
    const cfg = data.ia_config;
    const localCfg = _loadIaConfig(); // lire la config locale actuelle

    if (cfg.configs && typeof cfg.configs === 'object') {
      // Fusionner : pour chaque provider, garder la clé locale si elle existe
      Object.entries(cfg.configs).forEach(([prov, projProvCfg]) => {
        const localProvCfg = localCfg.configs[prov] || {};
        // Clé locale prioritaire, sinon clé du projet
        const key = (localProvCfg.key || '').trim() || (projProvCfg.key || '').trim();
        const model = projProvCfg.model || localProvCfg.model || '';
        // Ne JAMAIS copier les modules dans ia_config
        localCfg.configs[prov] = { key, model };
      });
      // Appliquer le provider du projet
      if (cfg.provider && AI_PROVIDERS[cfg.provider]) {
        localCfg.provider = cfg.provider;
      }
      _saveIaConfig(localCfg);

    } else if (cfg.api_keys && typeof cfg.api_keys === 'object') {
      // Ancien format → migrer en préservant les clés locales
      Object.entries(cfg.api_keys).forEach(([prov, projKey]) => {
        const localProvCfg = localCfg.configs[prov] || {};
        const key = (localProvCfg.key || '').trim() || (projKey || '').trim();
        const model = localProvCfg.model || '';
        if (key || model) localCfg.configs[prov] = { key, model };
      });
      if (cfg.provider && AI_PROVIDERS[cfg.provider]) {
        localCfg.provider = cfg.provider;
      }
      _saveIaConfig(localCfg);
    }

    // Nettoyer tous les modules qui auraient pu se glisser dans ia_config
    try {
      const cleanCfg = _loadIaConfig();
      let dirty = false;
      Object.keys(cleanCfg.configs || {}).forEach(prov => {
        if (cleanCfg.configs[prov].modules) {
          delete cleanCfg.configs[prov].modules;
          dirty = true;
        }
      });
      if (dirty) _saveIaConfig(cleanCfg);
    } catch(e) {}

    // Activer le provider sauvegardé
    const targetProv = cfg.provider || _wtProvider || 'claude';
    if (AI_PROVIDERS[targetProv] && typeof setAiProvider === 'function') {
      setAiProvider(targetProv);
    }
    // Resynchroniser les modules IA depuis ia_modules_state (débloque les boutons)
    if (typeof loadIaModulesState === 'function') {
      loadIaModulesState(targetProv);
    }
  }

  // Restaurer les images
  if (data.images) Object.entries(data.images).forEach(([k, v]) => { images[k] = { ...v }; });

  // Restaurer les statuts et verrous de chapitres
  _chapterMeta = {};
  if (data.chapterMeta) Object.entries(data.chapterMeta).forEach(([k, v]) => { _chapterMeta[k] = { ...v }; });

  // Restaurer les annotations (nouveau système) + migrer les anciennes balises
  if (typeof _ANNOT !== 'undefined') {
    _ANNOT.clear();
    if (data.annotations && Array.isArray(data.annotations)) {
      _ANNOT.import(data.annotations);
    }
    // Migration automatique des anciennes balises inline
    const ta2 = document.getElementById('raw-input');
    if (ta2) {
      const migrated = _ANNOT.migrateInlineTags(ta2.value);
      if (migrated.changed) {
        ta2.value = migrated.text;
        markUnsaved && markUnsaved();
      }
    }
    clearTimeout(window._annotRenderTimer);
    window._annotRenderTimer = setTimeout(() => _ANNOT.render(), 200);
  }

  // Restaurer les prompts IA personnalisés
  if (data.prompts_ia) applyProjectPrompts(data.prompts_ia);

  // Restaurer les méta
  const meta = data.meta || {};
  currentProject = {
    nom: meta.nom || (fileName ? fileName.replace(/\.(scrivaelo|json)$/i,'') : 'Projet chargé'),
    dateCreation: meta.dateCreation || '',
    derniereSauvegarde: meta.derniereSauvegarde || null,
  };

  updateProjectBadge();
  updateStats();
  updateSubmitInfoBox();
  syncSidebarToFormat();
  renderImgList();
  formatRoman();
  markSaved();

  // Réinitialiser les compteurs d'objectifs de mots APRÈS le chargement du texte.
  const _wcAfterLoad = countWords(getDomVal('raw-input'));
  _wgStartWords = _wcAfterLoad;
  _lastGoalPct  = 0;
  updateWordGoal();
  try {
    localStorage.setItem('atelier_daily_date',  _todayStr());
    localStorage.setItem('atelier_daily_start', String(_wcAfterLoad));
    _dailyGoalPct = 0;
  } catch(e) {}
  updateDailyWordGoal();

  const _pm_c = document.getElementById('project-modal');
  _pm_c.classList.remove('open');
  _pm_c.setAttribute('inert', '');
  showToast(_t('toast_project_loaded').replace('{nom}', currentProject.nom), 3000, 'ok');
}


