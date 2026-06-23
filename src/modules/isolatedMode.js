(function() {
'use strict';

// ══════════════════════════════════════════════════════
// ÉTAT GLOBAL DU MODE ISOLÉ
// ══════════════════════════════════════════════════════
const IM = {
  active: false,
  chapters: [],      // [{title, body}] — liste ordonnée de tous les chapitres
  activeIdx: 0,      // index du chapitre affiché
  pendingText: null, // texte brut complet avant activation (rollback)
};
// Exposer IM globalement pour que les autres blocs <script> puissent y accéder
window.IM = IM;

// Source unique pour la sauvegarde : reconstitue l'œuvre COMPLÈTE depuis
// les chapitres (sync du chapitre courant inclus). Utilisé par collectProjectData.
window._isolatedGetFullText = function () {
  if (!IM.active) return null;
  _saveCurrentChapterFromEditor();
  return _joinChapters(IM.chapters);
};

// STATUS_COLORS par index statut (0-3)
const _IM_STATUS_COLORS = [
  'var(--status-draft)',
  'var(--status-wip)',
  'var(--status-done)',
  'var(--status-review)',
];

// ══════════════════════════════════════════════════════
// DÉCOUPAGE DU TEXTE EN CHAPITRES
// ══════════════════════════════════════════════════════
/**
 * Découpe le texte brut en chapitres H1.
 * Chaque chapitre = { title: string, body: string }
 * Le prologue (tout avant le 1er H1) est aussi un chapitre avec title='' si non vide.
 * Retourne toujours au moins un élément.
 */
function _splitChapters(rawText) {
  const lines = rawText.split('\n');
  const chapters = [];
  let curTitle = null;
  let curLines = [];

  function flush() {
    if (curLines.length === 0 && curTitle === null) return;
    chapters.push({
      title: curTitle !== null ? curTitle : '',
      body: curLines.join('\n'),
    });
    curLines = [];
  }

  for (const line of lines) {
    const lvl = (typeof detectHeadingLevel === 'function') ? detectHeadingLevel(line.trim()) : 0;
    if (lvl === 1) {
      flush();
      curTitle = line.trim();
    } else {
      curLines.push(line);
    }
  }
  flush(); // dernier chapitre

  // S'assurer qu'on a au moins un chapitre même si le texte est vide
  if (chapters.length === 0) {
    chapters.push({ title: '', body: rawText });
  }

  return chapters;
}

/**
 * Recompose le texte brut complet depuis la liste de chapitres.
 * Préserve exactement les sauts de ligne pour ne pas altérer le texte.
 */
function _joinChapters(chapters) {
  const parts = [];
  for (const ch of chapters) {
    if (ch.title) {
      parts.push(ch.title);
    }
    if (ch.body) {
      parts.push(ch.body);
    }
  }
  return parts.join('\n');
}

// ══════════════════════════════════════════════════════
// ACTIVATION / DÉSACTIVATION DU MODE ISOLÉ
// ══════════════════════════════════════════════════════
function toggleIsolatedMode() {
  if (IM.active) {
    deactivateIsolatedMode();
  } else {
    activateIsolatedMode();
  }
}
window.toggleIsolatedMode = toggleIsolatedMode;

function activateIsolatedMode() {
  const ta = document.getElementById('raw-input');
  if (!ta) return;

  const rawText = ta.value;
  const chapters = _splitChapters(rawText);

  // Vérifier qu'il y a des chapitres H1 ; sinon, avertir mais activer quand même
  const h1Count = chapters.filter(c => c.title).length;
  if (h1Count === 0 && rawText.trim()) {
    // Aucun chapitre détecté — on met le texte dans un chapitre sans titre
    // (l'utilisateur peut quand même utiliser le mode)
  }

  IM.active = true;
  IM.chapters = chapters;
  IM.pendingText = rawText;

  // Trouver le chapitre actif selon la position du curseur
  const cursorPos = ta.selectionStart;
  IM.activeIdx = _findChapterIdxAtCursor(chapters, rawText, cursorPos);

  // Sauvegarder la préférence
  if (typeof savePref === 'function') savePref('editor_mode', 'isolated');

  // Afficher le premier (ou actif) chapitre dans l'éditeur
  _loadChapterInEditor(IM.activeIdx);

  // Mettre à jour l'UI
  _updateTabsBar();
  _updateIsolatedModeBtn(true);
  document.querySelector('.editor-area')?.classList.add('editor-isolated-mode');

  if (typeof showToast === 'function') {
    const n = chapters.filter(c => c.title).length;
    showToast(`Mode chapitres isolés — ${n} chapitre${n > 1 ? 's' : ''} détecté${n > 1 ? 's' : ''}`, 2200, 'ok');
  }
  // Rafraîchir la vue carte pour afficher tous les chapitres
  setTimeout(function() { if (typeof corkboardRender === 'function') corkboardRender(); }, 80);
}
window.activateIsolatedMode = activateIsolatedMode;

function deactivateIsolatedMode() {
  if (!IM.active) return;

  // Sauvegarder le chapitre en cours avant de quitter
  _saveCurrentChapterFromEditor();

  const ta = document.getElementById('raw-input');
  if (ta) {
    const fullText = _joinChapters(IM.chapters);
    ta.value = fullText;
    // Déclencher les mises à jour
    if (typeof onRawInput === 'function') onRawInput();
    if (typeof formatRoman === 'function') {
      clearTimeout(window._imFormatTimer);
      window._imFormatTimer = setTimeout(formatRoman, 100);
    }
  }

  IM.active = false;
  IM.chapters = [];
  IM.activeIdx = 0;

  // Sauvegarder la préférence
  if (typeof savePref === 'function') savePref('editor_mode', 'continuous');

  // Mettre à jour l'UI
  const tabsBar = document.getElementById('chapter-tabs-bar');
  if (tabsBar) tabsBar.style.display = 'none';
  _updateIsolatedModeBtn(false);
  document.querySelector('.editor-area')?.classList.remove('editor-isolated-mode');

  if (typeof showToast === 'function') {
    showToast('Mode texte continu — tous les chapitres réunis', 1800);
  }
  // Rafraîchir la vue carte (repasse sur _corkChapters)
  setTimeout(function() { if (typeof corkboardRender === 'function') corkboardRender(); }, 80);
}
window.deactivateIsolatedMode = deactivateIsolatedMode;

// ══════════════════════════════════════════════════════
// NAVIGATION ENTRE CHAPITRES
// ══════════════════════════════════════════════════════
function _findChapterIdxAtCursor(chapters, rawText, cursorPos) {
  // Reconstruire les offsets de chaque chapitre dans le texte
  let pos = 0;
  let found = 0;
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const chLen = (ch.title ? ch.title.length + 1 : 0) + (ch.body ? ch.body.length + 1 : 0);
    if (pos + chLen > cursorPos) {
      found = i;
      break;
    }
    pos += chLen;
    found = i;
  }
  return found;
}

/**
 * Charge le chapitre d'index idx dans le textarea.
 * Sauvegarde d'abord le chapitre courant si mode actif.
 */
function switchToChapter(idx) {
  if (!IM.active) return;
  if (idx < 0 || idx >= IM.chapters.length) return;

  // Sauvegarder le chapitre courant avant de changer
  _saveCurrentChapterFromEditor();

  IM.activeIdx = idx;
  _loadChapterInEditor(idx);
  _updateTabsBar();

  // Synchroniser le breadcrumb
  const ch = IM.chapters[idx];
  if (typeof _updateBreadcrumb === 'function') setTimeout(_updateBreadcrumb, 50);
  const bcChapter = document.getElementById('bc-chapter');
  if (bcChapter) {
    bcChapter.textContent = ch.title || '—';
  }
}
window.switchToChapter = switchToChapter;

/**
 * Écrit le contenu du chapitre idx dans le textarea.
 * Le textarea affiche : [titre\n]body
 */
function _loadChapterInEditor(idx) {
  const ta = document.getElementById('raw-input');
  if (!ta || !IM.chapters[idx]) return;
  const ch = IM.chapters[idx];
  const content = ch.title ? ch.title + '\n' + ch.body : ch.body;
  ta.value = content;
  ta.setSelectionRange(0, 0);
  ta.scrollTop = 0;

  // Mettre à jour l'aperçu sans toucher au texte brut global
  if (typeof formatRoman === 'function') {
    clearTimeout(window._imFormatTimer);
    window._imFormatTimer = setTimeout(formatRoman, 80);
  }
  if (typeof updateStats === 'function') updateStats();
  if (typeof _ANNOT !== 'undefined' && _ANNOT.render) { clearTimeout(window._annotRenderTimer); window._annotRenderTimer = setTimeout(() => _ANNOT.render(), 100); }
}

/**
 * Sauvegarde le contenu du textarea dans IM.chapters[IM.activeIdx].
 */
function _saveCurrentChapterFromEditor() {
  const ta = document.getElementById('raw-input');
  if (!ta || !IM.active) return;
  const content = ta.value;
  const ch = IM.chapters[IM.activeIdx];
  if (!ch) return;

  if (ch.title) {
    // Le contenu commence (ou non) par le titre — on sépare
    const firstLine = content.split('\n')[0].trim();
    // Si l'utilisateur a modifié le titre (première ligne = H1)
    const rest = content.indexOf('\n') >= 0 ? content.slice(content.indexOf('\n') + 1) : '';
    const firstIsH1 = (typeof detectHeadingLevel === 'function') && detectHeadingLevel(firstLine) === 1;
    if (firstIsH1) {
      ch.title = firstLine;
      ch.body = rest;
    } else {
      // L'utilisateur a supprimé le titre — on garde quand même tout comme body
      ch.body = content;
    }
  } else {
    ch.body = content;
  }
}

// ══════════════════════════════════════════════════════
// GESTION DES CHAPITRES (ajout, etc.)
// ══════════════════════════════════════════════════════
function isolatedAddChapter() {
  if (!IM.active) return;

  // Sauvegarder le chapitre courant
  _saveCurrentChapterFromEditor();

  // Créer un nouveau chapitre avec titre par défaut
  const newIdx = IM.activeIdx + 1;
  const chNum = IM.chapters.filter(c => c.title).length + 1;
  const newTitle = 'Chapitre ' + chNum;
  IM.chapters.splice(newIdx, 0, { title: newTitle, body: '' });

  // Aller sur le nouveau chapitre
  IM.activeIdx = newIdx;
  _loadChapterInEditor(newIdx);
  _updateTabsBar();

  // Mettre le curseur après le titre pour édition immédiate
  const ta = document.getElementById('raw-input');
  if (ta) {
    const pos = newTitle.length + 1;
    ta.setSelectionRange(pos, pos);
    ta.focus();
  }

  if (typeof showToast === 'function') showToast('Nouveau chapitre créé', 1500, 'ok');
}
window.isolatedAddChapter = isolatedAddChapter;
// Exposer les fonctions internes nécessaires aux autres blocs <script>
window._saveCurrentChapterFromEditor = _saveCurrentChapterFromEditor;
window._loadChapterInEditor = _loadChapterInEditor;
window._joinChapters = _joinChapters;
window._updateTabsBar = _updateTabsBar;

// ══════════════════════════════════════════════════════
// RENDU DE LA BARRE D'ONGLETS
// ══════════════════════════════════════════════════════
function _updateTabsBar() {
  const tabsBar = document.getElementById('chapter-tabs-bar');
  const tabsList = document.getElementById('chapter-tabs-list');
  if (!tabsBar || !tabsList) return;

  if (!IM.active) {
    tabsBar.style.display = 'none';
    return;
  }

  tabsBar.style.display = 'flex';

  const chapters = IM.chapters;
  tabsList.innerHTML = chapters.map((ch, i) => {
    const isActive = i === IM.activeIdx;
    const label = ch.title || '(sans titre)';
    const shortLabel = label.length > 22 ? label.slice(0, 22) + '…' : label;
    const meta = (typeof chGetMeta === 'function' && ch.title) ? chGetMeta(ch.title) : { status: 0 };
    const statusColor = _IM_STATUS_COLORS[meta.status || 0];
    return `<button class="ch-tab${isActive ? ' active' : ''}" data-tab-idx="${i}"
      title="${_escHtml(label)}"
      onclick="switchToChapter(${i})">
      <span class="ch-tab-status-dot" style="background:${statusColor}"></span>
      <span class="ch-tab-label">${_escHtml(shortLabel)}</span>
    </button>`;
  }).join('');

  // Auto-scroller vers l'onglet actif
  setTimeout(() => {
    const activeTab = tabsList.querySelector('.ch-tab.active');
    if (activeTab) activeTab.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, 20);
}

function _escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════
// MISE À JOUR DU BOUTON DANS LA TOOLBAR
// ══════════════════════════════════════════════════════
function _updateIsolatedModeBtn(active) {
  const btn = document.getElementById('btn-isolated-mode');
  if (!btn) return;
  if (active) {
    btn.classList.add('active');
    btn.title = _t('iso_disable_t');
  } else {
    btn.classList.remove('active');
    btn.title = _t('iso_enable_t');
  }
}

// ══════════════════════════════════════════════════════
// HOOK : scrollToChapter — en mode isolé, navigue vers le bon onglet
// ══════════════════════════════════════════════════════
(function() {
  const _origScroll = window.scrollToChapter;
  window.scrollToChapter = function(id, chapterText) {
    if (IM.active && chapterText) {
      // Trouver l'onglet correspondant au titre
      const idx = IM.chapters.findIndex(c => c.title === chapterText);
      if (idx >= 0) {
        switchToChapter(idx);
        return;
      }
    }
    if (typeof _origScroll === 'function') _origScroll(id, chapterText);
  };
})();

// ══════════════════════════════════════════════════════
// HOOK : onRawInput — en mode isolé, sauvegarder le chapitre courant
// sans déclencher un re-split complet du texte global
// ══════════════════════════════════════════════════════
(function() {
  const _origOnRawInput = window.onRawInput;
  window.onRawInput = function() {
    if (IM.active) {
      // Sauvegarder silencieusement le chapitre courant
      _saveCurrentChapterFromEditor();
    }
    if (typeof _origOnRawInput === 'function') _origOnRawInput.apply(this, arguments);
  };
})();

// ══════════════════════════════════════════════════════
// HOOK : updateChapterList — en mode isolé, ne pas re-splitter
// ══════════════════════════════════════════════════════
(function() {
  const _origUCL = window.updateChapterList;
  window.updateChapterList = function(chapters) {
    if (IM.active) {
      // En mode isolé : ne pas propager — cela écraserait _corkChapters
      // avec le seul chapitre affiché dans le textarea.
      // On rafraîchit juste la vue carte depuis IM.chapters.
      const cork = document.getElementById('sb-pane-corkboard');
      if (cork && cork.style.display !== 'none') {
        if (typeof corkboardRender === 'function') corkboardRender();
      }
      return;
    }
    if (typeof _origUCL === 'function') _origUCL(chapters);
  };
})();

// ══════════════════════════════════════════════════════
// HOOK : clic sur carte → switchToChapter (mode isolé)
// ══════════════════════════════════════════════════════
document.addEventListener('click', function(e) {
  if (typeof IM === 'undefined' || !IM.active) return;
  const card = e.target.closest('.cork-card');
  if (!card) return;
  const titleEncoded = card.dataset.chTitle;
  if (!titleEncoded) return;
  const title = decodeURIComponent(titleEncoded);
  const idx = IM.chapters.findIndex(c => c.title === title);
  if (idx >= 0) {
    e.stopPropagation();
    switchToChapter(idx);
    // Rafraîchir la vue carte pour surligner le chapitre actif
    setTimeout(corkboardRender, 60);
    // Ne pas forcer setView — l'utilisateur reste dans son mode (split/edit/preview)
  }
});

// ══════════════════════════════════════════════════════
// RECHERCHE — adaptation à la portée (tout / chapitre actif)
// ══════════════════════════════════════════════════════
// En mode isolé, le textarea ne contient que le chapitre actif.
// Si scope = 'all', on doit chercher dans le texte global reconstitué.
// On intercepte esSearch() pour gérer ce cas.
(function() {
  // Stocker la recherche globale quand scope=all
  window._imGlobalSearchResults = [];
  window._imGlobalSearchIdx = -1;

  const _origEsSearch = window.esSearch;
  window.esSearch = function() {
    if (IM.active) {
      const scopeSel = document.getElementById('es-scope');
      const scope = scopeSel ? scopeSel.value : 'all';
      if (scope === 'chapter') {
        // Recherche normale dans le chapitre actif (textarea)
        if (typeof _origEsSearch === 'function') _origEsSearch();
        return;
      }
      // scope === 'all' : recherche globale sur le texte reconstitué
      _globalSearch();
      return;
    }
    if (typeof _origEsSearch === 'function') _origEsSearch();
  };
})();

function _globalSearch() {
  const query = document.getElementById('es-input')?.value || '';
  const count = document.getElementById('es-count');
  const prevBtn = document.getElementById('es-prev');
  const nextBtn = document.getElementById('es-next');

  if (!query) {
    if (count) count.textContent = '';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    window._imGlobalSearchResults = [];
    window._imGlobalSearchIdx = -1;
    return;
  }

  // Construire le texte global et chercher toutes les occurrences
  const fullText = _joinChapters(IM.chapters);
  const results = [];
  const lower = fullText.toLowerCase();
  const q = query.toLowerCase();
  let i = 0;
  while (i < lower.length) {
    const pos = lower.indexOf(q, i);
    if (pos < 0) break;
    // Trouver quel chapitre contient cette position
    const chIdx = _chapterIdxAtOffset(pos);
    results.push({ pos, chIdx });
    i = pos + q.length;
  }

  window._imGlobalSearchResults = results;
  if (count) count.textContent = results.length ? '1/' + results.length : '0';
  if (prevBtn) prevBtn.disabled = results.length === 0;
  if (nextBtn) nextBtn.disabled = results.length === 0;

  if (results.length > 0) {
    window._imGlobalSearchIdx = 0;
    _navigateGlobalResult(0);
  } else {
    window._imGlobalSearchIdx = -1;
  }
}

function _chapterIdxAtOffset(offset) {
  let pos = 0;
  for (let i = 0; i < IM.chapters.length; i++) {
    const ch = IM.chapters[i];
    const len = (ch.title ? ch.title.length + 1 : 0) + ch.body.length + 1;
    if (pos + len > offset) return i;
    pos += len;
  }
  return IM.chapters.length - 1;
}

function _navigateGlobalResult(idx) {
  const results = window._imGlobalSearchResults;
  if (!results.length || idx < 0 || idx >= results.length) return;
  const r = results[idx];
  // Aller au bon chapitre si nécessaire
  if (r.chIdx !== IM.activeIdx) {
    switchToChapter(r.chIdx);
    setTimeout(() => _highlightInChapter(r, idx), 80);
  } else {
    _highlightInChapter(r, idx);
  }
  const count = document.getElementById('es-count');
  if (count) count.textContent = (idx + 1) + '/' + results.length;
}

function _highlightInChapter(r, globalIdx) {
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  const ch = IM.chapters[r.chIdx];
  // Calculer l'offset relatif dans le contenu du chapitre
  const chStart = _chapterStartOffset(r.chIdx);
  const relPos = r.pos - chStart;
  const query = document.getElementById('es-input')?.value || '';
  ta.focus();
  ta.setSelectionRange(relPos, relPos + query.length);
  // Scroller
  const lineH = parseInt(getComputedStyle(ta).lineHeight) || 20;
  const lines = ta.value.slice(0, relPos).split('\n');
  ta.scrollTop = Math.max(0, (lines.length - 3) * lineH);
}

function _chapterStartOffset(idx) {
  let pos = 0;
  for (let i = 0; i < idx && i < IM.chapters.length; i++) {
    const ch = IM.chapters[i];
    pos += (ch.title ? ch.title.length + 1 : 0) + ch.body.length + 1;
  }
  return pos;
}

// Intercepter esNav pour la navigation globale
(function() {
  const _origEsNav = window.esNav;
  window.esNav = function(dir) {
    if (IM.active) {
      const scopeSel = document.getElementById('es-scope');
      if (!scopeSel || scopeSel.value === 'chapter') {
        if (typeof _origEsNav === 'function') _origEsNav(dir);
        return;
      }
      // Navigation globale
      const results = window._imGlobalSearchResults;
      if (!results.length) return;
      window._imGlobalSearchIdx = Math.max(0, Math.min(results.length - 1, window._imGlobalSearchIdx + dir));
      _navigateGlobalResult(window._imGlobalSearchIdx);
      return;
    }
    if (typeof _origEsNav === 'function') _origEsNav(dir);
  };
})();

// ══════════════════════════════════════════════════════
// HOOK : sauvegarde projet — réassembler le texte complet avant export
// ══════════════════════════════════════════════════════
(function() {
  const _origSaveProject = window.saveProject;
  if (typeof _origSaveProject === 'function') {
    window.saveProject = function() {
      // Reconstitution de l'œuvre complète gérée par collectProjectData()
      // (via window._isolatedGetFullText) — plus d'échange du textarea ici,
      // qui entrait en conflit avec le nouveau correctif racine.
      _origSaveProject.apply(this, arguments);
    };
  }

  const _origAutoSave = window._autoSaveLs;
  if (typeof _origAutoSave === 'function') {
    window._autoSaveLs = function() {
      if (IM.active) _saveCurrentChapterFromEditor();
      _origAutoSave.apply(this, arguments);
    };
  }
})();

// ══════════════════════════════════════════════════════
// RACCOURCI CLAVIER Ctrl+Maj+I
// ══════════════════════════════════════════════════════
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'I') {
    e.preventDefault();
    toggleIsolatedMode();
  }
});

// ══════════════════════════════════════════════════════
// INITIALISATION — restaurer le mode depuis les préférences
// ══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  // Légèrement différé pour laisser le projet se charger
  setTimeout(function() {
    const mode = (typeof getPref === 'function') ? getPref('editor_mode') : null;
    if (mode === 'isolated') {
      const ta = document.getElementById('raw-input');
      // N'activer que si du texte est présent
      if (ta && ta.value.trim()) {
        activateIsolatedMode();
      }
    }
  }, 800);
});

// ══════════════════════════════════════════════════════
// HOOK : chargement de projet — désactiver le mode isolé
// puis le réactiver si préférence active
// ══════════════════════════════════════════════════════
(function() {
  const _origLoad = window.loadProjectData;
  if (typeof _origLoad === 'function') {
    window.loadProjectData = function(data, fileName) {
      // Désactiver le mode isolé avant de charger
      if (IM.active) {
        IM.active = false;
        IM.chapters = [];
        const tabsBar = document.getElementById('chapter-tabs-bar');
        if (tabsBar) tabsBar.style.display = 'none';
        _updateIsolatedModeBtn(false);
        document.querySelector('.editor-area')?.classList.remove('editor-isolated-mode');
      }
      _origLoad.apply(this, arguments);
      // Réactiver si préférence stockée dans le projet ou dans les prefs
      setTimeout(function() {
        const mode = (typeof getPref === 'function') ? getPref('editor_mode') : null;
        const ta = document.getElementById('raw-input');
        if (mode === 'isolated' && ta && ta.value.trim()) {
          activateIsolatedMode();
        }
      }, 500);
    };
  }
})();

})(); // fin IIFE
