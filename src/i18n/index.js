// ── MOTEUR I18N — ATELIER ÉDITION ─────────────────────────────────────────────
//
// Architecture :
//   src/i18n/index.js   ← ce fichier — moteur + registre
//   src/i18n/fr.js      ← catalogue français  (langue par défaut)
//   src/i18n/en.js      ← catalogue anglais
//   src/i18n/es.js      ← catalogue espagnol
//
// Ordre de chargement (voir vite.config.js) :
//   index.js → fr.js → en.js → es.js
//   Chaque fichier langue appelle _registerLang('code', { ...clés... })
//   qui injecte le catalogue dans window._i18n.
//
// API publique :
//   _t(key)         → traduction dans la langue courante de l'UI
//   _nt(key, fb)    → idem, avec fallback explicite si clé absente
//   applyI18n()     → applique toutes les traductions au DOM
//   buildLangInstruction() → instruction de langue pour les prompts IA
// ─────────────────────────────────────────────────────────────────────────────

// ── Registre global des catalogues ────────────────────────────────────────────
// Initialisé vide — chaque fr.js/en.js/es.js l'enrichit via _registerLang().
window._i18n = window._i18n || {};
// Alias local — permet d'écrire _i18n[...] au lieu de window._i18n[...]
var _i18n = window._i18n;

/**
 * Enregistre un catalogue de traductions pour un code langue donné.
 * Appelé par chaque fichier fr.js / en.js / es.js.
 * @param {string} langCode  ex: 'fr', 'en', 'es'
 * @param {Object} catalogue Objet clé → chaîne traduite
 */
function _registerLang(langCode, catalogue) {
  window._i18n[langCode] = catalogue;
}

// ── Labels langue pour les prompts IA ─────────────────────────────────────────
const LANGUE_LABELS = {
  fr: 'français',
  en: 'English',
  es: 'español',
  de: 'Deutsch',
  it: 'italiano',
  pt: 'português',
  nl: 'Nederlands',
  pl: 'polski',
  ar: 'العربية',
  zh: '中文',
  ja: '日本語',
};

/**
 * Construit l'instruction de langue à injecter en tête de chaque system prompt.
 * Position en tête = priorité maximale pour tous les modèles IA.
 */


// ── Helper : traduction courte ─────────────────────────────────────────────────
// Usage : _t('key') → string dans la langue courante de l'interface
function _t(key) {
  const lang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
  const _EN = _i18n['en'], _FR = _i18n['fr'];
  if (_i18n[lang] && _i18n[lang][key] !== undefined) return _i18n[lang][key];
  if (_EN && _EN[key] !== undefined) return _EN[key];
  return (_FR && _FR[key] !== undefined) ? _FR[key] : key;
}

// ── Fonction principale d'application des traductions ─────────────────────────
function applyI18n() {
  const lang = getPref('ui_lang') || 'fr';
  const t = Object.assign({}, _i18n['fr'] || {}, _i18n['en'] || {}, _i18n[lang] || {}); // repli : langue > anglais > français

  // 1. data-i18n → textContent
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });

  // 2. data-i18n-title → title attribute (ou data-title pour .wt-tab déjà liés)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key] !== undefined) {
      if (el._wtTipBound) {
        el.setAttribute('data-title', t[key]); // tooltip fixe JS, pas d'attribut title natif
      } else {
        el.title = t[key];
      }
    }
  });

  // 3. data-i18n-placeholder → placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key] !== undefined) el.placeholder = t[key];
  });

  // 4b. data-i18n-label → label attribute (pour optgroup)
  document.querySelectorAll('[data-i18n-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-label');
    if (t[key] !== undefined) el.label = t[key];
  });

  // 4c. data-i18n-aria-label → aria-label attribute
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (t[key] !== undefined) el.setAttribute('aria-label', t[key]);
  });

  // 4. Éléments dynamiques — générés par JS, pas dans le DOM statique
  // Statusbar
  const sbSel = document.getElementById('sb-sel-wrap');
  if (sbSel) {
    // Trouve le nœud texte après le span (garde le span, remplace " sélectionnés")
    const span = sbSel.querySelector('.statusbar-sel');
    if (span) {
      // Replace text nodes after the span
      Array.from(sbSel.childNodes).forEach(node => {
        if (node.nodeType === 3) node.textContent = ' ' + t['sb_selected'];
      });
    }
  }

  // Autosave badge
  const autosaveBadge = document.getElementById('autosave-badge');
  if (autosaveBadge && autosaveBadge.textContent && !autosaveBadge.dataset.saving) {
    autosaveBadge.textContent = t['autosave_badge'];
  }

  // Focus mode hint
  const focusHint = document.querySelector('.focus-mode-hint');
  if (focusHint) focusHint.textContent = t['focus_hint'];

  // No-chapters placeholder
  const noChapters = document.querySelector('.no-chapters');
  if (noChapters) noChapters.textContent = t['no_chapters'];

  // Preview placeholder
  const previewPlaceholder = document.querySelector('.preview-placeholder p');
  if (previewPlaceholder) previewPlaceholder.textContent = t['preview_placeholder'];

  // Textarea placeholder (raw-input)
  const rawInput = document.getElementById('raw-input');
  if (rawInput) {
    if (lang === 'en') {
      rawInput.placeholder = `Paste your novel text here...\n\nThe app automatically detects:\n• Chapter titles (Chapter I, CHAPTER ONE, I., etc.)\n• Subtitles and scenes\n• Scene breaks (*** or ---)\n\nIt then applies publishing standards:\n• Justified text with paragraph indentation\n• Centered, hierarchical and well-sized titles\n• Professional typography\n\nTip: type [IMAGE:name] where you want to place an image.`;
    } else if (lang === 'es') {
      rawInput.placeholder = `Pegue aquí el texto de su novela...\n\nLa aplicación detecta automáticamente:\n• Títulos de capítulos (Capítulo I, CAPÍTULO UNO, I., etc.)\n• Subtítulos y escenas\n• Saltos de escena (*** o ---)\n\nLuego aplica los estándares editoriales:\n• Texto justificado con tabulación al inicio del párrafo\n• Títulos centrados, jerarquizados y bien dimensionados\n• Tipografía profesional\n\nConsejo: escriba [IMAGE:nombre] donde desee colocar una imagen.`;
    } else {
      rawInput.placeholder = `Collez ici le texte de votre roman...\n\nL'application détecte automatiquement :\n• Les titres de chapitres (Chapitre I, CHAPITRE UN, I., etc.)\n• Les sous-titres et scènes\n• Les sauts de scène (*** ou ---)\n\nElle applique ensuite les standards de l'édition :\n• Texte justifié avec tabulation en début de paragraphe\n• Titres centrés, hiérarchisés et bien dimensionnés\n• Typographie professionnelle\n\nAstuce : tapez [IMAGE:nom] là où vous voulez placer une image.`;
    }
  }

  // Projet modal summary default
  const miseProjMeta = document.getElementById('mise-proj-meta');
  if (miseProjMeta && miseProjMeta.textContent === _i18n['fr']['mise_proj_meta']) {
    miseProjMeta.textContent = t['mise_proj_meta'];
  }
  const miseProjTitle = document.getElementById('mise-proj-title');
  if (miseProjTitle) {
    const cur = miseProjTitle.textContent.trim();
    const isFrDefault = cur === _i18n['fr']['mise_proj_title_default'];
    const isEnDefault = cur === _i18n['en']['mise_proj_title_default'];
    const isEsDefault = cur === _i18n['es']['mise_proj_title_default'];
    if (isFrDefault || isEnDefault || isEsDefault) {
      miseProjTitle.textContent = t['mise_proj_title_default'];
    }
  }

  // Settings modal — éléments pas taggués en HTML pour éviter de toucher aux longs blocs
  _applyI18nSettingsModal(t);

  // Notes panel dynamic labels
  _applyI18nNotesPanel(t);

  // Writing tools panel dynamic labels
  _applyI18nWritingTools(t);

  // Project modal
  _applyI18nProjectModal(t);

  // Prompts pane badges (si ouvert)
  _applyI18nPromptsBadges(t);

  // Update html lang attribute
  document.documentElement.lang = lang;

  // ── Nouveaux éléments dynamiques ──────────────────────
  // Pomodoro
  _pomoRefreshUI && _pomoRefreshUI();
  // Breadcrumb
  const bcRoot = document.getElementById('bc-root');
  if (bcRoot) bcRoot.textContent = t['bc_novel'] || 'Roman';
  // Répétitions — panneau titre
  const repTitle = document.querySelector('#rep-panel [data-i18n="rep_title"]');
  if (repTitle) repTitle.textContent = t['rep_title'] || 'Répétitions proches';
  // Smart quotes indicator
  const sqInd = document.getElementById('smartquotes-indicator');
  if (sqInd) sqInd.title = t[_smartQuotesEnabled ? 'title_smartquotes' : 'title_smartquotes_off'] || sqInd.title;
  // Nav history buttons
  const nbk = document.getElementById('nav-back-btn');
  const nfw = document.getElementById('nav-fwd-btn');
  if (nbk) nbk.title = t['title_nav_back'] || 'Position précédente';
  if (nfw) nfw.title = t['title_nav_fwd']  || 'Position suivante';

  // Recherche globale — footer hint (si la modale est ouverte)
  const gsFooterHint = document.getElementById('gs-footer-hint');
  if (gsFooterHint) gsFooterHint.textContent = t['gs_footer_hint'] || '↑↓ naviguer · Entrée accéder · Échap fermer';

  // ── Statuts de chapitres déjà rendus dans le DOM ──────────────────────────
  // Les boutons .ch-status ont leur title figé au moment de updateChapterList().
  // On les relit tous et on applique le titre traduit selon leur data-st courant.
  document.querySelectorAll('.ch-status[data-st]').forEach(btn => {
    const idx = parseInt(btn.dataset.st, 10);
    if (!isNaN(idx) && CH_STATUS[idx]) btn.title = CH_STATUS[idx].title;
  });

  // ── Verrou chapitres déjà rendus ─────────────────────────────────────────
  document.querySelectorAll('.ch-lock').forEach(btn => {
    btn.title = btn.classList.contains('locked')
      ? (t['ch_unlock_label'] || 'Chapitre verrouillé — cliquez pour déverrouiller')
      : (t['ch_lock_label']   || 'Verrouiller ce chapitre');
  });

  // ── Bouton Tags dans la liste des chapitres ───────────────────────────────
  document.querySelectorAll('.ch-tag-btn').forEach(btn => {
    btn.title = t['ch_tag_btn'] || 'Tags';
  });

  // ── Vue carte (corkboard) — re-rendre si le panneau est ouvert ──────────
  const corkPane = document.getElementById('sb-pane-corkboard');
  if (corkPane && corkPane.style.display !== 'none') {
    typeof corkboardRender === 'function' && corkboardRender();
  }

  // ── Dropdown versions — option placeholder ────────────────────────────────
  const versSel = document.getElementById('versions-chapter-sel');
  if (versSel && versSel.options[0] && versSel.options[0].value === '') {
    versSel.options[0].textContent = t['versions_select_chapter'] || '— Choisir un chapitre —';
  }
}

function _applyI18nSettingsModal(t) {
  // Modal title & sub
  const smTitle = document.querySelector('.settings-modal-title');
  if (smTitle) smTitle.textContent = t['settings_modal_title'];
  const smSub = document.querySelector('.settings-modal-sub');
  if (smSub) smSub.textContent = t['settings_modal_sub'];

  // Tabs
  const tabMap = {
    'stab-oeuvre':  'stab_oeuvre',
    'stab-auteur':  'stab_auteur',
    'stab-persos':  'stab_persos',
    'stab-lieux':   'stab_lieux',
    'stab-api':     'stab_api',
    'stab-prompts': 'stab_prompts',
    'stab-prefs':   'stab_prefs',
  };
  Object.entries(tabMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t[key];
  });

  // Close button
  const closeBtn = document.querySelector('.settings-modal-close');
  if (closeBtn) closeBtn.title = t['title_close'] || 'Fermer (Échap)';

  // Footer close btn
  const footerClose = document.querySelector('.settings-modal-footer .btn-accent');
  if (footerClose) footerClose.textContent = t['settings_close_btn'];
  const footerNote = document.querySelector('.settings-modal-footer span');
  if (footerNote) footerNote.textContent = t['settings_footer_note'];

  // Pane: Œuvre
  const paneOeuvreTitle = document.querySelector('#spane-oeuvre .settings-section-title');
  if (paneOeuvreTitle) paneOeuvreTitle.textContent = t['settings_oeuvre_title'];
  const paneOeuvreHint = document.querySelector('#spane-oeuvre .settings-hint');
  if (paneOeuvreHint) paneOeuvreHint.textContent = t['settings_oeuvre_hint'];

  // Pane: Auteur
  const paneAuteurTitle = document.querySelector('#spane-auteur .settings-section-title');
  if (paneAuteurTitle) paneAuteurTitle.textContent = t['settings_auteur_title'];
  const paneAuteurHint = document.querySelector('#spane-auteur .settings-hint');
  if (paneAuteurHint) paneAuteurHint.textContent = t['settings_auteur_hint'];

  // Pane: Persos
  const panePersoTitle = document.querySelector('#spane-persos .settings-section-title');
  if (panePersoTitle) panePersoTitle.textContent = t['settings_persos_title'];
  const panePersoHint = document.querySelector('#spane-persos .settings-hint');
  if (panePersoHint) panePersoHint.textContent = t['settings_persos_hint'];
  const panePersoAdd = document.querySelector('#spane-persos > button');
  if (panePersoAdd) panePersoAdd.textContent = t['settings_persos_add'];

  // Pane: Lieux
  const paneLieuTitle = document.querySelector('#spane-lieux .settings-section-title');
  if (paneLieuTitle) paneLieuTitle.textContent = t['settings_lieux_title'];
  const paneLieuHint = document.querySelector('#spane-lieux .settings-hint');
  if (paneLieuHint) paneLieuHint.textContent = t['settings_lieux_hint'];
  const paneLieuAdd = document.querySelector('#spane-lieux > button');
  if (paneLieuAdd) paneLieuAdd.textContent = t['settings_lieux_add'];

  // Pane: API
  const paneApiTitle = document.querySelector('#spane-api .settings-section-title');
  if (paneApiTitle) paneApiTitle.textContent = t['settings_api_title'];
  const paneApiHint = document.querySelector('#spane-api .settings-hint');
  if (paneApiHint) paneApiHint.textContent = t['settings_api_hint'];

  // Pane: Prompts
  const panePromptsTitle = document.querySelector('#spane-prompts .settings-section-title');
  if (panePromptsTitle) panePromptsTitle.textContent = t['settings_prompts_title'];
  const panePromptsHint = document.querySelector('#spane-prompts .settings-hint');
  if (panePromptsHint) panePromptsHint.textContent = t['settings_prompts_hint'];
  const promptsResetBtn = document.querySelector('#spane-prompts button[onclick*="resetAllPrompts"]');
  if (promptsResetBtn) promptsResetBtn.textContent = t['prompt_reset_all'];
  const promptsSaveBtn = document.querySelector('#spane-prompts button[onclick*="savePrompts"]');
  if (promptsSaveBtn) promptsSaveBtn.textContent = t['prompt_save_btn'];

  // Pane: Prefs
  const panePrefsTitle = document.querySelector('#spane-prefs .settings-section-title');
  if (panePrefsTitle) panePrefsTitle.textContent = t['settings_prefs_title'];
  const panePrefsHint = document.querySelector('#spane-prefs .settings-hint');
  if (panePrefsHint) panePrefsHint.textContent = t['settings_prefs_hint'];
}

function _applyI18nNotesPanel(t) {
  // Header
  const notesHeader = document.querySelector('.notes-manager-header span:first-child');
  if (notesHeader) notesHeader.textContent = t['notes_header_title'];

  // Filter buttons (statut uniquement — les couleurs n'ont pas besoin de traduction)
  const filterMap = {
    'nf-all':  'notes_filter_all',
    'nf-todo': 'notes_filter_todo',
    'nf-done': 'notes_filter_done',
  };
  Object.entries(filterMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t[key];
  });

  // Pastilles couleur (filtre) — mettre à jour le title tooltip traduit
  ['jaune','rose','vert','bleu','violet','orange','rouge','cyan'].forEach(c => {
    const btn = document.getElementById('nf-' + c);
    if (btn) btn.title = t['color_' + c] || btn.title;
  });

  // Boutons de création de notes colorées (nit) — texte visible + title
  ['jaune','rose','vert','bleu','violet','orange','rouge','cyan'].forEach(c => {
    const btn = document.getElementById('nit-' + c);
    if (!btn) return;
    btn.title = t['title_nit_' + c] || btn.title;
    const span = btn.querySelector('[data-i18n="nit_color_' + c + '"]');
    if (span) span.textContent = t['nit_color_' + c] || span.textContent;
  });
  const notesActions = document.querySelectorAll('.notes-action-btn');
  if (notesActions[0]) notesActions[0].textContent = t['notes_action_refresh'] || notesActions[0].textContent;
  // Cibler par data-action si disponible, sinon par ordre
  document.querySelectorAll('.notes-action-btn[data-action="done"]').forEach(btn => {
    btn.textContent = t['notes_action_done'] || btn.textContent;
  });
  document.querySelectorAll('.notes-action-btn[data-action="reopen"]').forEach(btn => {
    btn.textContent = t['notes_action_reopen'] || btn.textContent;
  });
  // Fallback par texte pour compatibilité avec les boutons sans data-action
  document.querySelectorAll('.notes-action-btn').forEach(btn => {
    const txt = btn.textContent.trim();
    if (txt.includes('Tout traiter') || txt.includes('Mark all') || txt.includes('Marcar todo')) {
      btn.textContent = t['notes_action_done'] || btn.textContent;
    } else if (txt.includes('Tout rouvrir') || txt.includes('Reopen') || txt.includes('Reabrir')) {
      btn.textContent = t['notes_action_reopen'] || btn.textContent;
    }
  });
}

function _applyI18nWritingTools(t) {
  // Stats tab buttons
  const btnStatsCalc = document.getElementById('wt-btn-stats');
  if (btnStatsCalc) btnStatsCalc.textContent = t['btn_stats_calc'];
  const btnStatsAi = document.getElementById('wt-btn-stats-ai');
  if (btnStatsAi) { btnStatsAi.textContent = t['btn_stats_ai']; btnStatsAi.title = t['title_stats_ai']; }

  // Synonyms tab
  const btnSyn = document.getElementById('wt-btn-syn');
  if (btnSyn) btnSyn.textContent = t['btn_syn_search'];
  const synHint = document.getElementById('wt-syn-hint');
  if (synHint) synHint.innerHTML = t['syn_hint'];
  const synInput = document.getElementById('wonef-search-input');
  if (synInput) synInput.placeholder = (t['placeholder_search'] || 'Search…');

  // Rapport tab
  const btnRapport = document.getElementById('wt-btn-rapport');
  if (btnRapport) btnRapport.textContent = t['btn_rapport'];
  // Rapport footer button
  const rapportFooter = document.querySelector('.wt-rapport-btn button');
  if (rapportFooter) rapportFooter.textContent = t['btn_rapport_footer'];

  // Empty states
  const emptyCorrect = document.querySelector('#wt-correct-results .wt-empty');
  if (emptyCorrect) emptyCorrect.innerHTML = t['wt_empty_correct'];
  const emptyStyle = document.querySelector('#wt-style-results .wt-empty');
  if (emptyStyle) emptyStyle.innerHTML = t['wt_empty_style'];
  const emptyStats = document.querySelector('#wt-stats-results .wt-empty');
  if (emptyStats) emptyStats.innerHTML = t['wt_empty_stats'];
  const emptyRapport = document.querySelector('#wt-rapport-results .wt-empty');
  if (emptyRapport) emptyRapport.innerHTML = t['wt_empty_rapport'];
}

function _applyI18nProjectModal(t) {
  const pmTitle = document.querySelector('.project-modal-title');
  if (pmTitle) pmTitle.textContent = t['project_modal_title'];
  const pmSub = document.querySelector('.project-modal-sub');
  if (pmSub) pmSub.innerHTML = t['project_modal_sub'];

  // Buttons
  const newBtn = document.querySelector('.project-option-btn:nth-child(1)');
  if (newBtn) {
    const label = newBtn.querySelector('.opt-label');
    const desc  = newBtn.querySelector('.opt-desc');
    if (label) label.textContent = t['project_new_label'];
    if (desc)  desc.textContent  = t['project_new_desc'];
  }
  const loadBtn = document.querySelector('.project-option-btn:nth-child(2)');
  if (loadBtn) {
    const label = loadBtn.querySelector('.opt-label');
    const desc  = loadBtn.querySelector('.opt-desc');
    if (label) label.textContent = t['project_load_label'];
    if (desc)  desc.textContent  = t['project_load_desc'];
  }

  // Autosave label
  const autosaveLabel = document.querySelector('.ls-restore-label');
  if (autosaveLabel) autosaveLabel.textContent = t['project_autosave_label'];

  // Name area
  const nameLabel = document.querySelector('.project-name-area label');
  if (nameLabel) nameLabel.textContent = t['project_name_label'];
  const nameInput = document.getElementById('project-name-input');
  if (nameInput) nameInput.placeholder = t['project_name_placeholder'];

  // Action buttons
  const skipBtn = document.getElementById('project-skip-btn');
  if (skipBtn) skipBtn.textContent = t['project_skip_btn'];
  const confirmBtn = document.getElementById('project-confirm-btn');
  if (confirmBtn) confirmBtn.textContent = t['project_confirm_btn'];

  // Image modal
  const imgModalH3 = document.querySelector('#img-modal h3');
  if (imgModalH3) imgModalH3.textContent = t['img_modal_title'];
  const imgModalLabels = document.querySelectorAll('#img-modal label');
  if (imgModalLabels[0]) imgModalLabels[0].textContent = t['img_modal_name_label'];
  if (imgModalLabels[1]) imgModalLabels[1].textContent = t['img_modal_caption_label'];
  const imgNameInput = document.getElementById('img-name-input');
  if (imgNameInput) imgNameInput.placeholder = t['img_modal_name_placeholder'];
  const imgCaptionInput = document.getElementById('img-caption-input');
  if (imgCaptionInput) imgCaptionInput.placeholder = t['img_modal_caption_placeholder'];
  const imgModalBtns = document.querySelectorAll('#img-modal .modal-actions button');
  if (imgModalBtns[0]) imgModalBtns[0].textContent = t['img_modal_cancel'];
  if (imgModalBtns[1]) imgModalBtns[1].textContent = t['img_modal_confirm'];
}

function _applyI18nPromptsBadges(t) {
  // Mettre à jour les badges "défaut"/"modifié" dans les prompt cards si le panneau est ouvert
  document.querySelectorAll('.prompt-card-badge').forEach(badge => {
    if (badge.classList.contains('modified')) {
      badge.textContent = t['prompt_badge_modified'];
    } else {
      badge.textContent = t['prompt_badge_default'];
    }
  });
  // Reset buttons dans les prompt cards
  document.querySelectorAll('.prompt-reset-btn').forEach(btn => {
    btn.textContent = t['prompt_reset_btn'];
  });
}

// ── Appliquer i18n au démarrage ────────────────────────────────────────────────
// On écoute un événement personnalisé 'atelier:ready' déclenché par l'init principale,
// avec repli sur DOMContentLoaded + délai augmenté pour les navigateurs lents.
// Cela évite de dépendre d'un délai fixe de 80 ms qui peut manquer des éléments
// rendus dynamiquement après la fin du parsing HTML.
(function() {
  let _i18nApplied = false;
  function _safeApplyI18n() {
    if (_i18nApplied) return;
    _i18nApplied = true;
    applyI18n();
  }
  document.addEventListener('atelier:ready', _safeApplyI18n, { once: true });
  document.addEventListener('DOMContentLoaded', () => {
    // Repli : si 'atelier:ready' n'est jamais émis, on applique quand même après 250 ms
    setTimeout(_safeApplyI18n, 250);
  });
})();
