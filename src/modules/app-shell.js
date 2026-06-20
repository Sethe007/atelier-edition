// ══════════════════════════════════════════════════════════
// ── AUTOSAVE LOCALSTORAGE ─────────────────────────────────
// ══════════════════════════════════════════════════════════
const LS_KEY   = 'atelier_autosave';
let _autosaveTimer  = null;
let _wgStartWords   = null; // mots au début de session
let _lastGoalPct    = 0;    // pour détecter le franchissement de 100%

function autosaveToLS() {
  // Sauvegarder même sans projet nommé (nom par défaut : "Sans titre")
  const nomProjet = currentProject?.nom || 'Sans titre';
  try {
    const data = collectProjectData();
    localStorage.setItem(LS_KEY + '_' + slugify(nomProjet), JSON.stringify(data));
    // badge flash
    const badge = document.getElementById('autosave-badge');
    if (badge) {
      badge.textContent = '💾 ' + new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      badge.classList.add('flash');
      setTimeout(() => badge.classList.remove('flash'), 1800);
    }
  } catch(e) { console.warn('Autosave localStorage échoué :', e); }
}

function scheduleAutosave() {
  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(autosaveToLS, 3000);
}

function slugify(s) {
  return s.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'').slice(0,40) || 'projet';
}

// ── Liste des sauvegardes LS disponibles ──────────────────
function getLsSaves() {
  try {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(LS_KEY + '_'))
      .map(k => {
        try {
          const d = JSON.parse(localStorage.getItem(k));
          return { key: k, nom: d?.meta?.nom || k, date: d?.meta?.derniereSauvegarde || null, data: d };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a,b) => (b.date || 0) > (a.date || 0) ? 1 : -1);
  } catch { return []; }
}

function deleteLsSave(key) {
  try { localStorage.removeItem(key); } catch(e) {}
}

function restoreFromLS(saveObj) {
  if (!saveObj?.data) return;
  if (!confirm(`Restaurer « ${saveObj.nom} » ? Le projet actuel sera remplacé.`)) return;
  try {
    applyProjectData(saveObj.data, saveObj.nom);
    showToast(`✓ « ${saveObj.nom} » restauré depuis la sauvegarde automatique.`, 3500, 'ok');
    // Fermer la modale si ouverte
    const overlay = document.querySelector('.project-modal-overlay');
    if (overlay) overlay.classList.remove('open');
  } catch(e) { showToast('Erreur lors de la restauration.', 3000, 'error'); }
}

function checkAutosaveOnLoad() {
  // Injecter la section de restauration dans la modale projet
  const saves = getLsSaves();
  if (!saves.length) return;

  // Toast discret
  const latest = saves[0];
  const dateStr = latest.date ? new Date(latest.date).toLocaleString('fr-FR') : '?';
  setTimeout(() => {
    showToast(`💾 ${saves.length} sauvegarde(s) auto disponible(s). Ouvrez Projets pour restaurer.`, 6000, 'ok');
  }, 1200);

  // Injecter la section dans la modale projet dès qu'elle existe
  _injectLsRestoreSection();
}

function _injectLsRestoreSection() {
  const modalBox = document.querySelector('.project-modal-box');
  if (!modalBox) { setTimeout(_injectLsRestoreSection, 500); return; }
  _renderLsRestoreSection(modalBox);
}

function _renderLsRestoreSection(modalBox) {
  // Supprimer l'ancienne section si elle existe
  const old = modalBox.querySelector('.ls-restore-section');
  if (old) old.remove();

  const saves = getLsSaves();
  if (!saves.length) return;

  const section = document.createElement('div');
  section.className = 'ls-restore-section';
  section.innerHTML = `
    <div class="ls-restore-label">💾 Sauvegardes automatiques (${saves.length})</div>
    <div class="ls-restore-list" id="ls-restore-list"></div>
  `;
  modalBox.appendChild(section);

  const list = section.querySelector('#ls-restore-list');
  saves.forEach(save => {
    const dateStr = save.date ? new Date(save.date).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '?';
    const item = document.createElement('div');
    item.className = 'ls-restore-item';
    const safeNom = escHtml(save.nom);
    item.innerHTML = `
      <span class="ls-restore-icon">📄</span>
      <div class="ls-restore-info">
        <div class="ls-restore-name">${safeNom}</div>
        <div class="ls-restore-date">${dateStr}</div>
      </div>
      <button class="ls-restore-del" title="${_t('version_delete')}">✕</button>
    `;
    item.querySelector('.ls-restore-del').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`Supprimer la sauvegarde de « ${save.nom} » ?`)) {
        deleteLsSave(save.key);
        _renderLsRestoreSection(modalBox);
      }
    });
    item.addEventListener('click', () => restoreFromLS(save));
    list.appendChild(item);
  });
}

// ── Hook autosave sur markUnsaved ─────────────────────────
// Garde : ne wrapper qu'une seule fois pour éviter récursion infinie si ce bloc
// est exécuté plusieurs fois (rechargements partiels, plusieurs imports, etc.)
if (!markUnsaved._autosaveHooked) {
  const _origMarkUnsaved = markUnsaved;
  window.markUnsaved = function() {
    _origMarkUnsaved();
    scheduleAutosave();
  };
  window.markUnsaved._autosaveHooked = true;
}

// Rafraîchir la section LS quand la modale s'ouvre
// Garde : ne wrapper qu'une seule fois; si openProjectModal n'est pas encore définie
// au moment de l'exécution, le wrapping est ignoré silencieusement (pas de TypeError).
if (typeof openProjectModal === 'function' && !openProjectModal._lsRefreshHooked) {
  const _origOpenProjectModal = openProjectModal;
  window.openProjectModal = function() {
    _origOpenProjectModal();
    setTimeout(() => {
      const modalBox = document.querySelector('.project-modal-box');
      if (modalBox) _renderLsRestoreSection(modalBox);
    }, 80);
  };
  window.openProjectModal._lsRefreshHooked = true;
}

// ══════════════════════════════════════════════════════════
// ── PERSISTANCE CLÉ API ───────────────────────────────────
// ══════════════════════════════════════════════════════════
// saveApiKeyPersistent supprimée — fusionnée dans saveApiKey (voir ci-dessus)

function loadApiKeyFromLS() {
  // ── Migration one-shot : purger les modules de ia_config si présents ──
  // Ceci corrige les localStorage corrompus des versions précédentes.
  try {
    const rawIa = localStorage.getItem('ia_config');
    if (rawIa) {
      const iaCfg = JSON.parse(rawIa);
      let needsSave = false;
      Object.keys(iaCfg.configs || {}).forEach(prov => {
        if (iaCfg.configs[prov].modules !== undefined) {
          // Migrer les modules vers ia_modules_state si ia_modules_state est vide
          const existingModules = JSON.parse(localStorage.getItem('ia_modules_state') || '{}');
          if (!existingModules[prov]) {
            existingModules[prov] = iaCfg.configs[prov].modules;
            localStorage.setItem('ia_modules_state', JSON.stringify(existingModules));
          }
          delete iaCfg.configs[prov].modules;
          needsSave = true;
        }
      });
      if (needsSave) {
        localStorage.setItem('ia_config', JSON.stringify(iaCfg));
        _iaConfigMemory = iaCfg;
      }
    }
  } catch(e) {}

  // ── Migration depuis l'ancienne structure (clés dispersées → ia_config) ──
  // Si ia_config n'existe pas encore, tenter de récupérer les anciennes clés
  try {
    const existing = localStorage.getItem('ia_config');
    if (!existing) {
      const migratedConfigs = {};
      const providerOrder = ['groq','openrouter','claude','openai','gemini'];
      providerOrder.forEach(p => {
        const oldKey = (localStorage.getItem('wt_api_key_' + p) || '').trim();
        const oldModel = localStorage.getItem('wt_model_pref_' + p) || '';
        if (oldKey || oldModel) {
          migratedConfigs[p] = { key: oldKey, model: oldModel, modules: {} };
        }
      });
      const savedProv = localStorage.getItem('wt_provider_pref') || 'claude';
      if (Object.keys(migratedConfigs).length > 0 || AI_PROVIDERS[savedProv]) {
        const migrated = { provider: savedProv, configs: migratedConfigs };
        localStorage.setItem('ia_config', JSON.stringify(migrated));
      }
    }
  } catch(e) {}

  // ── Charger la config unifiée ─────────────────────────────
  loadApiKey(); // défini dans le bloc Config IA unifié
}

// ══════════════════════════════════════════════════════════
// ── MODE SOMBRE ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════
/* ── DARK MODE : variables injectées sur :root ── */
const DARK_MODE_VARS = {
  /* Palette de base — surfaces */
  '--ink':              '#e8e8e8',
  '--ink-soft':         'rgba(232,232,232,0.75)',
  '--ink-muted':        'rgba(232,232,232,0.42)',
  '--parchment':        '#161616',
  '--paper':            '#1f1f1f',
  '--cream':            '#2a2a2a',
  '--cream-alt':        '#303030',
  '--bg-dark':          '#0d0d0d',
  '--bg-dark-alt':      '#161616',
  '--bg-dark-hover':    '#252525',
  '--border-dark':      'rgba(255,255,255,0.07)',
  '--border-dark-alt':  'rgba(255,255,255,0.12)',
  /* Accent */
  '--accent':           '#c87840',
  '--accent-light':     '#d49060',
  '--accent-hover':     '#b06030',
  '--gold':             '#c99a0f',
  '--gold-hover':       '#dbb020',
  '--gold-dark':        '#a07809',
  /* Éditeur de texte — critique */
  '--theme-editor-bg':   '#161616',
  '--theme-editor-text': '#e0ddd8',
  /* Variables thématiques header/rail/toolbar */
  '--theme-header-bg':         '#0d0d0d',
  '--theme-header-text':       '#e8e8e8',
  '--theme-header-border':     'rgba(255,255,255,0.07)',
  '--theme-rail-bg':           '#0d0d0d',
  '--theme-rail-border':       'rgba(255,255,255,0.07)',
  '--theme-rail-before-bg':    '#161616',
  '--theme-rail-before-border':'rgba(255,255,255,0.07)',
  '--theme-icon-color':        'rgba(255,255,255,0.42)',
  '--theme-icon-hover-bg':     'rgba(255,255,255,0.09)',
  '--theme-icon-hover-color':  'rgba(255,255,255,0.9)',
  '--theme-active-bg':         'rgba(201,154,15,0.12)',
  '--theme-active-color':      '#c99a0f',
  '--theme-active-bar':        '#c99a0f',
  '--theme-toolbar-bg':        '#161616',
  '--theme-toolbar-border':    'rgba(255,255,255,0.07)',
  '--theme-toolbar-btn':       'rgba(255,255,255,0.72)',
  '--theme-panel-bar-bg':      '#161616',
  '--theme-panel-bar-border':  'rgba(255,255,255,0.07)',
  '--theme-panel-bar-text':    'rgba(255,255,255,0.38)',
  /* Variables --c-* utilisées par les composants v3 */
  '--c-void':     '#0a0a0a',
  '--c-surface':  '#0d0d0d',
  '--c-raise':    '#1f1f1f',
  '--c-lift':     '#2a2a2a',
  '--c-line':     'rgba(255,255,255,0.07)',
  '--c-line-s':   'rgba(255,255,255,0.04)',
  '--c-parch':    '#1f1f1f',
  '--c-parch-d':  '#2a2a2a',
  '--c-parch-dd': '#353535',
  '--c-parch-l':  '#252525',
  '--c-ink':      '#e8e8e8',
  '--c-ink-s':    'rgba(232,232,232,0.72)',
  '--c-ink-m':    'rgba(232,232,232,0.42)',
  '--c-ink-f':    'rgba(232,232,232,0.28)',
  '--c-gold':     '#c99a0f',
  '--c-gold-s':   'rgba(201,154,15,0.15)',
  '--c-gold-glow':'0 0 18px rgba(201,154,15,0.28)',
  /* Notes/danger adaptés au fond sombre */
  '--note-bg':     'rgba(254,252,232,0.06)',
  '--note-border': 'rgba(253,230,138,0.25)',
  '--note-text':   '#fde68a',
  '--danger-bg':   'rgba(220,38,38,0.12)',
  '--danger-border':'rgba(252,165,165,0.2)',
};

function applyDarkModeVars(isDark) {
  const root = document.documentElement.style;
  if (isDark) {
    Object.entries(DARK_MODE_VARS).forEach(([k, v]) => root.setProperty(k, v, 'important'));
  } else {
    Object.keys(DARK_MODE_VARS).forEach(k => root.removeProperty(k));
    // Réappliquer le thème actif pour restaurer ses valeurs
    if (typeof getPref === 'function' && typeof applyTheme === 'function') {
      applyTheme(getPref('ui_theme') || 'ardoise', false);
    }
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  applyDarkModeVars(isDark);
  const btn = document.getElementById('btn-dark');
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) { icon.className = isDark ? 'ti ti-sun' : 'ti ti-moon'; }
    else { btn.textContent = isDark ? '☀️' : '🌙'; }
  }
  try { localStorage.setItem('atelier_dark', isDark ? '1' : '0'); } catch(e) {}
}

function loadDarkModePref() {
  try {
    const saved = localStorage.getItem('atelier_dark');
    const prefersDark = saved === null && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    if (saved === '1' || prefersDark) {
      document.body.classList.add('dark-mode');
      applyDarkModeVars(true);
      const btn = document.getElementById('btn-dark');
      if (btn) {
        const icon = btn.querySelector('i');
        if (icon) { icon.className = 'ti ti-sun'; }
        else { btn.textContent = '☀️'; }
      }
    }
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════
// ── MODE FOCUS ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════


// ── COMMENTAIRES / NOTES D'AUTEUR INLINE ────────────────────
// Syntaxe : [NOTE: mon commentaire]
// Affiché en surligné jaune dans la preview, ignoré à l'export

function insertComment() {
  const ta  = document.getElementById('raw-input');
  const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
  const tag = sel ? `[NOTE: ${sel}]` : '[NOTE: ]';
  const s   = ta.selectionStart;
  taReplace(ta, s, ta.selectionEnd, tag);
  const cursorPos = s + (sel ? tag.length : 7);
  ta.setSelectionRange(cursorPos, cursorPos);
  ta.focus();
  onRawInput();
}

// ── Insérer un surlignage coloré ──────────────────────────────────────────
function insertNoteHL(color) {
  const ta  = document.getElementById('raw-input');
  if (!ta) return;
  const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
  const lang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
  const notePlaceholder = _t('note_inline_placeholder');
  const tag = sel ? `[HL:${color} ${sel} | ${notePlaceholder}]` : `[HL:${color}  | ${notePlaceholder}]`;
  const s = ta.selectionStart;
  taReplace(ta, s, ta.selectionEnd, tag);
  // Positionner le curseur sur le texte à annoter si vide
  const cursorPos = sel ? s + tag.length : s + 4 + color.length + 1;
  ta.setSelectionRange(cursorPos, cursorPos);
  ta.focus();
  onRawInput();
  switchSidebarTab('notes');
}

// ── Insérer un tag sémantique ─────────────────────────────────────────────
function insertNoteTag(tagType) {
  const ta  = document.getElementById('raw-input');
  if (!ta) return;
  const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
  const tag = sel ? `[TAG:${tagType} ${sel}]` : `[TAG:${tagType} ]`;
  const s = ta.selectionStart;
  taReplace(ta, s, ta.selectionEnd, tag);
  const cursorPos = s + (sel ? tag.length : tag.length - 1);
  ta.setSelectionRange(cursorPos, cursorPos);
  ta.focus();
  onRawInput();
}

// ── Export notes Markdown ─────────────────────────────────────────────────
function exportNotesMarkdown() {
  if (typeof _ANNOT === 'undefined') return;
  const all  = _ANNOT.getAll();
  const lang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
  const title = _t('export_annot_title');
  const lines = [title, `> ${new Date().toLocaleDateString()}`, ''];

  if (!all.length) {
    showToast(_t('export_annot_empty'), 2000, 'error');
    return;
  }

  const prioEmoji = { high:'🔴', mid:'🟡', low:'🟢', none:'⚪' };
  all.forEach(a => {
    const prio = prioEmoji[a.priority || 'none'];
    const done = a.done ? '~~' : '';
    const colorLabel = a.color || 'jaune';
    const excerpt = a.anchor ? `"${a.anchor.slice(0, 60)}${a.anchor.length > 60 ? '…' : ''}"` : '';
    lines.push(`- ${prio} [${colorLabel}] ${done}${a.note || '(sans commentaire)'}${done}`);
    if (excerpt) lines.push(`  > ${excerpt}`);
  });
  lines.push('');

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown; charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'annotations.md'; a.click();
  URL.revokeObjectURL(url);
  showToast(_t('export_annot_done'), 2000, 'ok');
}

// ── Export notes textuelles (NOTE / HL / TAG) ──────────────────────────────
function exportNotesMd() {
  const raw = getDomVal('raw-input');
  const lang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
  const title = _t('export_notes_title');
  const lines = [];
  lines.push(title);
  const _dateLocale = lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-GB' : 'fr-FR';
  lines.push(`> ${new Date().toLocaleDateString(_dateLocale)}`);
  lines.push('');

  // Notes [NOTE:]
  const noteRegex = /\[NOTE:\s*([^\]]*)\]/g;
  let m;
  const notesByChapter = {};
  while ((m = noteRegex.exec(raw)) !== null) {
    const txt = m[1].trim();
    const before = raw.slice(0, m.index);
    const chapMatch = before.match(/^(?:CHAPITRE|Chapitre|Chapter|Partie|Part|[IVX]+[\.\-—])[^\n]*/gm);
    const chap = chapMatch ? chapMatch[chapMatch.length - 1].trim() : _t('export_notes_general');
    if (!notesByChapter[chap]) notesByChapter[chap] = [];
    const meta = _notesMeta[_noteKey(txt)] || {};
    const prio = { high: '🔴', mid: '🟡', low: '🟢', none: '⚪' }[meta.priority || 'none'];
    const done = meta.done ? '~~' : '';
    notesByChapter[chap].push(`- ${prio} ${done}${txt}${done}`);
  }

  // Surlignages [HL:]
  const hlRegex = /\[HL:(\w+)\s(.*?)(?:\s*\|\s*(.*?))?\]/g;
  while ((m = hlRegex.exec(raw)) !== null) {
    const color = m[1], text = m[2]?.trim(), note = m[3]?.trim() || '';
    const col = HL_COLORS[color];
    const before = raw.slice(0, m.index);
    const chapMatch = before.match(/^(?:CHAPITRE|Chapitre|Chapter|Partie|Part|[IVX]+[\.\-—])[^\n]*/gm);
    const chap = chapMatch ? chapMatch[chapMatch.length - 1].trim() : 'Général';
    if (!notesByChapter[chap]) notesByChapter[chap] = [];
    const icon = col?.label || '🎨';
    notesByChapter[chap].push(`- ${icon} \`[${color}]\` **${text}**${note ? ` — *${note}*` : ''}`);
  }

  // Tags [TAG:]
  const tagRegex = /\[TAG:(\w+)\s([^\]]*)\]/g;
  while ((m = tagRegex.exec(raw)) !== null) {
    const type = m[1], text = m[2]?.trim();
    const tc = TAG_COLORS[type];
    const before = raw.slice(0, m.index);
    const chapMatch = before.match(/^(?:CHAPITRE|Chapitre|Chapter|Partie|Part|[IVX]+[\.\-—])[^\n]*/gm);
    const chap = chapMatch ? chapMatch[chapMatch.length - 1].trim() : 'Général';
    if (!notesByChapter[chap]) notesByChapter[chap] = [];
    notesByChapter[chap].push(`- ${tc?.icon || '🏷'} \`[${type}]\` ${text}`);
  }

  Object.entries(notesByChapter).forEach(([chap, items]) => {
    lines.push(`## ${chap}`);
    lines.push(...items);
    lines.push('');
  });

  if (lines.length <= 3) {
    showToast(_t('export_notes_empty'), 2000, 'error');
    return;
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'notes-auteur.md'; a.click();
  URL.revokeObjectURL(url);
  showToast(_t('export_notes_done'), 2000, 'ok');
}

// ── Mode révision ─────────────────────────────────────────────────────────
function openReviewMode() {
  let overlay = document.getElementById('review-mode-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'review-mode-overlay';
    overlay.innerHTML = `<button class="rm-close-btn" onclick="closeReviewMode()" title="${_t('se_close')}">✕</button><div id="review-mode-inner"></div>`;
    document.body.appendChild(overlay);
  }
  const inner = document.getElementById('review-mode-inner');
  const lang  = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
  const t     = (typeof _i18n !== 'undefined') ? (_i18n[lang] || _i18n['fr']) : {};
  const all   = (typeof _ANNOT !== 'undefined') ? _ANNOT.getAll() : [];
  const PALETTE_BORDERS = { jaune:'#ca8a04', rose:'#be185d', vert:'#15803d', bleu:'#1d4ed8', orange:'#c2410c', violet:'#7c3aed', rouge:'#dc2626', cyan:'#0e7490' };
  const PALETTE_BG      = { jaune:'rgba(253,224,71,0.15)', rose:'rgba(249,168,212,0.15)', vert:'rgba(134,239,172,0.15)', bleu:'rgba(147,197,253,0.15)', orange:'rgba(253,186,116,0.15)', violet:'rgba(196,181,253,0.15)', rouge:'rgba(252,165,165,0.15)', cyan:'rgba(103,232,249,0.15)' };
  const prioEmoji = { high:'🔴', mid:'🟡', low:'🟢', none:'⚪' };

  const blocks = all.map(a => {
    const col  = PALETTE_BORDERS[a.color] || '#ca8a04';
    const colBg = PALETTE_BG[a.color] || '';
    const prio = prioEmoji[a.priority || 'none'];
    const done = a.done ? 'opacity:0.5;text-decoration:line-through;' : '';
    const excerpt = a.anchor ? `<div style="font-size:10.5px;color:var(--ink-muted);font-style:italic;">"${(escHtml?escHtml(a.anchor):a.anchor).slice(0,70)}"</div>` : '';
    const noteText = a.note ? (escHtml ? escHtml(a.note) : a.note) : `<em style="opacity:0.4">${lang==='en'?'(no comment)':'(sans commentaire)'}</em>`;
    return `<div class="rm-note-block" style="border-left-color:${col};background:${colBg};${done}">
      ${prio} <strong style="color:${col}">[${a.color || 'jaune'}]</strong> ${noteText}
      ${excerpt}
      <button onclick="_ANNOT.navigateTo('${a.id}');closeReviewMode();" style="font-size:9.5px;margin-top:6px;padding:1px 8px;border:1px solid var(--cream);border-radius:3px;background:transparent;cursor:pointer;font-family:'DM Sans',sans-serif;color:var(--ink-soft);">${lang==='en'?'→ Go to':lang==='es'?'→ Ir a':'→ Localiser'}</button>
    </div>`;
  }).join('');

  inner.innerHTML = `<h2>${t['review_mode_title'] || '🔍 Mode Révision'}</h2>
    <p class="rm-sub">${all.length} ${t['review_total'] || 'annotation(s) dans le texte'}</p>
    ${blocks || `<p style="color:var(--ink-muted);text-align:center;margin-top:40px;">${t['review_empty'] || 'Aucune annotation trouvée.'}</p>`}`;

  overlay.classList.add('open');
}
function closeReviewMode() {
  const o = document.getElementById('review-mode-overlay');
  if (o) o.classList.remove('open');
}

// BUG #6 CORRIGÉ : ne fermer le mode révision sur Échap que s'il est ouvert,
// pour ne pas interférer avec d'autres modales
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('review-mode-overlay');
    if (overlay && overlay.classList.contains('open')) closeReviewMode();
  }
});

// ══════════════════════════════════════════════════════════
// ── GESTIONNAIRE DE NOTES D'AUTEUR ───────────────────────
// ══════════════════════════════════════════════════════════

// Base de données locale des méta-données de notes
// Clé : texte normalisé de la note → { priority: 'high'|'mid'|'low'|'none', done: bool }
let _notesMeta = {};
let _notesFilter = 'all';

try {
  const saved = localStorage.getItem('atelier_notes_meta');
  if (saved) _notesMeta = JSON.parse(saved);
} catch(e) {}

function _saveNotesMeta() {
  try { localStorage.setItem('atelier_notes_meta', JSON.stringify(_notesMeta)); } catch(e) {}
}

function _noteKey(text) {
  return text.trim().slice(0, 120);
}

function notesRefresh() {
  const lang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
  const allAnnotations = (typeof _ANNOT !== 'undefined') ? _ANNOT.getAll() : [];

  // ── Badge ─────────────────────────────────────────────────────────────
  const pending = allAnnotations.filter(a => !a.done).length;
  const badge   = document.getElementById('notes-tab-badge');
  if (badge) {
    if (pending > 0) {
      badge.style.display = 'flex';
      badge.textContent   = pending;
      badge.className     = 'note-counter-badge';
    } else { badge.style.display = 'none'; }
  }

  // ── Progress ──────────────────────────────────────────────────────────
  const doneCount = allAnnotations.filter(a => a.done).length;
  const pct = allAnnotations.length > 0 ? Math.round(doneCount / allAnnotations.length * 100) : 0;
  const fill = document.getElementById('notes-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const ct = document.getElementById('notes-counter-text');
  const dc = document.getElementById('notes-done-count');
  const rc = document.getElementById('notes-remain-count');
  const totalLabel = _t('annot_total_label');
  const doneLabel  = _t('annot_done_label');
  const remLabel   = _t('annot_remaining_label');
  if (ct) ct.textContent = allAnnotations.length + ' ' + totalLabel;
  if (dc) dc.textContent = doneCount + ' ' + doneLabel;
  if (rc) rc.textContent = (allAnnotations.length - doneCount) + ' ' + remLabel;

  // ── Filtrer ───────────────────────────────────────────────────────────
  let filtered = [...allAnnotations];
  if (_notesFilter === 'todo')  filtered = allAnnotations.filter(a => !a.done);
  if (_notesFilter === 'done')  filtered = allAnnotations.filter(a => a.done);
  if (_notesFilter.startsWith('color:')) {
    const col = _notesFilter.slice(6);
    filtered = allAnnotations.filter(a => a.color === col);
  }

  // ── Trier ─────────────────────────────────────────────────────────────
  const prioOrder = { high: 0, mid: 1, low: 2, none: 3 };
  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (prioOrder[a.priority] || 3) - (prioOrder[b.priority] || 3);
  });

  // ── Rendre les cartes ─────────────────────────────────────────────────
  const list = document.getElementById('notes-list');
  if (!list) return;

  if (filtered.length === 0) {
    const emptyMsg = allAnnotations.length === 0
      ? _t('review_mode_no_annot')
      : _t('review_mode_no_filter');
    list.innerHTML = `<div class="note-empty-state"><span class="icon">💬</span>${emptyMsg}</div>`;
    return;
  }

  list.innerHTML = '';
  const PALETTE_BORDERS = { jaune:'#ca8a04', rose:'#be185d', vert:'#15803d', bleu:'#1d4ed8', orange:'#c2410c', violet:'#7c3aed', rouge:'#dc2626', cyan:'#0e7490' };
  const PALETTE_BG      = { jaune:'rgba(253,224,71,0.15)', rose:'rgba(249,168,212,0.15)', vert:'rgba(134,239,172,0.15)', bleu:'rgba(147,197,253,0.15)', orange:'rgba(253,186,116,0.15)', violet:'rgba(196,181,253,0.15)', rouge:'rgba(252,165,165,0.15)', cyan:'rgba(103,232,249,0.15)' };
  const editLbl   = _t('annot_edit')   || '✎ Modifier';
  const doneLbl   = _t('annot_done')   || '✓ Traiter';
  const reopenLbl = _t('annot_reopen_btn');
  const delLbl    = '🗑';
  const prioEmojis = { high:'🔴', mid:'🟡', low:'🟢', none:'⚪' };

  filtered.forEach((annot, idx) => {
    const col    = PALETTE_BORDERS[annot.color] || '#ca8a04';
    const colBg  = PALETTE_BG[annot.color] || 'transparent';
    const prio   = prioEmojis[annot.priority || 'none'];
    const done   = annot.done;
    const excerpt = annot.anchor ? (annot.anchor.length > 45 ? annot.anchor.slice(0,45)+'…' : annot.anchor) : '';
    const noteText = annot.note || '';
    const doneOpacity = done ? 'opacity:0.55;' : '';

    const card = document.createElement('div');
    card.className = 'note-card' + (done ? ' done' : '');
    card.style.cssText = `border-left:3px solid ${col};background:${colBg};${doneOpacity}`;
    card.dataset.annotId = annot.id;
    // Clic sur la vignette → localiser dans l'éditeur
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('[onclick]')) return;
      _ANNOT.navigateTo(annot.id);
    });
    card.innerHTML = `
      <div class="note-card-top">
        <span style="font-size:12px;flex-shrink:0;cursor:pointer;" title="${_t('prio_change')}" onclick="annotCyclePrio('${annot.id}',event)">${prio}</span>
        <div style="flex:1;min-width:0;">
          ${excerpt ? `<div style="font-size:10px;color:var(--ink-muted);font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">"${escHtml ? escHtml(excerpt) : excerpt}"</div>` : ''}
          <div class="note-text" style="${done?'text-decoration:line-through;':''}">${noteText ? (escHtml ? escHtml(noteText) : noteText) : `<em style="opacity:0.4">${lang==='en'?'(no comment)':lang==='es'?'(sin comentario)':'(sans commentaire)'}</em>`}</div>
        </div>
      </div>
      <div class="note-card-meta" style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap;">
        <button class="notes-action-btn" style="padding:1px 8px;font-size:10px;" onclick="_annotEdit('${annot.id}')">${editLbl}</button>
        <button class="notes-action-btn" style="padding:1px 8px;font-size:10px;" onclick="_ANNOT.toggleDone('${annot.id}')">${done ? reopenLbl : doneLbl}</button>
        <button class="notes-action-btn" style="padding:1px 8px;font-size:10px;" onclick="_ANNOT.navigateTo('${annot.id}')">↕ ${_t('annot_goto_btn')}</button>
        <button class="notes-action-btn" style="padding:1px 8px;font-size:10px;color:var(--status-high);border-color:var(--status-high);" onclick="_ANNOT.remove('${annot.id}')">${delLbl}</button>
      </div>`;
    list.appendChild(card);
  });
}

// ── Rafraîchissement des notes issues du texte brut [NOTE:], [HL:], [TAG:] ─
function _notesRefreshFromText() {
  const raw  = getDomVal('raw-input');
  const lang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';

  // ── 1. Scanner [NOTE:…] ────────────────────────────────────────────────
  const noteRegex = /\[NOTE:\s*([^\]]*)\]/g;
  const notes = [];
  let m;
  while ((m = noteRegex.exec(raw)) !== null) {
    const txt = m[1].trim();
    const pos = m.index;
    const before = raw.slice(0, pos);
    const chapMatch = before.match(/^(?:CHAPITRE|Chapitre|Chapter|PART|Partie|Acte|I+V?X*\.|[IVX]+\s*[\.\-\—])[^\n]*/gm);
    const chapTitle = chapMatch ? chapMatch[chapMatch.length - 1].trim().slice(0, 40) : null;
    notes.push({ txt, pos, chapTitle, type: 'note' });
  }

  // ── 2. Scanner [HL:couleur texte | note] ──────────────────────────────
  const hlRegex = /\[HL:(\w+)\s(.*?)(?:\s*\|\s*(.*?))?\]/g;
  const hlNotes = [];
  while ((m = hlRegex.exec(raw)) !== null) {
    const color = m[1].toLowerCase(), text = (m[2]||'').trim(), annotNote = (m[3]||'').trim();
    if (!annotNote) continue; // seuls les HL avec note sont listés
    const pos = m.index;
    const before = raw.slice(0, pos);
    const chapMatch = before.match(/^(?:CHAPITRE|Chapitre|Chapter|PART|Partie|Acte|I+V?X*\.|[IVX]+\s*[\.\-\—])[^\n]*/gm);
    const chapTitle = chapMatch ? chapMatch[chapMatch.length - 1].trim().slice(0, 40) : null;
    const col = HL_COLORS[color] || HL_COLORS['jaune'];
    hlNotes.push({ txt: annotNote, displayText: text, pos, chapTitle, type: 'hl', color, hlColor: col });
  }

  // ── 3. Scanner [TAG:type texte] ───────────────────────────────────────
  const tagRegex = /\[TAG:(\w+)\s([^\]]*)\]/g;
  const tagNotes = [];
  while ((m = tagRegex.exec(raw)) !== null) {
    const tagType = m[1].toLowerCase(), text = (m[2]||'').trim();
    const pos = m.index;
    const before = raw.slice(0, pos);
    const chapMatch = before.match(/^(?:CHAPITRE|Chapitre|Chapter|PART|Partie|Acte|I+V?X*\.|[IVX]+\s*[\.\-\—])[^\n]*/gm);
    const chapTitle = chapMatch ? chapMatch[chapMatch.length - 1].trim().slice(0, 40) : null;
    const tc = TAG_COLORS[tagType] || { bg: '', border: '#64748b', icon: '🏷' };
    tagNotes.push({ txt: text, pos, chapTitle, type: 'tag', tagType, tagColor: tc });
  }

  const allAnnotations = [...notes, ...hlNotes, ...tagNotes].sort((a, b) => a.pos - b.pos);

  // ── Mise à jour du badge ──────────────────────────────────────────────
  const pending = notes.filter(n => !(_notesMeta[_noteKey(n.txt)]?.done)).length;
  const badge = document.getElementById('notes-tab-badge');
  if (badge) {
    if (pending > 0) {
      badge.style.display = 'flex';
      badge.textContent = pending;
      badge.className = 'note-counter-badge';
    } else { badge.style.display = 'none'; }
  }

  // ── Mise à jour progress (notes uniquement) ───────────────────────────
  const doneCount = notes.filter(n => _notesMeta[_noteKey(n.txt)]?.done).length;
  const pct = notes.length > 0 ? Math.round(doneCount / notes.length * 100) : 0;
  const fill = document.getElementById('notes-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const ct = document.getElementById('notes-counter-text');
  if (ct) ct.textContent = allAnnotations.length + ' ' + _t('annot_total_label');
  const dc = document.getElementById('notes-done-count');
  if (dc) dc.textContent = doneCount + ' ' + _t('annot_done_label');
  const rc = document.getElementById('notes-remain-count');
  if (rc) rc.textContent = (notes.length - doneCount) + ' ' + _t('annot_remaining_label');

  // ── Filtrer ───────────────────────────────────────────────────────────
  let filtered = allAnnotations;
  if (_notesFilter === 'todo')  filtered = notes.filter(n => !(_notesMeta[_noteKey(n.txt)]?.done));
  if (_notesFilter === 'done')  filtered = notes.filter(n => !!(_notesMeta[_noteKey(n.txt)]?.done));
  if (_notesFilter.startsWith('color:')) {
    const col = _notesFilter.slice(6);
    filtered = allAnnotations.filter(n => n.color === col || (n.type === 'hl' && n.hlColor?.label && HL_COLORS[col]?.label === n.hlColor.label) || (n.type === 'hl' && col === n.color));
  }

  // ── Trier (notes : done en bas ; HL/TAG et couleur : position) ──────────
  const prioOrder = { high: 0, mid: 1, low: 2, none: 3, undefined: 3 };
  if (!_notesFilter.startsWith('color:')) {
    filtered.sort((a, b) => {
      if (a.type !== 'note' || b.type !== 'note') return a.pos - b.pos;
      const ma = _notesMeta[_noteKey(a.txt)] || {};
      const mb = _notesMeta[_noteKey(b.txt)] || {};
      if (!!ma.done !== !!mb.done) return ma.done ? 1 : -1;
      return (prioOrder[ma.priority] || 3) - (prioOrder[mb.priority] || 3);
    });
  }

  // ── Rendre la liste ───────────────────────────────────────────────────
  const list = document.getElementById('notes-list');
  if (!list) return;

  if (filtered.length === 0) {
    const emptyIcon = allAnnotations.length === 0 ? '💬' : '🎉';
    const emptyMsg = allAnnotations.length === 0
      ? _t('wt_empty_correct').replace('Cliquez sur Analyser', 'Aucune note dans le texte.<br>Utilisez <strong>[NOTE: texte]</strong><br>ou les boutons d\'insertion.').replace(/ *Cliquez.*/, '') || 'Aucune note dans le texte.<br>Utilisez <strong>[NOTE: texte]</strong><br>ou les boutons d\'insertion.'
      : _t('review_mode_no_filter');
    list.innerHTML = `<div class="note-empty-state"><span class="icon">${emptyIcon}</span>${emptyMsg}</div>`;
    return;
  }

  list.innerHTML = '';
  filtered.forEach((note, idx) => {
    const card = document.createElement('div');

    if (note.type === 'hl') {
      // ── Carte surlignage ─────────────────────────────────────────────
      const col = note.hlColor || HL_COLORS['jaune'];
      card.className = 'note-card';
      card.style.borderLeft = `3px solid ${col.border}`;
      card.style.background = col.bg;
      card.dataset.pos = note.pos;
      card.innerHTML = `
        <div class="note-card-top">
          <span style="font-size:13px;flex-shrink:0;">${col.label}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:10.5px;color:var(--ink-muted);font-style:italic;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">"${escHtml(note.displayText)}"</div>
            <div class="note-text">${escHtml(note.txt)}</div>
          </div>
        </div>
        ${note.chapTitle ? `<div class="note-card-meta"><span class="note-chapter-tag">📖 ${escHtml(note.chapTitle)}</span></div>` : ''}`;
      card.addEventListener('click', () => noteNavigateTo(note.pos, null));

    } else if (note.type === 'tag') {
      // ── Carte tag ────────────────────────────────────────────────────
      const tc = note.tagColor || { border: '#64748b', icon: '🏷', bg: '' };
      card.className = 'note-card';
      card.style.borderLeft = `3px solid ${tc.border}`;
      card.dataset.pos = note.pos;
      card.innerHTML = `
        <div class="note-card-top">
          <span style="font-size:13px;flex-shrink:0;">${tc.icon}</span>
          <div style="flex:1;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:${tc.border};margin-bottom:2px;">${note.tagType}</div>
            <div class="note-text">${escHtml(note.txt)}</div>
          </div>
        </div>
        ${note.chapTitle ? `<div class="note-card-meta"><span class="note-chapter-tag">📖 ${escHtml(note.chapTitle)}</span></div>` : ''}`;
      card.addEventListener('click', () => noteNavigateTo(note.pos, null));

    } else {
      // ── Carte note classique ─────────────────────────────────────────
      const key  = _noteKey(note.txt);
      const meta = _notesMeta[key] || { priority: 'none', done: false };
      const prio = meta.priority || 'none';
      const done = !!meta.done;
      const prioEmoji = { high: '🔴', mid: '🟡', low: '🟢', none: '⚪' }[prio] || '⚪';
      const doneLabel = done ? _t('annot_reopen_btn') : _t('annot_done');
      const prioLabel = _t('adlg_priority') || 'Priorité :';
      const editLabel = _t('annot_edit') || 'Éditer';

      card.className = 'note-card' + (done ? ' done' : '');
      card.dataset.pos = note.pos;
      card.dataset.key = key;

      card.innerHTML = `
        <div class="note-card-top">
          <span class="note-priority-badge" title="${_t('prio_change')}" onclick="noteCyclePriority('${key}', event)">${prioEmoji}</span>
          <span class="note-text" id="note-text-${idx}">${escHtml ? escHtml(note.txt) : note.txt}</span>
          <div style="display:flex;gap:3px;flex-shrink:0;">
            <button class="note-done-btn" title="${doneLabel}" onclick="noteToggleDone('${key}', event)">✓</button>
            <button title="${editLabel}" onclick="noteStartEdit(event,'${key}',${idx})" style="background:none;border:1px solid var(--cream);border-radius:4px;cursor:pointer;font-size:9px;padding:1px 5px;color:var(--ink-muted);font-family:'DM Sans',sans-serif;">✎</button>
          </div>
        </div>
        <div id="note-edit-${idx}" style="display:none;">
          <textarea class="note-edit-area" id="note-edit-ta-${idx}">${escHtml ? escHtml(note.txt) : note.txt}</textarea>
          <div class="note-edit-btns">
            <button class="note-edit-save" onclick="noteSaveEdit(event,'${key}',${idx})">${_t('adlg_save') || 'Enregistrer'}</button>
            <button class="note-edit-cancel" onclick="noteCancelEdit(${idx})">${_t('adlg_cancel') || 'Annuler'}</button>
          </div>
        </div>
        ${note.chapTitle ? `<div class="note-card-meta"><span class="note-chapter-tag" title="${escHtml ? escHtml(note.chapTitle) : note.chapTitle}">📖 ${escHtml ? escHtml(note.chapTitle) : note.chapTitle}</span><span style="margin-left:auto;font-size:9.5px;color:var(--ink-muted);">#${idx + 1}</span></div>` : `<div class="note-card-meta" style="justify-content:flex-end"><span style="font-size:9.5px;color:var(--ink-muted);">#${idx + 1}</span></div>`}
        <div class="note-priority-selector">
          <span style="font-size:9.5px;color:var(--ink-muted);margin-right:3px;">${prioLabel}</span>
          <button class="prio-btn p-high ${prio==='high'?'active':''}" onclick="noteSetPriority('${key}','high',event)" title="${_t('prio_high')}">🔴</button>
          <button class="prio-btn p-mid  ${prio==='mid' ?'active':''}" onclick="noteSetPriority('${key}','mid', event)" title="${_t('prio_mid')}">🟡</button>
          <button class="prio-btn p-low  ${prio==='low' ?'active':''}" onclick="noteSetPriority('${key}','low', event)" title="${_t('prio_low')}">🟢</button>
          <button class="prio-btn p-none ${prio==='none'?'active':''}" onclick="noteSetPriority('${key}','none',event)" title="${_t('prio_none')}">—</button>
        </div>`;

      card.addEventListener('click', function(e) {
        if (e.target.closest('.note-done-btn') || e.target.closest('.note-priority-selector') || e.target.closest('.note-priority-badge') || e.target.closest('[onclick*="noteStartEdit"]') || e.target.closest('.note-edit-area')) return;
        noteNavigateTo(parseInt(this.dataset.pos), this.dataset.key);
      });
    }

    list.appendChild(card);
  });
}

function noteFilter(f) {
  _notesFilter = f;
  // Désactiver tous les boutons de filtre connus
  ['all','todo','done','jaune','rose','vert','bleu','violet','orange','rouge','cyan'].forEach(id => {
    const btn = document.getElementById('nf-' + id);
    if (btn) btn.classList.toggle('active', ('color:' + id === f) || id === f);
  });
  // Forcer l'actif sur "all" si besoin
  const btnAll = document.getElementById('nf-all');
  if (btnAll) btnAll.classList.toggle('active', f === 'all');
  notesRefresh();
}

// ── Édition inline d'une note ─────────────────────────────────────────────
function noteStartEdit(e, key, idx) {
  if (e) e.stopPropagation();
  const editDiv = document.getElementById('note-edit-' + idx);
  const textSpan = document.getElementById('note-text-' + idx);
  if (!editDiv || !textSpan) return;
  editDiv.style.display = 'block';
  textSpan.style.display = 'none';
  const ta = document.getElementById('note-edit-ta-' + idx);
  if (ta) { ta.focus(); ta.select(); }
}

function noteSaveEdit(e, key, idx) {
  if (e) e.stopPropagation();
  const ta2 = document.getElementById('note-edit-ta-' + idx);
  if (!ta2) return;
  const newText = ta2.value.trim();
  if (!newText) return;

  // Trouver et remplacer dans le textarea principal
  const editor = getTA();
  if (editor) {
    const raw = editor.value;
    // Chercher la note par clé
    const regex = /\[NOTE:\s*([^\]]*)\]/g;
    let m;
    while ((m = regex.exec(raw)) !== null) {
      if (_noteKey(m[1].trim()) === key) {
        const newTag = `[NOTE: ${newText}]`;
        editor.value = raw.slice(0, m.index) + newTag + raw.slice(m.index + m[0].length);
        // BUG #2 CORRIGÉ : migrer les métadonnées vers la nouvelle clé
        const newKey = _noteKey(newText);
        if (newKey !== key && _notesMeta[key]) {
          _notesMeta[newKey] = { ..._notesMeta[key] };
          delete _notesMeta[key];
          _saveNotesMeta();
        }
        if (typeof markUnsaved === 'function') markUnsaved(); // BUG #7 CORRIGÉ
        if (typeof onRawInput === 'function') onRawInput();
        break;
      }
    }
  }
  notesRefresh();
}

function noteCancelEdit(idx) {
  const editDiv = document.getElementById('note-edit-' + idx);
  const textSpan = document.getElementById('note-text-' + idx);
  if (editDiv) editDiv.style.display = 'none';
  if (textSpan) textSpan.style.display = '';
}

function noteToggleDone(key, e) {
  if (e) e.stopPropagation();
  if (!_notesMeta[key]) _notesMeta[key] = { priority: 'none', done: false };
  _notesMeta[key].done = !_notesMeta[key].done;
  _saveNotesMeta();
  notesRefresh();
}

function noteCyclePriority(key, e) {
  if (e) e.stopPropagation();
  if (!_notesMeta[key]) _notesMeta[key] = { priority: 'none', done: false };
  const cycle = { none: 'high', high: 'mid', mid: 'low', low: 'none' };
  _notesMeta[key].priority = cycle[_notesMeta[key].priority || 'none'] || 'none';
  _saveNotesMeta();
  notesRefresh();
}

function noteSetPriority(key, prio, e) {
  if (e) e.stopPropagation();
  if (!_notesMeta[key]) _notesMeta[key] = { priority: 'none', done: false };
  _notesMeta[key].priority = prio;
  _saveNotesMeta();
  notesRefresh();
}

function noteNavigateTo(pos, key) {
  const ta = getTA();
  if (!ta) return;
  const raw = ta.value;

  // ── 1. Trouver la position exacte dans le texte brut ──────────
  // BUG #3 CORRIGÉ : on cherche d'abord par clé+rang (robuste après édition),
  // puis seulement en fallback par position approximative.
  let noteStart = -1;
  const noteRegexSearch = /\[NOTE:\s*([^\]]*)\]/g;
  let mm;
  if (key) {
    // Stratégie primaire : trouver la Nième occurrence de cette clé
    let rankTarget = 0;
    // Calculer le rang attendu en comptant les notes avant pos
    const noteRegexRank = /\[NOTE:\s*([^\]]*)\]/g;
    let mr;
    while ((mr = noteRegexRank.exec(raw)) !== null) {
      if (_noteKey(mr[1].trim()) === key) {
        if (mr.index <= pos) rankTarget++;
        else break;
      }
    }
    rankTarget = Math.max(0, rankTarget - 1);
    let rankFound = 0;
    while ((mm = noteRegexSearch.exec(raw)) !== null) {
      if (_noteKey(mm[1].trim()) === key) {
        if (rankFound === rankTarget) { noteStart = mm.index; break; }
        rankFound++;
      }
    }
  }
  // Fallback par position approx si clé non trouvée
  if (noteStart === -1) {
    const searchFrom = Math.max(0, pos - 3);
    noteStart = raw.indexOf('[NOTE:', searchFrom);
  }
  if (noteStart === -1) return;
  const noteEnd = raw.indexOf(']', noteStart);
  if (noteEnd === -1) return;

  // ── 2. Assurer la vue split/edit pour que l'éditeur soit visible
  const inputPane = document.getElementById('input-pane');
  if (inputPane && (inputPane.style.display === 'none' || inputPane.offsetParent === null)) {
    if (typeof setView === 'function') setView('split');
  }

  // ── 3. Sélectionner dans le textarea + scroller via mirror div ─
  ta.focus();
  ta.setSelectionRange(noteStart, noteEnd + 1);

  (function scrollTextarea() {
    const cs     = window.getComputedStyle(ta);
    const mirror = document.createElement('div');
    ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight',
     'letterSpacing','wordSpacing','paddingTop','paddingBottom',
     'paddingLeft','paddingRight','borderTopWidth','borderBottomWidth',
     'boxSizing','overflowWrap','whiteSpace','tabSize'].forEach(p => {
       mirror.style[p] = cs[p];
     });
    mirror.style.position   = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.width      = ta.clientWidth + 'px';
    mirror.style.height     = 'auto';
    mirror.style.overflow   = 'hidden';
    document.body.appendChild(mirror);

    const before = document.createTextNode(raw.slice(0, noteStart));
    const marker = document.createElement('span');
    marker.textContent = raw.slice(noteStart, noteEnd + 1);
    mirror.appendChild(before);
    mirror.appendChild(marker);

    const markerTop = marker.offsetTop;
    document.body.removeChild(mirror);

    ta.scrollTop = Math.max(0, markerTop - ta.clientHeight / 2);
  })();

  // ── 4. Scroller la preview sur le bon span ────────────────────
  // BUG #8 CORRIGÉ : showToast déplacé dans le callback, affiché seulement si trouvé
  setTimeout(() => {
    const noteText  = raw.slice(noteStart + 6, noteEnd).trim();
    const normalKey = _noteKey(noteText);
    const allSpans  = document.querySelectorAll('.author-note-anchor');

    // Calculer le rang ordinal de cette note parmi les occurrences du même texte
    let occurrenceRank = 0, rankCnt = 0;
    const noteRegex = /\[NOTE:\s*([^\]]*)\]/g;
    let mmr;
    while ((mmr = noteRegex.exec(raw)) !== null) {
      if (mmr.index === noteStart) { occurrenceRank = rankCnt; break; }
      if (_noteKey(mmr[1].trim()) === normalKey) rankCnt++;
    }

    // Trouver le span correspondant dans la preview
    let targetSpan = null, spanMatchCount = 0;
    for (const span of allSpans) {
      const spanKey = span.dataset.noteKey || '';
      if (spanKey === normalKey) {
        if (spanMatchCount === occurrenceRank) { targetSpan = span; break; }
        spanMatchCount++;
      }
    }
    // Fallback : premier span avec la même clé
    if (!targetSpan) {
      for (const span of allSpans) {
        if ((span.dataset.noteKey || '') === normalKey) { targetSpan = span; break; }
      }
    }

    if (targetSpan) {
      // L'ancre est invisible — on flashe le paragraphe parent visible
      const flashEl = targetSpan.closest('p, h1, h2, h3, .chapter-heading, .section-heading') || targetSpan.parentElement;

      if (flashEl) {
        flashEl.style.transition  = 'background 0.2s ease';
        flashEl.style.background  = '#fef08a';
        flashEl.style.borderRadius = '3px';
      }

      // Scroller la preview-pane sur l'ancre (position exacte dans le texte)
      const scrollTarget = flashEl || targetSpan;
      const previewPane = document.getElementById('preview-pane') ||
                          document.querySelector('.preview-pane');
      if (previewPane) {
        const elRect    = scrollTarget.getBoundingClientRect();
        const paneRect  = previewPane.getBoundingClientRect();
        const relTop    = elRect.top - paneRect.top + previewPane.scrollTop;
        const targetTop = relTop - previewPane.clientHeight / 2 + elRect.height / 2;
        previewPane.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      } else {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      setTimeout(() => {
        if (flashEl) {
          flashEl.style.transition   = '';
          flashEl.style.background   = '';
          flashEl.style.borderRadius = '';
        }
      }, 2000);

      showToast('Note localisée ↕ éditeur + prévisualisation', 1800); // BUG #8 : uniquement si span trouvé
    } else {
      showToast('Note localisée dans l\'éditeur ↕', 1800); // trouvée dans éditeur mais pas preview
    }
  }, 80);
}

// notesMarkAllDone / notesMarkAllTodo supprimées

function annotCyclePrio(id, e) {
  if (e) e.stopPropagation();
  if (typeof _ANNOT === 'undefined') return;
  // BUG #1 CORRIGÉ : getAll() retourne une copie — on passe par _ANNOT.setPriority
  // pour muter directement le _store interne via l'API publique.
  const cycle = { none: 'low', low: 'mid', mid: 'high', high: 'none' };
  const current = _ANNOT.getAll().find(a => a.id === id);
  if (!current) return;
  const nextPrio = cycle[current.priority || 'none'];
  _ANNOT.setPriority(id, nextPrio);
  notesRefresh();
}

// Déclencher un refresh des notes à chaque modification du texte
(function _hookNotesOnInput() {
  // onRawInput() est une fonction locale — window.onRawInput n'existe pas.
  // On branche directement sur l'événement 'input' du textarea.
  // Le DOMContentLoaded garantit que le textarea est disponible.
  document.addEventListener('DOMContentLoaded', () => {
    const ta = getTA();
    if (ta && !ta._notesHooked) {
      ta.addEventListener('input', _notesLightRefresh);
      ta._notesHooked = true;  // garde contre double-attachement
    }
  });
})();

function _notesLightRefresh() {
  if (typeof _ANNOT === 'undefined') return;
  const all     = _ANNOT.getAll();
  const total   = all.length;
  const pending = all.filter(a => !a.done).length;
  const badge   = document.getElementById('notes-tab-badge');
  if (badge) {
    if (pending > 0) {
      badge.style.display = 'flex';
      badge.textContent   = pending;
      badge.className     = 'note-counter-badge';
    } else { badge.style.display = 'none'; }
  }

  // Si le panneau Notes est actif, on rafraîchit aussi la liste
  const pane = document.getElementById('sb-pane-notes');
  if (pane && pane.style.display === 'flex') {
    notesRefresh();
  }
}

// Init au chargement
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_notesLightRefresh, 500);
});

// ── MODE MACHINE À ÉCRIRE ────────────────────────────────────
// Le curseur reste centré verticalement dans le textarea
let _typewriterMode = false;
let _twScrollRAF    = null;

function toggleTypewriter() {
  _typewriterMode = !_typewriterMode;
  const btn = document.getElementById('btn-typewriter');
  const ta  = document.getElementById('raw-input');
  if (btn) {
    btn.classList.toggle('active', _typewriterMode);
    btn.setAttribute('aria-pressed', _typewriterMode ? 'true' : 'false');
  }
  document.body.classList.toggle('typewriter-mode', _typewriterMode);
  if (_typewriterMode) {
    ta.addEventListener('keyup',   _twCenter);
    ta.addEventListener('click',   _twCenter);
    ta.addEventListener('keydown', _twCenter);
    showToast('Mode machine à écrire activé — le curseur reste centré', 2500);
  } else {
    ta.removeEventListener('keyup',   _twCenter);
    ta.removeEventListener('click',   _twCenter);
    ta.removeEventListener('keydown', _twCenter);
    showToast('Mode machine à écrire désactivé', 2000);
  }
}

function _twCenter() {
  if (_twScrollRAF) cancelAnimationFrame(_twScrollRAF);
  _twScrollRAF = requestAnimationFrame(() => {
    const ta = getTA();
    if (!ta) return;
    const cs         = window.getComputedStyle(ta);
    const lineH      = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    // Créer un mirror pour calculer la position Y du curseur
    const mirror = document.createElement('div');
    ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight',
     'letterSpacing','wordSpacing','paddingTop','paddingLeft',
     'paddingRight','borderTopWidth','boxSizing','overflowWrap',
     'whiteSpace','tabSize'].forEach(p => { mirror.style[p] = cs[p]; });
    mirror.style.width      = ta.clientWidth + 'px';
    mirror.style.position   = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordBreak  = 'break-word';
    document.body.appendChild(mirror);
    mirror.textContent = ta.value.slice(0, ta.selectionStart);
    const span = document.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);
    const cursorTop = span.offsetTop;
    document.body.removeChild(mirror);
    // Centrer : scrollTop = cursorTop - taHeight/2 + lineH/2
    const targetScroll = cursorTop - (ta.clientHeight / 2) + (lineH / 2);
    ta.scrollTop = Math.max(0, targetScroll);
  });
}

function toggleFocusMode() {
  const isFocus = document.body.classList.toggle('focus-mode');
  const btnFocus = document.getElementById('btn-focus');
  if (btnFocus) btnFocus.style.outline = isFocus ? '2px solid var(--gold)' : '';

  if (isFocus) {
    showToast('Mode focus activé — Échap ou F11 pour quitter', 3500);
    // Afficher le hint puis le faire disparaître
    const hint = document.querySelector('.focus-mode-hint');
    if (hint) {
      hint.style.opacity = '1';
      setTimeout(() => { hint.style.opacity = '0'; }, 4000);
    }
    // S'assurer que le textarea a le focus
    const ta = getTA();
    if (ta) setTimeout(() => ta.focus(), 50);
  }
  // Mettre à jour le compteur flottant
  _updateFocusCounter();
}

// Quitter le focus avec Échap ou F11
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) {
    e.preventDefault();
    document.body.classList.remove('focus-mode');
    const btnFocus = document.getElementById('btn-focus');
    if (btnFocus) btnFocus.style.outline = '';
  }
  if (e.key === 'F11') {
    e.preventDefault();
    toggleFocusMode();
  }
});

// ── Compteur flottant en mode focus ──────────────────────
function _updateFocusCounter() {
  const counter = document.getElementById('focus-word-counter');
  if (!counter) return;
  const target     = parseInt(getDomVal('wg-target')) || 500;
  const current    = countWords(getDomVal('raw-input'));
  const sessionWords = Math.max(0, current - (_wgStartWords || 0));
  const pct        = Math.min(100, Math.round(sessionWords / target * 100));
  const dailyTarget = parseInt(getDomVal('wg-daily-target')) || 1000;
  const dailyWords  = Math.max(0, current - getDailyStartWords());
  const dailyPct    = Math.min(100, Math.round(dailyWords / dailyTarget * 100));
  counter.textContent = `Session : ${sessionWords.toLocaleString('fr-FR')} / ${target.toLocaleString('fr-FR')} mots · ${pct}%  ·  Jour : ${dailyWords.toLocaleString('fr-FR')} (${dailyPct}%)`;
  counter.classList.toggle('goal-done', pct >= 100);

  if (pct >= 100 && _lastGoalPct < 100) showToast('🎉 Objectif de session atteint !', 3500, 'ok');
  _lastGoalPct = pct;
}

// ── OBJECTIF DE MOTS (session) ────────────────────────────
// countWords() est définie dans les helpers centralisés en haut du script.

function updateWordGoal() {
  const target  = parseInt(getDomVal('wg-target')) || 500;
  const current = countWords(getDomVal('raw-input'));

  if (_wgStartWords === null) return;

  const sessionWords = Math.max(0, current - _wgStartWords);
  const pct = Math.min(100, Math.round(sessionWords / target * 100));

  const fill  = document.getElementById('wg-fill');
  const count = document.getElementById('wg-count');
  if (fill)  { fill.style.width = pct + '%'; fill.classList.toggle('done', pct >= 100); }
  if (count) { count.textContent = sessionWords.toLocaleString('fr-FR') + ' / ' + target.toLocaleString('fr-FR'); count.style.color = pct >= 100 ? '#10b981' : ''; }

  if (pct >= 100 && _lastGoalPct < 100) showToast('🎉 Objectif de session atteint !', 3500, 'ok');
  _lastGoalPct = pct;
  _updateFocusCounter();
}

function resetWordGoal() {
  _wgStartWords = countWords(getDomVal('raw-input'));
  _lastGoalPct  = 0;
  updateWordGoal();
  showToast('Compteur de session réinitialisé.', 2000);
}

function saveWordGoalPref()  { lsPref('save', 'atelier_wg_target', 'wg-target'); }
function loadWordGoalPref()  { lsPref('load', 'atelier_wg_target', 'wg-target'); }

// ══════════════════════════════════════════════════════════
// ── OBJECTIF DE MOTS JOURNALIER ───────────────────────────
// ══════════════════════════════════════════════════════════
const LS_DAILY_KEY     = 'atelier_daily_words';
const LS_DAILY_DATE    = 'atelier_daily_date';
const LS_DAILY_TARGET  = 'atelier_daily_target';
const LS_DAILY_START   = 'atelier_daily_start';
let _dailyGoalPct = 0;
let _dailyMidnightTimer = null;

// _todayStr() est définie dans les helpers centralisés.

/**
 * Lecture pure : retourne le nombre de mots de départ enregistré pour aujourd'hui.
 * N'écrit JAMAIS dans localStorage — aucun effet de bord.
 */
function getDailyStartWords() {
  try {
    return parseInt(localStorage.getItem(LS_DAILY_START) || '0');
  } catch(e) { return 0; }
}

/**
 * Initialise le compteur journalier si nécessaire (nouveau jour).
 * Doit être appelée UNE SEULE FOIS, après que le texte est chargé.
 * Ne fait rien si le jour enregistré est déjà aujourd'hui.
 */
function initDailyStartWords() {
  try {
    const today = _todayStr();
    if (localStorage.getItem(LS_DAILY_DATE) !== today) {
      const currentWords = countWords(getDomVal('raw-input'));
      localStorage.setItem(LS_DAILY_DATE,  today);
      localStorage.setItem(LS_DAILY_START, String(currentWords));
    }
  } catch(e) {}
}

function updateDailyWordGoal() {
  const target     = parseInt(getDomVal('wg-daily-target')) || 1000;
  const current    = countWords(getDomVal('raw-input'));
  const startWords = getDailyStartWords();
  const written    = Math.max(0, current - startWords);
  const pct        = Math.min(100, Math.round(written / target * 100));

  const fill  = document.getElementById('wg-daily-fill');
  const count = document.getElementById('wg-daily-count');
  const info  = document.getElementById('wg-daily-info');

  if (fill) {
    fill.style.width = pct + '%';
    fill.classList.toggle('done', pct >= 100);
    fill.style.background = pct >= 100
      ? 'linear-gradient(90deg,#34d399,#10b981)'
      : 'linear-gradient(90deg,#d4a843,#c9956a)';
  }
  if (count) {
    count.textContent = written.toLocaleString('fr-FR') + ' / ' + target.toLocaleString('fr-FR');
    count.style.color = pct >= 100 ? '#10b981' : 'var(--gold)';
  }
  if (info) {
    const today = _todayStr().split('-').reverse().slice(0,2).join('/');
    info.textContent = `Aujourd'hui (${today}) · remis à zéro à minuit`;
  }

  if (pct >= 100 && _dailyGoalPct < 100) showToast('🌟 Objectif journalier atteint ! Bravo !', 4000, 'ok');
  _dailyGoalPct = pct;
}

function saveDailyGoalPref()  { lsPref('save', LS_DAILY_TARGET, 'wg-daily-target'); }
function loadDailyGoalPref()  { lsPref('load', LS_DAILY_TARGET, 'wg-daily-target'); }

function resetDailyGoal() {
  try {
    const currentWords = countWords(getDomVal('raw-input'));
    localStorage.setItem(LS_DAILY_DATE,  _todayStr());
    localStorage.setItem(LS_DAILY_START, String(currentWords));
    _dailyGoalPct = 0;
    updateDailyWordGoal();
    showToast('Compteur journalier réinitialisé.', 2000);
  } catch(e) {}
}

function _scheduleDailyMidnightReset() {
  clearTimeout(_dailyMidnightTimer);
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  _dailyMidnightTimer = setTimeout(() => {
    // initDailyStartWords() détecte le changement de jour et initialise le compteur
    // correctement. resetDailyGoal() était incorrect ici : il était conçu pour le
    // reset manuel et écrasait l'état même si l'utilisateur avait déjà resetté manuellement.
    initDailyStartWords();
    updateDailyWordGoal();
    _scheduleDailyMidnightReset();
    showToast('📅 Nouveau jour — compteur journalier remis à zéro.', 4000);
  }, midnight - now);
}


document.addEventListener('DOMContentLoaded', () => {
  // ── 1. Préférences visuelles ──────────────────────────
  loadDarkModePref();

  // ── 2. Clé API depuis localStorage ───────────────────
  // saveApiKey est déjà persistante (fusionnée)
  // loadIaModulesState est appelé À L'INTÉRIEUR de setAiProvider (via loadApiKey)
  // — pas besoin d'un setTimeout séparé qui créerait une course de timings.
  setTimeout(loadApiKeyFromLS, 0);
  // Sécurité : si les modules ne sont toujours pas chargés après 300ms (ex: DOM pas prêt), recharger
  setTimeout(() => {
    if (!document.getElementById('ia-toggle-style')?.dataset.moduleInit) {
      loadIaModulesState(_wtProvider || 'claude');
    }
    // Toujours resynchroniser les boutons et le point d'état API
    _updateApiDot();
    updateWtApiCompactLabel();
  }, 400);

  // ── 3. Objectif de mots ───────────────────────────────
  loadWordGoalPref();
  updateWordGoal();

  // ── 3b. Objectif journalier ───────────────────────────
  loadDailyGoalPref();
  initDailyStartWords();   // initialise si nouveau jour (après chargement du texte)
  updateDailyWordGoal();
  _scheduleDailyMidnightReset();

  // Hook input textarea
  const ta = getTA();
  if (ta) {
    ta.addEventListener('input', () => {
      updateWordGoal();
      updateDailyWordGoal();
      scheduleAutosave();
    });
  }

  // ── 4. Autosave — vérification au chargement ──────────
  checkAutosaveOnLoad();

  // ── 5. Badge autosave dans la barre de statut ─────────
  const statusbar = document.querySelector('.editor-statusbar');
  if (statusbar && !document.getElementById('autosave-badge')) {
    const badge = document.createElement('span');
    badge.id = 'autosave-badge'; badge.className = 'autosave-badge';
    badge.style.marginLeft = 'auto'; badge.textContent = 'Auto-save actif';
    statusbar.appendChild(badge);
  }

  // ── 6. Hint mode focus ────────────────────────────────
  if (!document.querySelector('.focus-mode-hint')) {
    const hint = document.createElement('div');
    hint.className = 'focus-mode-hint';
    hint.textContent = 'MODE FOCUS — Échap pour quitter';
    document.body.appendChild(hint);
  }

  // ── 7. Compteur flottant mode focus ───────────────────
  if (!document.getElementById('focus-word-counter')) {
    const counter = document.createElement('div');
    counter.id = 'focus-word-counter'; counter.className = 'focus-word-counter';
    document.body.appendChild(counter);
  }
  _updateFocusCounter();

  // ── 8. Tooltip badge projet ───────────────────────────
  const projBadge = document.getElementById('project-badge');
  if (projBadge) {
    projBadge.addEventListener('mouseenter', () => {
      if (currentProject?.nom) projBadge.title = currentProject.nom;
    });
  }

  // ── 9. setAiProvider est maintenant auto-suffisant (config unifiée) ─
  // Aucun wrapper nécessaire — voir la fonction setAiProvider() dans Config IA unifiée

  // ── 10. Persister le modèle via onModelChange() ──────────
  // onModelChange() gère la sync UI — saveProviderConfig() persiste explicitement
});

// ══════════════════════════════════════════════════════════
// ── MODAL PARAMÈTRES DU PROJET ────────────────────────────
// ══════════════════════════════════════════════════════════

function openSettingsModal(tab) {
  const overlay = document.getElementById('settings-modal');
  if (!overlay) return;

  // Focus mode: quitter d'abord le focus avant d'ouvrir les paramètres
  // (le return était APRÈS overlay.classList.add('open') → modale ouverte sans Escape)
  if (document.body.classList.contains('focus-mode')) {
    document.body.classList.remove('focus-mode');
    const btnFocus = document.getElementById('btn-focus');
    if (btnFocus) btnFocus.style.outline = '';
  }

  overlay.classList.add('open');
  document.getElementById('btn-settings')?.classList.add('active');

  // Sync all values from hidden fields → modal fields
  _syncHiddenToModal();

  // Sync model select dans modal
  _syncModelSelectToModal();

  // Switch to requested tab
  switchSettingsTab(tab || 'oeuvre');

  // Escape closes — installé systématiquement maintenant que le return anticipé est supprimé
  document._settingsEscHandler = (e) => {
    if (e.key === 'Escape') closeSettingsModal();
  };
  document.addEventListener('keydown', document._settingsEscHandler);

  // Refresh lists
  setTimeout(() => {
    refreshSmPersoList();
    refreshSmLieuList();
  }, 50);
}

function closeSettingsModal() {
  const overlay = document.getElementById('settings-modal');
  if (!overlay) return;
  // Restore transplanted DOM lists to their hidden accordion slots
  _restoreListsToAccordions();
  overlay.classList.remove('open');
  document.getElementById('btn-settings')?.classList.remove('active');
  if (document._settingsEscHandler) {
    document.removeEventListener('keydown', document._settingsEscHandler);
    document._settingsEscHandler = null;
  }
  // Refresh IA summary after closing
  _hideOnboardingSkip();
  updateMiseSummary();
}

// Close on overlay click
document.getElementById('settings-modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeSettingsModal();
});

function switchSettingsTab(name) {
  // Before switching: restore any transplanted lists if leaving persos/lieux tabs
  _restoreListsToAccordions();

  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.settings-pane').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
  const tab  = document.getElementById('stab-' + name);
  const pane = document.getElementById('spane-' + name);
  if (tab)  tab.classList.add('active');
  if (pane) { pane.style.display = 'block'; pane.classList.add('active'); }

  if (name === 'api')     _syncApiTabToModal();
  if (name === 'persos')  refreshSmPersoList();
  if (name === 'lieux')   refreshSmLieuList();
  if (name === 'prompts') buildPromptsPane();
  if (name === 'prefs')   initPrefsPane();
}

// ── Sync hidden DOM → modal fields ──────────────────────
function _syncHiddenToModal() {
  const pairs = [
    ['oeuvre-type',     'sm-oeuvre-type'],
    ['oeuvre-genre',    'sm-oeuvre-genre'],
    ['oeuvre-epoque',   'sm-oeuvre-epoque'],
    ['oeuvre-monde',    'sm-oeuvre-monde'],
    ['oeuvre-narration','sm-oeuvre-narration'],
    ['oeuvre-temps',    'sm-oeuvre-temps'],
    ['oeuvre-registre', 'sm-oeuvre-registre'],
    ['oeuvre-notes',    'sm-oeuvre-notes'],
    ['pg-titre',        'sm-pg-titre'],
    ['pg-auteur',       'sm-pg-auteur'],
    ['pg-soustitre',    'sm-pg-soustitre'],
    ['pg-genre',        'sm-pg-genre'],
    ['header-courant',  'sm-header-courant'],
    ['folio-start',     'sm-folio-start'],
  ];
  pairs.forEach(([srcId, dstId]) => {
    const src = document.getElementById(srcId);
    const dst = document.getElementById(dstId);
    if (src && dst) dst.value = src.value;
  });
}

// ── Sync modal select → hidden field ──────────────────────
function syncSettingsField(hiddenId, modalId) {
  const src = document.getElementById(modalId);
  const dst = document.getElementById(hiddenId);
  if (src && dst) { dst.value = src.value; markUnsaved(); }
}

function syncSettingsInput(hiddenId, modalId) {
  const src = document.getElementById(modalId);
  const dst = document.getElementById(hiddenId);
  if (src && dst) { dst.value = src.value; markUnsaved(); formatRoman(); }
}

function syncSettingsTextarea(hiddenId, modalId) {
  const src = document.getElementById(modalId);
  const dst = document.getElementById(hiddenId);
  if (src && dst) { dst.value = src.value; markUnsaved(); }
}

function syncSettingsNumber(hiddenId, modalId) {
  const src = document.getElementById(modalId);
  const dst = document.getElementById(hiddenId);
  if (src && dst) { dst.value = src.value; markUnsaved(); applySettings(); }
}

// ── API tab sync ──────────────────────────────────────────
function _syncApiTabToModal() {
  // setAiProvider() gère déjà toute la synchronisation UI — on l'appelle simplement
  try {
    const prov = typeof _wtProvider !== 'undefined' ? _wtProvider : 'claude';
    setAiProvider(prov);
  } catch(e) {}
  _syncModelSelectToModal();
}

function _syncModelSelectToModal() {
  // Clone options from hidden wt-model-select → sm-model-select
  const src = document.getElementById('wt-model-select');
  const dst = document.getElementById('sm-model-select');
  if (!src || !dst) return;
  dst.innerHTML = src.innerHTML;
  dst.value = src.value;
}

function updateSmProviderBtns(prov) {
  ['claude','openai','gemini','groq','openrouter'].forEach(p => {
    document.getElementById('sm-prov-' + p)?.classList.toggle('active', p === prov);
    document.getElementById('prov-' + p)?.classList.toggle('active', p === prov);
  });
  // Recharger les toggles modules propres à ce provider
  loadIaModulesState(prov);
}

// ── Modules IA : activation / désactivation — par provider ──────────────
const _IA_MODULE_MAP = {
  'ia-toggle-correct': ['wt-btn-ai-correct', 'wt-btn-ai-rewrite'],
  'ia-toggle-style':   ['wt-btn-style-ai'],
  'ia-toggle-rapport': ['wt-btn-rapport'],
  'ia-toggle-stats':   ['wt-btn-stats-ai'],
};

// Clé localStorage propre à chaque provider
function _iaStorageKey(prov) {
  return 'ia_modules_' + (prov || _wtProvider || 'global');
}

// Applique l'état des toggles sur les boutons + met à jour le label provider
// NOTE : n'enregistre PAS — l'enregistrement se fait via saveProviderConfig()
function updateIaModules() {
  const prov = _wtProvider || 'claude';

  // Mettre à jour le label dans le titre de section
  const lbl = document.getElementById('ia-modules-provider-label');
  const provNames = { claude: '✦ Claude', openai: '⬡ OpenAI', gemini: '✦ Gemini', groq: '⚡ Groq', openrouter: '⇄ OpenRouter' };
  if (lbl) lbl.textContent = '— ' + (provNames[prov] || prov);

  // Appliquer l'état de chaque toggle sur les boutons
  for (const [toggleId, btnIds] of Object.entries(_IA_MODULE_MAP)) {
    const checkbox = document.getElementById(toggleId);
    if (!checkbox) continue;
    const enabled = checkbox.checked;
    for (const btnId of btnIds) {
      const btn = document.getElementById(btnId);
      if (!btn) continue;
      if (!btn.dataset.titleOn) btn.dataset.titleOn = btn.title;
      btn.style.opacity       = enabled ? '' : '0.35';
      btn.style.pointerEvents = enabled ? '' : 'none';
      btn.title = enabled ? btn.dataset.titleOn : '⚠ Module désactivé pour ' + (provNames[prov] || prov);
    }
  }
  // Pas de sauvegarde ici — attendre le clic sur "Enregistrer"
}

// Charger l'état des modules pour un provider depuis ia_modules_state (clé séparée)
// JAMAIS depuis ia_config — les modules ne doivent PAS être mélangés aux clés API.
function loadIaModulesState(prov) {
  const activeProv = prov || _wtProvider || 'claude';
  let modulesState = {};

  try {
    const raw = localStorage.getItem('ia_modules_state');
    if (raw) {
      const allModules = JSON.parse(raw);
      modulesState = allModules[activeProv] || {};
    } else {
      // ── Migration : si des modules sont encore dans ia_config, les récupérer une fois ──
      const provCfg = _getProviderConfig(activeProv);
      if (provCfg.modules && typeof provCfg.modules === 'object') {
        modulesState = provCfg.modules;
        // Migrer vers ia_modules_state et nettoyer ia_config
        try {
          const allModules = {};
          allModules[activeProv] = modulesState;
          localStorage.setItem('ia_modules_state', JSON.stringify(allModules));
          // Nettoyer ia_config
          const globalCfg = _loadIaConfig();
          if (globalCfg.configs[activeProv]) {
            delete globalCfg.configs[activeProv].modules;
            _saveIaConfig(globalCfg);
          }
        } catch(e) {}
      }
    }
  } catch(e) {}

  for (const toggleId of Object.keys(_IA_MODULE_MAP)) {
    const cb = document.getElementById(toggleId);
    // Actif sauf si EXPLICITEMENT false — {} vide → tout actif
    if (cb) {
      cb.checked = (modulesState[toggleId] === false) ? false : true;
      cb.dataset.moduleInit = '1'; // marquer comme initialisé
    }
  }
  updateIaModules();
}

// saveApiKeyFromModal et onModelChangeFromModal → redirigent vers saveProviderConfig()
// (défini dans le bloc Config IA unifié plus haut)

function onModelChangeFromModal() {
  // Sync seulement le select panneau — sans sauvegarder (attendre "Enregistrer")
  const src = document.getElementById('sm-model-select');
  const dst = document.getElementById('wt-model-select');
  if (src && dst) {
    dst.innerHTML = src.innerHTML;
    dst.value = src.value;
    _wtModel = src.value;
  }
}

function updateWtApiCompactLabel() {
  const label = document.getElementById('wt-api-compact-label');
  const dot = document.getElementById('wt-api-dot');
  if (!label) return;
  try {
    const prov = typeof _wtProvider !== 'undefined' ? _wtProvider : '';
    const provNames = { claude: 'Claude', openai: 'OpenAI', gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
    const isOk = dot?.classList.contains('ok');
    label.textContent = prov
      ? (provNames[prov] || prov) + (isOk ? ' · clé active' : ' · pas de clé')
      : 'Configuration IA';
  } catch(e) { label.textContent = 'Configuration IA'; }
}

// ── Personnages / Lieux dans modal ────────────────────────
// Les listes #perso-list et #lieu-list vivent directement dans la modale.
// Ces fonctions scrollent simplement vers le dernier élément ajouté.
function refreshSmPersoList() {
  const list = document.getElementById('perso-list');
  if (!list) return;
  const cards = list.querySelectorAll('[id^="perso-"]');
  if (cards.length > 0) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function refreshSmLieuList() {
  const list = document.getElementById('lieu-list');
  if (!list) return;
  const cards = list.querySelectorAll('[id^="lieu-"]');
  if (cards.length > 0) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Rien à restaurer — les listes vivent dans la modale
function _restoreListsToAccordions() {
  // Les éléments #perso-list et #lieu-list sont des enfants fixes de la modale.
  // Il n'y a plus de transplant à inverser.
}

// ── Résumé projet dans l'onglet Mise en page ─────────────
function updateMiseSummary() {
  const titre  = document.getElementById('pg-titre')?.value?.trim() || '';
  const auteur = document.getElementById('pg-auteur')?.value?.trim() || '';
  const genre  = document.getElementById('oeuvre-genre')?.value || '';
  const type   = document.getElementById('oeuvre-type')?.value || '';

  const titleEl = document.getElementById('mise-proj-title');
  const metaEl  = document.getElementById('mise-proj-meta');
  if (titleEl) titleEl.textContent = titre || '— Titre non défini —';
  if (metaEl) {
    const parts = [auteur, genre, type].filter(Boolean);
    metaEl.textContent = parts.length ? parts.join(' · ') : 'Auteur · Genre · Type';
  }
}

// ── Init au chargement ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Refresh summaries after project loads (slight delay for data to populate)
  setTimeout(() => {
    
    updateMiseSummary();
    updateWtApiCompactLabel();
  }, 300);

  // Watch for changes in hidden oeuvre fields to update sidebar summary
  ['oeuvre-type','oeuvre-genre','oeuvre-epoque','oeuvre-narration','oeuvre-registre','oeuvre-notes',
   'pg-titre','pg-auteur'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {  updateMiseSummary(); });
    if (el) el.addEventListener('input',  () => {  updateMiseSummary(); });
  });

  // Watch dot changes for API label update
  const dot = document.getElementById('wt-api-dot');
  if (dot) {
    const observer = new MutationObserver(() => updateWtApiCompactLabel());
    observer.observe(dot, { attributes: true, attributeFilter: ['class'] });
  }
});
