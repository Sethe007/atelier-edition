// ── PRÉFÉRENCES & GESTION DES PROMPTS ────────────────────────────────────────
// Contient : loadPrefs, getPref, savePref, buildLangInstruction,
//            initPrefsPane, loadCustomPrompts, getPrompt, resolvePrompt,
//            savePrompts, resetPromptToDefault, resetAllPromptsToDefault,
//            buildPromptsPane, collectPrompts, applyProjectPrompts, _aiSugBtn
//
// Dépend de : core.js (PREFS_KEY, APP_STATE), i18n/index.js (LANGUE_LABELS)
// Doit être chargé après : core.js, i18n/index.js, prompts/index.js
// Doit être chargé avant  : editor-ui.js, app-shell.js, writingTools.js
// ─────────────────────────────────────────────────────────────────────────────

const PREFS_STORAGE_KEY = 'atelier_prefs';

/** Valeurs par défaut de toutes les préférences */
const DEFAULT_PREFS = {
  ia_langue: 'fr',   // langue de sortie IA
  ui_lang:   'fr',   // langue de l'interface utilisateur
  ui_theme:  'ardoise', // thème visuel : ardoise | foret | sepia | art_nouveau | jour_ivoire | jour_ardoise
};

/** Définition des thèmes visuels */
const THEMES = {
  ardoise: {
    '--theme-header-bg':         '#1e2a35',
    '--theme-header-text':       '#d0e4f5',
    '--theme-header-border':     '#2e3f50',
    '--theme-rail-bg':           '#16212d',
    '--theme-rail-border':       '#253040',
    '--theme-rail-before-bg':    '#12202d',
    '--theme-rail-before-border':'#1e3040',
    '--theme-icon-color':        'rgba(180,210,240,0.38)',
    '--theme-icon-hover-bg':     'rgba(192,120,72,0.12)',
    '--theme-icon-hover-color':  'rgba(208,228,248,0.9)',
    '--theme-active-bg':         'rgba(192,120,72,0.22)',
    '--theme-active-color':      '#d4956a',
    '--theme-active-bar':        '#d4956a',
    '--theme-toolbar-bg':        '#12202d',
    '--theme-toolbar-border':    '#1e3040',
    '--theme-toolbar-btn':       'rgba(208,228,248,0.75)',
    '--theme-panel-bar-bg':      '#12202d',
    '--theme-panel-bar-border':  '#1e3040',
    '--theme-panel-bar-text':    'rgba(180,210,240,0.38)',
    '--theme-editor-bg':         '#f7f5f0',
    '--theme-editor-text':       '#2c2c2c',
  },
  foret: {
    '--theme-header-bg':         '#1a2520',
    '--theme-header-text':       '#d8ece0',
    '--theme-header-border':     '#2e3f36',
    '--theme-rail-bg':           '#111c17',
    '--theme-rail-border':       '#253028',
    '--theme-rail-before-bg':    '#0e1a12',
    '--theme-rail-before-border':'#1c2d1e',
    '--theme-icon-color':        'rgba(160,220,160,0.35)',
    '--theme-icon-hover-bg':     'rgba(100,160,90,0.15)',
    '--theme-icon-hover-color':  'rgba(200,240,200,0.9)',
    '--theme-active-bg':         'rgba(100,156,94,0.22)',
    '--theme-active-color':      '#8ec87e',
    '--theme-active-bar':        '#8ec87e',
    '--theme-toolbar-bg':        '#0e1a12',
    '--theme-toolbar-border':    '#1c2d1e',
    '--theme-toolbar-btn':       'rgba(200,240,200,0.75)',
    '--theme-panel-bar-bg':      '#0e1a12',
    '--theme-panel-bar-border':  '#1c2d1e',
    '--theme-panel-bar-text':    'rgba(160,220,160,0.38)',
    '--theme-editor-bg':         '#f7f5f0',
    '--theme-editor-text':       '#2c2c2c',
  },
  sepia: {
    '--theme-header-bg':         '#3b2f1e',
    '--theme-header-text':       '#f0e4c8',
    '--theme-header-border':     '#5a4530',
    '--theme-rail-bg':           '#2a2015',
    '--theme-rail-border':       '#463520',
    '--theme-rail-before-bg':    '#221a10',
    '--theme-rail-before-border':'#38281a',
    '--theme-icon-color':        'rgba(220,195,145,0.42)',
    '--theme-icon-hover-bg':     'rgba(196,151,58,0.12)',
    '--theme-icon-hover-color':  'rgba(240,228,200,0.9)',
    '--theme-active-bg':         'rgba(196,151,58,0.2)',
    '--theme-active-color':      '#c4973a',
    '--theme-active-bar':        '#c4973a',
    '--theme-toolbar-bg':        '#221a10',
    '--theme-toolbar-border':    '#38281a',
    '--theme-toolbar-btn':       'rgba(240,228,200,0.75)',
    '--theme-panel-bar-bg':      '#221a10',
    '--theme-panel-bar-border':  '#38281a',
    '--theme-panel-bar-text':    'rgba(220,195,145,0.4)',
    '--theme-editor-bg':         '#f2ead8',
    '--theme-editor-text':       '#2a1f0e',
  },
  // ── Thèmes supplémentaires ───────────────────────────────────────────
  art_nouveau: {
    '--theme-header-bg':          '#2d1f3d',
    '--theme-header-text':        '#f5f0f8',
    '--theme-header-border':      '#4a3060',
    '--theme-rail-bg':            '#231730',
    '--theme-rail-border':        '#3d2855',
    '--theme-rail-before-bg':     '#1c1228',
    '--theme-rail-before-border': '#332248',
    '--theme-icon-color':         'rgba(184,160,200,0.42)',
    '--theme-icon-hover-bg':      'rgba(139,90,159,0.15)',
    '--theme-icon-hover-color':   'rgba(245,240,248,0.92)',
    '--theme-active-bg':          'rgba(201,162,39,0.2)',
    '--theme-active-color':       '#c9a227',
    '--theme-active-bar':         '#c9a227',
    '--theme-toolbar-bg':         '#1c1228',
    '--theme-toolbar-border':     '#332248',
    '--theme-toolbar-btn':        'rgba(245,240,248,0.78)',
    '--theme-panel-bar-bg':       '#1c1228',
    '--theme-panel-bar-border':   '#332248',
    '--theme-panel-bar-text':     'rgba(184,160,200,0.42)',
    '--theme-editor-bg':          '#f5f0f8',
    '--theme-editor-text':        '#2d1f3d',
  },
  jour_ivoire: {
    '--theme-header-bg':          '#f0ebe0',
    '--theme-header-text':        '#1a150e',
    '--theme-header-border':      'rgba(139,69,19,0.18)',
    '--theme-rail-bg':            '#e8e2d5',
    '--theme-rail-border':        'rgba(139,69,19,0.12)',
    '--theme-rail-before-bg':     '#f0ebe0',
    '--theme-rail-before-border': 'rgba(139,69,19,0.12)',
    '--theme-icon-color':         'rgba(80,50,20,0.45)',
    '--theme-icon-hover-bg':      'rgba(139,69,19,0.1)',
    '--theme-icon-hover-color':   'rgba(30,15,5,0.9)',
    '--theme-active-bg':          'rgba(184,134,11,0.14)',
    '--theme-active-color':       '#7a5200',
    '--theme-active-bar':         '#8b6800',
    '--theme-toolbar-bg':         '#f0ebe0',
    '--theme-toolbar-border':     'rgba(139,69,19,0.14)',
    '--theme-toolbar-btn':        'rgba(50,30,10,0.75)',
    '--theme-panel-bar-bg':       '#f0ebe0',
    '--theme-panel-bar-border':   'rgba(139,69,19,0.12)',
    '--theme-panel-bar-text':     'rgba(80,50,20,0.5)',
    '--theme-editor-bg':          '#f7f5f0',
    '--theme-editor-text':        '#0f0f0f',
  },
  jour_ardoise: {
    '--theme-header-bg':          '#e8eef5',
    '--theme-header-text':        '#0e1a28',
    '--theme-header-border':      'rgba(30,60,100,0.15)',
    '--theme-rail-bg':            '#dde5f0',
    '--theme-rail-border':        'rgba(30,60,100,0.1)',
    '--theme-rail-before-bg':     '#e8eef5',
    '--theme-rail-before-border': 'rgba(30,60,100,0.1)',
    '--theme-icon-color':         'rgba(20,50,90,0.45)',
    '--theme-icon-hover-bg':      'rgba(30,90,180,0.1)',
    '--theme-icon-hover-color':   'rgba(5,20,50,0.9)',
    '--theme-active-bg':          'rgba(192,120,72,0.15)',
    '--theme-active-color':       '#7a4020',
    '--theme-active-bar':         '#8b4820',
    '--theme-toolbar-bg':         '#e8eef5',
    '--theme-toolbar-border':     'rgba(30,60,100,0.12)',
    '--theme-toolbar-btn':        'rgba(15,40,80,0.75)',
    '--theme-panel-bar-bg':       '#e8eef5',
    '--theme-panel-bar-border':   'rgba(30,60,100,0.1)',
    '--theme-panel-bar-text':     'rgba(20,50,90,0.5)',
    '--theme-editor-bg':          '#f7f5f0',
    '--theme-editor-text':        '#0f0f0f',
  },
};

const THEME_PREVIEWS = {
  ardoise:       [['#1e2a35','#16212d','#12202d','#d4956a']],
  foret:         [['#1a2520','#111c17','#0e1a12','#8ec87e']],
  sepia:         [['#3b2f1e','#2a2015','#221a10','#c4973a']],
  art_nouveau:   [['#2d1f3d','#231730','#1c1228','#c9a227']],
  jour_ivoire:   [['#f0ebe0','#e8e2d5','#f0ebe0','#8b6800']],
  jour_ardoise:  [['#e8eef5','#dde5f0','#e8eef5','#8b4820']],
};

/** Applique un thème visuellement + le persiste si persist=true */
function applyTheme(name, persist) {
  const theme = THEMES[name];
  if (!theme) return;
  const root = document.documentElement.style;
  Object.entries(theme).forEach(([k, v]) => root.setProperty(k, v, 'important'));
  // Surcharge des variables sémantiques pour les thèmes clairs
  const isLight = name.startsWith('jour_');
  if (isLight && name === 'jour_ivoire') {
    root.setProperty('--ink',          '#1a150e');
    root.setProperty('--ink-soft',     '#3a3020');
    root.setProperty('--ink-muted',    '#8a7a6a');
    root.setProperty('--parchment',    '#f7f5f0');
    root.setProperty('--paper',        '#f0ede5');
    root.setProperty('--cream',        '#e0dbd0');
    root.setProperty('--bg-dark',      '#ece8e0');
    root.setProperty('--bg-dark-alt',  '#e4e0d8');
    root.setProperty('--c-ink',        '#1a150e');
    root.setProperty('--c-ink-s',      '#3e3828');
    root.setProperty('--c-ink-m',      '#7a6a58');
    root.setProperty('--c-ink-f',      '#b0a090');
    root.setProperty('--c-parch',      '#f6f3ec');
    root.setProperty('--c-parch-d',    '#eee9e0');
    root.setProperty('--c-void',        '#f0ebe0');
    root.setProperty('--c-lift',        '#e4ddd5');
  } else if (isLight && name === 'jour_ardoise') {
    root.setProperty('--ink',          '#0e1a28');
    root.setProperty('--ink-soft',     '#2a3a50');
    root.setProperty('--ink-muted',    '#607090');
    root.setProperty('--parchment',    '#f7f5f0');
    root.setProperty('--paper',        '#eef2f7');
    root.setProperty('--cream',        '#dde5ef');
    root.setProperty('--bg-dark',      '#e0e8f2');
    root.setProperty('--bg-dark-alt',  '#d8e0ec');
    root.setProperty('--accent',       '#8b4820');
    root.setProperty('--accent-light', '#b57250');
    root.setProperty('--c-ink',        '#0e1a28');
    root.setProperty('--c-ink-s',      '#2a3a50');
    root.setProperty('--c-ink-m',      '#607090');
    root.setProperty('--c-parch',      '#eef2f7');
    root.setProperty('--c-parch-d',    '#dde5ef');
    root.setProperty('--c-void',        '#e8eef5');
    root.setProperty('--c-lift',        '#dde5f0');
  } else if (!isLight) {
    // Restaurer les valeurs sombres par défaut si on quitte un thème clair
    root.removeProperty('--ink');
    root.removeProperty('--ink-soft');
    root.removeProperty('--ink-muted');
    root.removeProperty('--parchment');
    root.removeProperty('--paper');
    root.removeProperty('--cream');
    root.removeProperty('--bg-dark');
    root.removeProperty('--bg-dark-alt');
    root.removeProperty('--accent');
    root.removeProperty('--accent-light');
    root.removeProperty('--c-ink');
    root.removeProperty('--c-ink-s');
    root.removeProperty('--c-ink-m');
    root.removeProperty('--c-ink-f');
    root.removeProperty('--c-parch');
    root.removeProperty('--c-parch-d');
    root.removeProperty('--c-void');
    root.removeProperty('--c-lift');
  }
  // Synchroniser --c-gold et --gold avec la couleur active du thème
  // pour que les ombres dorées figées (nmPulseGold etc.) suivent le thème
  const activeColor = theme['--theme-active-color'] || '#c9a84c';
  root.setProperty('--c-gold', activeColor, 'important');
  root.setProperty('--gold', activeColor, 'important');
  root.setProperty('--gold-hover', activeColor, 'important');
  // Glow dynamique basé sur la couleur active
  // (extrait de la hex pour générer un rgba approximatif)
  root.setProperty('--c-gold-glow', `0 0 10px ${activeColor}40`, 'important');
  root.setProperty('--nm-gold-glow', `0 0 8px ${activeColor}35`, 'important');
  // Adapter --accent pour les thèmes sombres afin que les wt-run-btn secondaires suivent
  if (!isLight) {
    root.setProperty('--accent-light', activeColor, 'important');
  }

  // ── Logo-mark : fond = couleur active solide, texte contrasté ──────────
  // On détermine si la couleur active est claire ou sombre pour choisir fg
  (function setLogoMarkColors(hex) {
    try {
      const h = hex.replace('#','');
      const r = parseInt(h.slice(0,2),16)/255, g = parseInt(h.slice(2,4),16)/255, b = parseInt(h.slice(4,6),16)/255;
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      root.setProperty('--logo-mark-bg', hex, 'important');
      root.setProperty('--logo-mark-fg', lum > 0.38 ? '#1a1000' : '#ffffff', 'important');
    } catch(e) {
      root.setProperty('--logo-mark-bg', activeColor, 'important');
      root.setProperty('--logo-mark-fg', '#ffffff', 'important');
    }
  })(activeColor);

  // Classe sur body pour les règles CSS spécifiques au thème
  document.body.className = document.body.className
    .replace(/\btheme-\S+/g, '').replace(/\btheme-light\b/g, '').trim() + ' theme-' + name + (isLight ? ' theme-light' : '');
  // Aperçu couleur dans les prefs
  const preview = document.getElementById('theme-preview');
  if (preview) {
    const cols = THEME_PREVIEWS[name][0];
    preview.innerHTML = cols.map((c, i) => {
      const labels = ['Header', 'Rail', 'Toolbar', 'Accent'];
      return `<div style="flex:1;background:${c};display:flex;align-items:center;justify-content:center;"><span style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.55);letter-spacing:0.06em;text-transform:uppercase;">${labels[i]}</span></div>`;
    }).join('');
  }
  // Sync le select
  const sel = document.getElementById('pref-theme');
  if (sel && sel.value !== name) sel.value = name;
  if (persist) savePref('ui_theme', name);
}

/** Map code → libellé complet utilisé dans le prompt */

let _prefs = null; // cache des préférences chargées

function loadPrefs() {
  if (_prefs) return _prefs;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    _prefs = { ...DEFAULT_PREFS, ...saved };
  } catch(e) {
    _prefs = { ...DEFAULT_PREFS };
  }
  return _prefs;
}

/** Retourne la valeur d'une préférence */
function getPref(key) {
  return loadPrefs()[key] ?? DEFAULT_PREFS[key];
}

/** Sauvegarde une préférence et met à jour le cache */
function savePref(key, value) {
  _prefs = null; // invalider le cache avant rechargement
  const prefs = loadPrefs();
  prefs[key] = value;
  _prefs = prefs;
  try { localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs)); } catch(e) {}
  // Feedback visuel léger — utilise i18n si disponible
  const msg = (typeof _i18n !== 'undefined') ? (_i18n[getPref('ui_lang')]?.toast_pref_saved || 'Préférence enregistrée ✓') : 'Préférence enregistrée ✓';
  showToast(msg, 1600, 'ok');
}

/** Construit l'instruction de langue à injecter en tête de chaque system prompt */
function buildLangInstruction() {
  const code     = (typeof getPref === 'function') ? getPref('ia_langue') : 'fr';
  const safeCode = (code && LANGUE_LABELS[code]) ? code : 'fr';
  const label    = LANGUE_LABELS[safeCode];
  if (safeCode === 'fr') {
    return 'INSTRUCTION ABSOLUE — LANGUE : Tu dois UNIQUEMENT rédiger ta réponse en français, sans exception, quelle que soit la langue du texte analysé.';
  }
  return `ABSOLUTE INSTRUCTION — OUTPUT LANGUAGE: You MUST write your entire response exclusively in ${label}. No exception, regardless of the language of the text or instructions below.`;
}

/** Initialise les contrôles du pane Préférences */
function initPrefsPane() {
  const prefs = loadPrefs();
  const langSelect = document.getElementById('pref-ia-langue');
  if (langSelect) langSelect.value = prefs.ia_langue || 'fr';
  const uiLangSelect = document.getElementById('pref-ui-langue');
  if (uiLangSelect) uiLangSelect.value = prefs.ui_lang || 'fr';
  const themeSelect = document.getElementById('pref-theme');
  if (themeSelect) themeSelect.value = prefs.ui_theme || 'ardoise';
  applyTheme(prefs.ui_theme || 'ardoise', false);
  // ── Synchronise les contrôles de correction automatique ──
  if (typeof ACPrefs !== 'undefined') ACPrefs.refreshUI();
}
