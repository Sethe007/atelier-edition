// ═══════════════════════════════════════════════════════
// NOUVELLES FONCTIONNALITÉS — ATELIER v51
// ═══════════════════════════════════════════════════════

// ── 1. EXPORT MARKDOWN ─────────────────────────────────
function exportMarkdown() {
  const text = document.getElementById('raw-input')?.value || '';
  if (!text.trim()) { showToast(_nt('toast_md_no_text', 'Aucun texte à exporter.'), 2200); return; }

  // Convertir les marqueurs de mise en forme en Markdown propre
  let md = text;

  // Nettoyer les balises typographiques maison en Markdown standard
  // Les marqueurs **gras**, *italique*, ~~barré~~ sont déjà compatibles
  // Ajouter les métadonnées YAML front matter si disponibles
  const titre   = document.getElementById('pg-titre')?.value?.trim();
  const auteur  = document.getElementById('pg-auteur')?.value?.trim();
  const genre   = document.getElementById('pg-genre')?.value?.trim();

  let frontMatter = '';
  if (titre || auteur) {
    frontMatter = '---\n';
    if (titre)  frontMatter += `title: "${titre.replace(/"/g, '\\"')}"\n`;
    if (auteur) frontMatter += `author: "${auteur.replace(/"/g, '\\"')}"\n`;
    if (genre)  frontMatter += `genre: "${genre.replace(/"/g, '\\"')}"\n`;
    frontMatter += `date: "${new Date().toISOString().slice(0,10)}"\n`;
    frontMatter += '---\n\n';
  }

  // Supprimer les balises [NOTE: …] de l'export
  md = md.replace(/\[NOTE:\s*[^\]]*\]/g, '');

  // BUG #10 FIX : convertir les balises [HL:couleur texte] et [TAG:type texte]
  // en texte nu (on garde le texte, on retire la balise)
  md = md.replace(/\[HL:\w+\s([^\|]*?)(?:\|[^\]]*)?\]/gi, '$1');
  md = md.replace(/\[TAG:\w+\s([^\]]*)\]/gi, '$1');

  // Convertir *** ou --- (séparateurs de scène) en séparateurs Markdown
  md = md.replace(/^(\*{3}|---)\s*$/gm, '\n---\n');

  const finalMd = frontMatter + md;

  const blob = new Blob([finalMd], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const slug = (titre || currentProject?.nom || 'roman').toLowerCase()
    .replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'').slice(0, 40) || 'roman';
  a.href = url;
  a.download = slug + '.md';
  a.click();
  URL.revokeObjectURL(url);
  showToast(_nt('toast_md_done', 'Export Markdown téléchargé ✓'), 2200, 'ok');
}

// ── 2. MODALE AIDE / RACCOURCIS ────────────────────────
function openHelpModal() {
  document.getElementById('help-modal').classList.add('open');
  document.addEventListener('keydown', _helpKeyClose);
}
function closeHelpModal() {
  document.getElementById('help-modal').classList.remove('open');
  document.removeEventListener('keydown', _helpKeyClose);
}
function _helpKeyClose(e) {
  if (e.key === 'Escape') closeHelpModal();
}

// ── 3. RECHERCHE GLOBALE PROJET ────────────────────────
let _gsDebounce = null;
let _gsSelectedIdx = -1;

function openGlobalSearch() {
  document.getElementById('global-search-modal').classList.add('open');
  const inp = document.getElementById('gs-input');
  if (inp) { inp.value = ''; inp.focus(); }
  document.getElementById('gs-results').innerHTML = '<div class="global-search-empty">' + _nt('gs_empty_hint', 'Tapez pour rechercher dans l\'ensemble du texte.') + '</div>';
  document.getElementById('gs-count').textContent = '';
  _gsSelectedIdx = -1;
  document.addEventListener('keydown', _gsKeyClose);
}
function closeGlobalSearch() {
  document.getElementById('global-search-modal').classList.remove('open');
  document.removeEventListener('keydown', _gsKeyClose);
}
function _gsKeyClose(e) {
  if (e.key === 'Escape') closeGlobalSearch();
}
function clearGlobalSearch() {
  const inp = document.getElementById('gs-input');
  if (inp) { inp.value = ''; inp.focus(); }
  document.getElementById('gs-results').innerHTML = '<div class="global-search-empty">' + _nt('gs_empty_hint', 'Tapez pour rechercher dans l\'ensemble du texte.') + '</div>';
  document.getElementById('gs-count').textContent = '';
  _gsSelectedIdx = -1;
}

function runGlobalSearch() {
  clearTimeout(_gsDebounce);
  _gsDebounce = setTimeout(_doGlobalSearch, 180);
}

function _doGlobalSearch() {
  const query = (document.getElementById('gs-input')?.value || '').trim();
  const container = document.getElementById('gs-results');
  const countEl   = document.getElementById('gs-count');
  if (!container) return;

  if (query.length < 2) {
    container.innerHTML = '<div class="global-search-empty">' + _nt('gs_min_chars', 'Tapez au moins 2 caractères.') + '</div>';
    if (countEl) countEl.textContent = '';
    return;
  }

  const text = document.getElementById('raw-input')?.value || '';
  if (!text) {
    container.innerHTML = '<div class="global-search-empty">' + _nt('gs_empty_hint', 'Tapez pour rechercher dans l\'ensemble du texte.') + '</div>';
    return;
  }

  // Recherche insensible à la casse avec accent
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
  const results = [];
  let m;
  while ((m = regex.exec(text)) !== null && results.length < 80) {
    const start = Math.max(0, m.index - 60);
    const end   = Math.min(text.length, m.index + query.length + 60);
    const before = text.slice(start, m.index);
    const match  = text.slice(m.index, m.index + m[0].length);
    const after  = text.slice(m.index + m[0].length, end);

    // Trouver le chapitre parent
    const beforeFull = text.slice(0, m.index);
    const chapMatch = beforeFull.match(/^(?:CHAPITRE|Chapitre|Chapter|PART|Partie|Acte|[IVX]+[\s\.\-\—])[^\n]*/gm);
    const chapter = chapMatch ? chapMatch[chapMatch.length - 1].trim().slice(0, 50) : null;

    results.push({ pos: m.index, before, match, after, chapter });
  }

  if (!results.length) {
    container.innerHTML = '<div class="global-search-empty">' + _nt('gs_no_results', 'Aucun résultat pour « {q} ».').replace('{q}', escHtml(query)) + '</div>';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) {
    if (results.length === 80) {
      countEl.textContent = _nt('gs_count_more', '{n}+ résultats').replace('{n}', '80');
    } else {
      const s = results.length > 1 ? 's' : '';
      countEl.textContent = _nt('gs_count_results', '{n} résultat{s}').replace('{n}', results.length).replace('{s}', s);
    }
  }

  container.innerHTML = results.map((r, i) => `
    <div class="global-search-result" data-pos="${r.pos}" data-idx="${i}"
      onclick="gsNavigateTo(${r.pos})" onmouseover="gsHighlight(${i})">
      <div class="gs-result-context">…${escHtml(r.before)}<mark>${escHtml(r.match)}</mark>${escHtml(r.after)}…</div>
      ${r.chapter ? `<div class="gs-result-chapter">📖 ${escHtml(r.chapter)}</div>` : ''}
    </div>
  `).join('');

  _gsSelectedIdx = -1;
}

function gsHighlight(idx) {
  _gsSelectedIdx = idx;
  document.querySelectorAll('.global-search-result').forEach((el, i) => {
    el.style.background = i === idx ? 'var(--paper)' : '';
    el.style.borderLeftColor = i === idx ? 'var(--accent)' : '';
  });
}

function gsNavigateTo(pos) {
  closeGlobalSearch();
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  ta.focus();
  ta.setSelectionRange(pos, pos + (document.getElementById('gs-input')?.value?.length || 0));
  // Scroll to position in textarea
  const linesBefore = ta.value.slice(0, pos).split('\n').length;
  const lineHeight  = parseInt(getComputedStyle(ta).lineHeight) || 20;
  ta.scrollTop = Math.max(0, (linesBefore - 5) * lineHeight);
}

function gsKeyNav(e) {
  const items = document.querySelectorAll('.global-search-result');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _gsSelectedIdx = Math.min(_gsSelectedIdx + 1, items.length - 1);
    gsHighlight(_gsSelectedIdx);
    items[_gsSelectedIdx]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _gsSelectedIdx = Math.max(_gsSelectedIdx - 1, 0);
    gsHighlight(_gsSelectedIdx);
    items[_gsSelectedIdx]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && _gsSelectedIdx >= 0) {
    e.preventDefault();
    const pos = parseInt(items[_gsSelectedIdx]?.dataset.pos);
    if (!isNaN(pos)) gsNavigateTo(pos);
  }
}

// ── 4. DRAG & DROP CHAPITRES ───────────────────────────
// Ajoute le drag-and-drop aux cartes du corkboard après rendu
(function() {
  let _dragSrcIdx = null;

  function enableChapterDragDrop() {
    const container = document.getElementById('corkboard-cards');
    if (!container) return;
    const cards = Array.from(container.querySelectorAll('.cork-card'));
    if (!cards.length) return;

    cards.forEach((card, idx) => {
      // Éviter de re-binder deux fois
      if (card.dataset.dndBound === '1') return;
      card.dataset.dndBound = '1';
      card.setAttribute('draggable', 'true');

      // Poignée de drag (si pas déjà présente)
      if (!card.querySelector('.ch-drag-handle')) {
        const handle = document.createElement('span');
        handle.className = 'ch-drag-handle';
        handle.innerHTML = '⠿';
        handle.title = 'Glisser pour réorganiser';
        card.insertBefore(handle, card.firstChild);
      }

      card.addEventListener('dragstart', function(e) {
        _dragSrcIdx = Array.from(container.querySelectorAll('.cork-card')).indexOf(card);
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(_dragSrcIdx));
      });

      card.addEventListener('dragend', function() {
        card.classList.remove('dragging');
        container.querySelectorAll('.cork-card').forEach(el => el.classList.remove('drag-over'));
      });

      card.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const curIdx = Array.from(container.querySelectorAll('.cork-card')).indexOf(card);
        container.querySelectorAll('.cork-card').forEach(el => el.classList.remove('drag-over'));
        if (curIdx !== _dragSrcIdx) card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', function() {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', function(e) {
        e.preventDefault();
        card.classList.remove('drag-over');
        const toIdx = Array.from(container.querySelectorAll('.cork-card')).indexOf(card);
        if (_dragSrcIdx === null || toIdx === _dragSrcIdx) return;
        _reorderChapterInText(_dragSrcIdx, toIdx);
        _dragSrcIdx = null;
      });
    });
  }

  // Réordonne les chapitres dans le texte brut en utilisant _corkChapters
  function _reorderChapterInText(fromIdx, toIdx) {
    const ta = document.getElementById('raw-input');
    if (!ta) return;

    // Filtrer uniquement les H1 (comme le corkboard)
    const h1Chapters = (_corkChapters || []).filter(ch => ch.level === 1);
    if (fromIdx >= h1Chapters.length || toIdx >= h1Chapters.length) {
      showToast('Réorganisation limitée aux chapitres détectés.', 2500);
      return;
    }

    const text = ta.value;

    // Trouver la position de chaque titre H1 dans le texte brut
    const positions = h1Chapters.map(ch => {
      // Chercher la ligne exacte
      const needle = ch.text;
      let pos = text.indexOf('\n' + needle + '\n');
      if (pos >= 0) return pos + 1; // +1 pour sauter le \n
      pos = text.indexOf('\n' + needle);
      if (pos >= 0) return pos + 1;
      // Chercher en début de fichier
      if (text.startsWith(needle)) return 0;
      return -1;
    });

    if (positions.some(p => p < 0)) {
      showToast('Impossible de réorganiser : certains titres introuvables.', 2500);
      return;
    }

    // Extraire les blocs (du titre jusqu'au prochain titre H1, ou fin de texte)
    const sortedPos = [...positions].sort((a, b) => a - b);
    // Réordonner sortedPos selon l'ordre trouvé (les positions peuvent ne pas être triées
    // si le texte est déjà partiellement réordonné — on prend l'ordre des positions telles quelles)
    const blocks = positions.map((pos, i) => {
      // Trouver la fin : prochaine position dans le tableau positions (triées)
      const nextPositions = positions.filter(p => p > pos);
      const end = nextPositions.length ? Math.min(...nextPositions) : text.length;
      return text.slice(pos, end);
    });

    // Déplacer le bloc
    const moved = blocks.splice(fromIdx, 1)[0];
    blocks.splice(toIdx, 0, moved);

    // Préambule avant le premier titre
    const firstPos = Math.min(...positions);
    const preamble = text.slice(0, firstPos);
    const newText = preamble + blocks.join('');

    ta.value = newText;
    onRawInput();
    markUnsaved();
    showToast('Chapitre déplacé ✓', 1800, 'ok');

    // Ré-activer le drag après re-rendu
    setTimeout(enableChapterDragDrop, 500);
  }

  // Hook sur updateChapterList pour activer le DnD après chaque re-rendu corkboard
  const _origUpdateChapterList = window.updateChapterList;
  if (typeof _origUpdateChapterList === 'function') {
    window.updateChapterList = function(chapters) {
      _origUpdateChapterList(chapters);
      // Activer le DnD sur les nouvelles cartes (léger délai pour laisser corkboardRender finir)
      setTimeout(enableChapterDragDrop, 120);
    };
  }

  // Activer aussi quand le panneau corkboard est ouvert (les cartes existent déjà)
  const _origSwitch = window.switchSidebarTab;
  if (typeof _origSwitch === 'function') {
    window.switchSidebarTab = function(name) {
      _origSwitch(name);
      if (name === 'corkboard') setTimeout(enableChapterDragDrop, 150);
    };
  }

  document.addEventListener('atelier:ready', () => setTimeout(enableChapterDragDrop, 400));
})();

// ── 5. RACCOURCIS CLAVIER GLOBAUX SUPPLÉMENTAIRES ─────
document.addEventListener('keydown', function(e) {
  const ctrl = e.ctrlKey || e.metaKey;

  // Ctrl+? → aide
  if (ctrl && e.key === '?') {
    e.preventDefault();
    openHelpModal();
    return;
  }

  // Ctrl+Shift+G → recherche globale
  if (ctrl && e.shiftKey && e.key === 'G') {
    e.preventDefault();
    openGlobalSearch();
    return;
  }

  // Ctrl+Shift+D → dark mode
  if (ctrl && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    toggleDarkMode();
    return;
  }

  // Ctrl+M → export Markdown
  if (ctrl && !e.shiftKey && e.key === 'm') {
    // Ne pas intercepter si focus dans un input/textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    exportMarkdown();
    return;
  }

  // Ctrl+E → export Word
  if (ctrl && !e.shiftKey && e.key === 'e') {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    if (typeof exportWord === 'function') exportWord();
    return;
  }
});

// Bouton recherche globale dans le header (barre d'outils toolbar — Ctrl+Shift+G)
// Ajout du raccourci aussi sur la barre de recherche via Ctrl+Shift+F dans l'éditeur
document.addEventListener('DOMContentLoaded', function() {
  // Ajouter bouton recherche globale à côté du btn-focus dans le header
  const btnFocus = document.getElementById('btn-focus');
  if (btnFocus) {
    const gsBtn = document.createElement('button');
    gsBtn.className = 'btn-help-toggle';
    gsBtn.title = 'Rechercher dans tout le projet (Ctrl+Shift+G)';
    gsBtn.setAttribute('aria-label', 'Recherche globale');
    gsBtn.innerHTML = '<i class="ti ti-search" aria-hidden="true"></i>';
    gsBtn.onclick = openGlobalSearch;
    btnFocus.parentNode.insertBefore(gsBtn, btnFocus);
  }
});

// ════════════════════════════════════════════════════════════════════════
// ██  SYSTÈME D'ANNOTATIONS PROPRES — _ANNOT ENGINE v1
//     Aucune balise dans le textarea. Surlignage purement visuel.
//     Compatible migration balises inline [NOTE:], [HL:], [TAG:]
// ════════════════════════════════════════════════════════════════════════

const _ANNOT = (() => {
  // ── Palette ───────────────────────────────────────────────────────────
  const PALETTE = {
    jaune:  { bg: 'rgba(253,224,71,0.38)',  border: '#ca8a04', label: '🟡' },
    rose:   { bg: 'rgba(249,168,212,0.38)', border: '#be185d', label: '🩷' },
    vert:   { bg: 'rgba(134,239,172,0.38)', border: '#15803d', label: '🟢' },
    bleu:   { bg: 'rgba(147,197,253,0.38)', border: '#1d4ed8', label: '🔵' },
    orange: { bg: 'rgba(253,186,116,0.38)', border: '#c2410c', label: '🟠' },
    violet: { bg: 'rgba(196,181,253,0.38)', border: '#7c3aed', label: '🟣' },
    rouge:  { bg: 'rgba(252,165,165,0.38)', border: '#dc2626', label: '🔴' },
    cyan:   { bg: 'rgba(103,232,249,0.38)', border: '#0e7490', label: '🩵' },
  };

  // ── Store ─────────────────────────────────────────────────────────────
  // { id, anchor(texte exact, 60 chars), offset(pos dans textarea), color,
  //   note, priority(none|low|mid|high), done, createdAt, type(note|hl|tag), tag }
  let _store = [];
  let _nextId = 1;

  // ── Utilitaires ───────────────────────────────────────────────────────
  function _uid() { return 'a' + (_nextId++) + '_' + Date.now().toString(36); }

  function _lang() {
    return (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
  }

  function _t2(key, fb) {
    const l = _lang();
    return (typeof _i18n !== 'undefined' && _i18n[l] && _i18n[l][key]) ? _i18n[l][key] : (fb || key);
  }

  // ── Localisation de l'ancre dans le texte actuel ──────────────────────
  // Stratégie : chercher l'ancre (texte exact), retourner {start, end} ou null
  function _locate(annot) {
    const ta = document.getElementById('raw-input');
    if (!ta) return null;
    const text = ta.value;
    // Essayer d'abord à l'offset mémorisé (rapide), puis chercher global
    const anchor = annot.anchor;
    if (!anchor || anchor.length < 3) return null;
    // Cherche à partir de l'offset sauvegardé ± 200 chars
    const searchFrom = Math.max(0, (annot.offset || 0) - 100);
    let idx = text.indexOf(anchor, searchFrom);
    if (idx === -1) idx = text.indexOf(anchor); // fallback global
    if (idx === -1) return null;
    // Mettre à jour l'offset mémorisé
    annot.offset = idx;
    // Utiliser selLength si présent (longueur réelle de la sélection, peut dépasser anchor tronqué à 120)
    const hlLen = (annot.selLength && annot.selLength > anchor.length) ? annot.selLength : anchor.length;
    return { start: idx, end: idx + hlLen };
  }

  // ── Calcul des positions pixel via mirror div ─────────────────────────
  function _getPixelRects(ta, start, end) {
    const cs = window.getComputedStyle(ta);
    const mirror = document.createElement('div');
    const props = ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight',
      'letterSpacing','wordSpacing','paddingTop','paddingBottom','paddingLeft',
      'paddingRight','borderTopWidth','borderBottomWidth','boxSizing',
      'overflowWrap','whiteSpace','tabSize','width'];
    props.forEach(p => { mirror.style[p] = cs[p]; });
    mirror.style.position   = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top        = '0';
    mirror.style.left       = '0';
    mirror.style.height     = 'auto';
    mirror.style.overflow   = 'hidden';
    mirror.style.zIndex     = '-9999';

    const text = ta.value;
    const pre  = document.createElement('span');
    pre.textContent = text.slice(0, start);
    const mid  = document.createElement('span');
    mid.textContent = text.slice(start, end);
    const post = document.createElement('span');
    post.textContent = text.slice(end);

    mirror.appendChild(pre);
    mirror.appendChild(mid);
    mirror.appendChild(post);
    document.body.appendChild(mirror);

    const mirrorRect = mirror.getBoundingClientRect();
    const midRects   = mid.getClientRects();
    const rects = [];
    for (const r of midRects) {
      rects.push({
        top:    r.top - mirrorRect.top + (ta.scrollTop || 0) - ta.scrollTop,
        left:   r.left - mirrorRect.left,
        width:  r.width,
        height: r.height,
      });
    }
    document.body.removeChild(mirror);
    return rects;
  }

  // ── RENDER MIRROR ─────────────────────────────────────────────────────
  let _renderTimer = null;
  function render() {
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(_doRender, 60);
  }

  // Cache des rects absolus par annotId (recalculé si texte change, pas si scroll)
  let _rectCache   = {};   // { [annotId]: [{absTop, left, width, height}] }
  let _lastText    = null; // invalide le cache si le texte change

  function _doRender() {
    const ta     = document.getElementById('raw-input');
    const mirror = document.getElementById('annot-mirror');
    if (!ta || !mirror) return;

    const scrollTop  = ta.scrollTop;
    const taRect     = ta.getBoundingClientRect();
    const wrapRect   = ta.parentNode.getBoundingClientRect();

    // Aligner le mirror sur le textarea
    mirror.style.top    = (taRect.top  - wrapRect.top)  + 'px';
    mirror.style.left   = (taRect.left - wrapRect.left) + 'px';
    mirror.style.width  = taRect.width  + 'px';
    mirror.style.height = taRect.height + 'px';

    // Invalider le cache si le texte a changé
    if (ta.value !== _lastText) {
      _rectCache = {};
      _lastText  = ta.value;
    }

    mirror.innerHTML = '';

    _store.forEach(annot => {
      if (annot.done) return;
      const loc = _locate(annot);
      if (!loc) return;

      // Calculer (et mettre en cache) les rects absolus
      if (!_rectCache[annot.id]) {
        _rectCache[annot.id] = _getAbsoluteRects(ta, loc.start, loc.end);
      }

      const col = PALETTE[annot.color] || PALETTE['jaune'];
      _rectCache[annot.id].forEach((r, ri) => {
        const top = r.absTop - scrollTop;
        // Clip : ne pas afficher ce qui est hors de la zone visible
        if (top + r.height <= 0 || top >= taRect.height) return;

        const el = document.createElement('div');
        el.className = 'annot-hl-rect';
        el.dataset.annotId = annot.id;
        el.dataset.rectIdx = ri;
        el.dataset.absTop  = r.absTop; // stocker pour la mise à jour rapide au scroll
        el.style.cssText = `
          top:${top}px;
          left:${r.left}px;
          width:${r.width}px;
          height:${r.height}px;
          background:${col.bg};
        `;
        el.addEventListener('mouseenter', (e) => _showTooltip(annot, e));
        el.addEventListener('mouseleave', _scheduleHideTooltip);
        el.addEventListener('click', (e) => { e.stopPropagation(); _editAnnot(annot.id); });
        mirror.appendChild(el);
      });
    });
  }

  // Mise à jour ultra-rapide au scroll : juste repositionner les divs existants
  function _onScroll() {
    const ta     = document.getElementById('raw-input');
    const mirror = document.getElementById('annot-mirror');
    if (!ta || !mirror) return;
    const scrollTop  = ta.scrollTop;
    const taHeight   = ta.clientHeight;
    const rects = mirror.querySelectorAll('.annot-hl-rect');
    rects.forEach(el => {
      const absTop = parseFloat(el.dataset.absTop);
      const top    = absTop - scrollTop;
      if (top + parseFloat(el.style.height) <= 0 || top >= taHeight) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
        el.style.top = top + 'px';
      }
    });
  }

  // ── Calcul des rects absolus (positions dans le contenu total, sans scroll) ──
  // Ghost height:auto = tout le contenu déployé, positionné hors-écran.
  // Retourne des coords absolues depuis le haut du contenu texte du textarea.
  function _getAbsoluteRects(ta, start, end) {
    const cs = window.getComputedStyle(ta);
    const pt = parseFloat(cs.paddingTop);
    const pl = parseFloat(cs.paddingLeft);
    const pr = parseFloat(cs.paddingRight);

    const ghost = document.createElement('div');
    [
      'fontFamily','fontSize','fontWeight','fontStyle',
      'lineHeight','letterSpacing','wordSpacing',
      'overflowWrap','wordBreak','whiteSpace','tabSize',
      'textIndent','textTransform'
    ].forEach(p => { ghost.style[p] = cs[p]; });

    // Largeur identique à la zone texte du textarea
    ghost.style.width      = (ta.clientWidth - pl - pr) + 'px';
    ghost.style.padding    = '0';
    ghost.style.margin     = '0';
    ghost.style.border     = 'none';
    ghost.style.height     = 'auto';
    ghost.style.overflow   = 'visible';
    // Positionner hors-écran (pas de scroll simulé — on veut les coords absolues)
    ghost.style.position   = 'fixed';
    ghost.style.top        = '-9999px';
    ghost.style.left       = '0';
    ghost.style.visibility = 'hidden';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex     = '-9999';
    ghost.style.color      = 'transparent';
    ghost.style.background = 'transparent';

    const text = ta.value;
    ghost.appendChild(document.createTextNode(text.slice(0, start)));
    const mid = document.createElement('span');
    mid.textContent = text.slice(start, end);
    ghost.appendChild(mid);
    ghost.appendChild(document.createTextNode(text.slice(end)));
    document.body.appendChild(ghost);

    const ghostRect = ghost.getBoundingClientRect();
    const rects = [];
    for (const r of mid.getClientRects()) {
      // Position absolue depuis le haut du contenu texte = r.top - ghostRect.top
      // On ajoute paddingTop pour être relatif au bord haut du textarea (pas du texte)
      rects.push({
        absTop: r.top - ghostRect.top + pt,
        left:   r.left - ghostRect.left + pl,
        width:  r.width,
        height: r.height,
      });
    }
    document.body.removeChild(ghost);
    return rects;
  }


  // ── TOOLTIP ───────────────────────────────────────────────────────────
  let _tooltipTimer  = null;
  let _hideTimer     = null;
  let _currentAnnot  = null;

  function _getOrCreateTooltip() {
    let tip = document.getElementById('annot-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'annot-tooltip';
      document.body.appendChild(tip);
      tip.addEventListener('mouseenter', () => clearTimeout(_hideTimer));
      tip.addEventListener('mouseleave', _scheduleHideTooltip);
    }
    return tip;
  }

  function _showTooltip(annot, e) {
    clearTimeout(_hideTimer);
    clearTimeout(_tooltipTimer);
    _currentAnnot = annot;
    _tooltipTimer = setTimeout(() => _renderTooltip(annot, e), 120);
  }

  function _renderTooltip(annot, e) {
    const tip = _getOrCreateTooltip();
    const col = PALETTE[annot.color] || PALETTE['jaune'];
    const prioEmoji = { high: '🔴', mid: '🟡', low: '🟢', none: '' }[annot.priority || 'none'] || '';
    const excerpt = annot.anchor ? (annot.anchor.length > 50 ? annot.anchor.slice(0,50) + '…' : annot.anchor) : '';
    const noteHtml = annot.note
      ? `<span class="att-text">${escHtml ? escHtml(annot.note) : annot.note}</span>`
      : `<span class="att-text" style="opacity:0.4">${_t2('annot_no_note', '(sans commentaire)')}</span>`;

    const editLabel   = _t2('annot_edit',   'Modifier');
    const deleteLabel = _t2('annot_delete', 'Supprimer');
    const doneLabel   = _t2('annot_done',   'Traiter');

    tip.innerHTML = `
      <span class="att-color-dot" style="background:${col.border}"></span>${prioEmoji}
      ${noteHtml}
      ${excerpt ? `<span class="att-excerpt">"${escHtml ? escHtml(excerpt) : excerpt}"</span>` : ''}
      <div class="att-actions">
        <button class="att-action-btn" onclick="_ANNOT.edit('${annot.id}')">${editLabel}</button>
        <button class="att-action-btn" onclick="_ANNOT.toggleDone('${annot.id}')">${doneLabel}</button>
        <button class="att-action-btn danger" onclick="_ANNOT.remove('${annot.id}')">${deleteLabel}</button>
      </div>`;
    tip.classList.add('show', 'interactive');

    // Positionnement
    const x = Math.min(e.clientX + 10, window.innerWidth - 300);
    let y = e.clientY - 80;
    const below = y < 10;
    if (below) { y = e.clientY + 18; tip.classList.add('tip-below'); }
    else { tip.classList.remove('tip-below'); }
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  function _scheduleHideTooltip() {
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(() => {
      const tip = document.getElementById('annot-tooltip');
      if (tip) { tip.classList.remove('show','interactive'); }
      _currentAnnot = null;
    }, 250);
  }

  // ── DIALOGUE CRÉATION/ÉDITION ─────────────────────────────────────────
  let _dlgState = null; // { mode:'create'|'edit', annotId, selStart, selEnd, selectedColor, priority }

  function _openDialog(mode, annotId, selStart, selEnd, selectedText) {
    const overlay = document.getElementById('annot-dialog-overlay');
    const titleEl = document.getElementById('adlg-title-label');
    const excerptEl = document.getElementById('adlg-excerpt');
    const noteEl = document.getElementById('adlg-note-text');
    if (!overlay) return;

    const initColor = 'jaune';
    const initPrio  = 'none';
    let existingAnnot = null;

    if (mode === 'edit') {
      existingAnnot = _store.find(a => a.id === annotId);
      if (!existingAnnot) return;
    }

    _dlgState = {
      mode, annotId,
      selStart: selStart || (existingAnnot ? existingAnnot.offset : 0),
      selEnd:   selEnd   || (existingAnnot ? existingAnnot.offset + existingAnnot.anchor.length : 0),
      selectedColor: existingAnnot ? existingAnnot.color : initColor,
      priority:      existingAnnot ? (existingAnnot.priority || initPrio) : initPrio,
    };

    if (titleEl) titleEl.setAttribute('data-i18n', mode === 'edit' ? 'adlg_edit_title' : 'adlg_title');
    if (titleEl) titleEl.textContent = _t2(mode === 'edit' ? 'adlg_edit_title' : 'adlg_title', mode === 'edit' ? 'Modifier l\'annotation' : 'Nouvelle annotation');
    const excerpt = existingAnnot ? existingAnnot.anchor : (selectedText || '');
    if (excerptEl) excerptEl.textContent = excerpt ? ('"' + excerpt.slice(0,80) + (excerpt.length > 80 ? '…' : '') + '"') : '';
    if (noteEl) noteEl.value = existingAnnot ? (existingAnnot.note || '') : '';

    // Rendre la palette de couleurs
    const colContainer = document.getElementById('adlg-colors');
    if (colContainer) {
      colContainer.innerHTML = '';
      Object.entries(PALETTE).forEach(([key, col]) => {
        const dot = document.createElement('div');
        dot.className = 'adlg-color-dot' + (_dlgState.selectedColor === key ? ' selected' : '');
        dot.style.background = col.border;
        dot.title = _t2('color_' + key, key);
        dot.onclick = () => {
          _dlgState.selectedColor = key;
          colContainer.querySelectorAll('.adlg-color-dot').forEach(d => d.classList.remove('selected'));
          dot.classList.add('selected');
        };
        colContainer.appendChild(dot);
      });
    }

    // Rendre les boutons de priorité
    const prioContainer = document.getElementById('adlg-prios');
    if (prioContainer) {
      prioContainer.querySelectorAll('.adlg-prio').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.prio === _dlgState.priority);
      });
    }

    overlay.classList.add('open');
    setTimeout(() => noteEl && noteEl.focus(), 80);
  }

  // ── CONTEXT MENU ─────────────────────────────────────────────────────
  let _ctxSel = null; // { start, end, text }

  function _buildContextMenu() {
    const ctxColors = document.getElementById('actx-colors');
    if (!ctxColors || ctxColors.children.length > 0) return; // déjà construit
    Object.entries(PALETTE).forEach(([key, col]) => {
      const btn = document.createElement('div');
      btn.className = 'actx-color-btn';
      btn.style.background = col.border;
      btn.title = _t2('color_' + key, key);
      btn.onclick = () => {
        if (_ctxSel) {
          const sel = _ctxSel;
          _closeCtxMenu();
          add(sel.start, sel.end, key, '', 'none', 'hl', sel.text);
        } else {
          _closeCtxMenu();
        }
      };
      ctxColors.appendChild(btn);
    });
  }

  function _openCtxMenu(x, y, selStart, selEnd, selText, hasSel) {
    _buildContextMenu();
    const menu = document.getElementById('annot-ctx-menu');
    if (!menu) return;
    _ctxSel = { start: selStart, end: selEnd, text: selText };

    // Classe has-selection pour afficher/masquer les sections contextuelles
    menu.classList.toggle('has-selection', !!hasSel);

    // Comptage de mots de la sélection
    const wc = document.getElementById('actx-word-count');
    if (wc && hasSel) {
      const words = selText.trim().split(/\s+/).filter(Boolean).length;
      const chars = selText.length;
      const wLabel = words > 1 ? _nt('ctx_wc_words_pl', '{n} mots').replace('{n}', words) : _nt('ctx_wc_word_s', '{n} mot').replace('{n}', words);
      const cLabel = chars > 1 ? _nt('ctx_wc_chars_pl', '{n} caractères').replace('{n}', chars) : _nt('ctx_wc_char_s', '{n} caractère').replace('{n}', chars);
      wc.textContent = wLabel + ' · ' + cLabel;
    }

    // Pré-remplir "Chercher" avec le mot sous le curseur ou la sélection
    const searchBtn = document.getElementById('actx-search-word');
    if (searchBtn && hasSel) {
      const preview = selText.length > 22 ? selText.slice(0, 22) + '…' : selText;
      searchBtn.querySelector('.actx-item-left').textContent = _nt('ctx_search_word_preview', '🔍 Chercher « {w} »').replace('{w}', preview);
    } else if (searchBtn) {
      searchBtn.querySelector('.actx-item-left').textContent = _nt('ctx_search_word', '🔍 Chercher dans le texte');
    }

    // Positionnement : mesurer la vraie hauteur du menu avant de le placer
    // 1) Rendre visible hors ecran pour obtenir les dimensions reelles
    menu.style.visibility = 'hidden';
    menu.style.left = '-9999px';
    menu.style.top  = '-9999px';
    menu.classList.add('open');

    const menuW = menu.offsetWidth  || 240;
    const menuH = menu.offsetHeight || 200;

    // 2) Preferer en dessous/droite du clic ; basculer au-dessus/gauche si debordement
    const margin = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x;
    let top  = y;

    // Debordement a droite
    if (left + menuW + margin > vw) left = Math.max(margin, vw - menuW - margin);
    // Debordement en bas : afficher au-dessus du point de clic
    if (top + menuH + margin > vh) top = Math.max(margin, y - menuH);
    // Garde haute (fenetre tres petite)
    if (top < margin) top = margin;

    // 3) Positionner et rendre visible
    menu.style.left       = left + 'px';
    menu.style.top        = top  + 'px';
    menu.style.visibility = '';
  }

  function _closeCtxMenu() {
    const menu = document.getElementById('annot-ctx-menu');
    if (menu) menu.classList.remove('open');
    _ctxSel = null;
  }

  // ── LANGUAGETOOL — vérification orthographique ────────────────────────
  let _ltAbort  = null;
  let _ltWStart = 0;   // position début du mot vérifié dans le textarea
  let _ltWEnd   = 0;   // position fin du mot vérifié dans le textarea

  async function _ltCheckWord(word, wordStart, wordEnd) {
    _ltWStart = wordStart;
    _ltWEnd   = wordEnd;
    const sec      = document.getElementById('actx-spell-section');
    const loading  = document.getElementById('actx-spell-loading');
    const sugg     = document.getElementById('actx-spell-suggestions');
    if (!sec || !sugg) return;

    sec.style.display = 'block';
    loading.style.display = 'block';
    sugg.innerHTML = '';

    if (_ltAbort) _ltAbort.abort();
    _ltAbort = { aborted: false, abort() { this.aborted = true; } };
    const ctrl = _ltAbort;

    try {
      const lang = getPref('ia_langue') === 'en' ? 'en-US' : 'fr';
      const body = 'text=' + encodeURIComponent(word) + '&language=' + lang + '&enabledOnly=false';

      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.languagetool.org/v2/check', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onload  = () => { if (ctrl.aborted) return; try { resolve(JSON.parse(xhr.responseText)); } catch(e) { reject(e); } };
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(body);
      });
      if (ctrl.aborted) return;
      loading.style.display = 'none';

      const matches = (data.matches || []).filter(m =>
        m.rule?.issueType === 'misspelling' ||
        m.rule?.category?.id === 'TYPOS' ||
        m.rule?.category?.id === 'CASING'
      );

      if (matches.length === 0 || !matches[0].replacements?.length) {
        sec.style.display = 'none';
        return;
      }

      const replacements = matches[0].replacements.slice(0, 6);
      // Capturer les positions au moment de la création des boutons (évite tout problème de closure async)
      const capturedStart = _ltWStart;
      const capturedEnd   = _ltWEnd;
      sugg.innerHTML = '';
      replacements.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'actx-item';
        btn.innerHTML = `<span class="actx-item-left" style="gap:6px;"><span style="color:var(--accent);font-size:13px;">→</span><span>${escHtml(r.value)}</span></span>`;
        // mousedown preventDefault : empêche le textarea de perdre le focus avant l'application
        btn.addEventListener('mousedown', (ev) => { ev.preventDefault(); ev.stopPropagation(); });
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          ltApplyDirect(capturedStart, capturedEnd, r.value);
        });
        sugg.appendChild(btn);
      });

    } catch (err) {
      if (ctrl && ctrl.aborted) return;
      loading.style.display = 'none';
      sec.style.display = 'none';
    }
  }

  // Exposée globalement pour les onclick inline des suggestions (legacy)
  window.ltApply = function(replacement) {
    const ta = document.getElementById('raw-input');
    if (!ta) return;
    taReplace(ta, _ltWStart, _ltWEnd, replacement);
    onRawInput();
    _closeCtxMenu();
    showToast('Correction appliquée ✓', 1400, 'ok');
  };

  // Version directe utilisée par les boutons construits via addEventListener
  // (positions passées explicitement — pas de dépendance aux variables de closure async)
  function ltApplyDirect(start, end, replacement) {
    const ta = document.getElementById('raw-input');
    if (!ta) return;
    taReplace(ta, start, end, replacement);
    onRawInput();
    _closeCtxMenu();
    showToast('Correction appliquée ✓', 1400, 'ok');
  }

  // ── API PUBLIQUE ──────────────────────────────────────────────────────
  function add(selStart, selEnd, color, note, priority, type, anchor) {
    const ta = document.getElementById('raw-input');
    if (!ta) return null;
    const text = ta.value;
    const anch = anchor || text.slice(selStart, selEnd);
    if (!anch || anch.length < 1) return null;

    const annot = {
      id:        _uid(),
      anchor:    anch.slice(0, 120),
      selLength: anch.length,
      offset:    selStart,
      color:     color || 'jaune',
      note:      note || '',
      priority:  priority || 'none',
      done:      false,
      createdAt: new Date().toISOString(),
      type:      type || 'hl',
    };
    _store.push(annot);
    _persist();
    delete _rectCache[annot.id]; // invalider cache pour cette annot
    render();
    notesRefresh && notesRefresh();
    return annot;
  }

  function remove(id) {
    delete _rectCache[id];
    _store = _store.filter(a => a.id !== id);
    _persist();
    render();
    notesRefresh && notesRefresh();
    const tip = document.getElementById('annot-tooltip');
    if (tip) tip.classList.remove('show','interactive');
  }

  function edit(id) {
    const annot = _store.find(a => a.id === id);
    if (!annot) return;
    _openDialog('edit', id, null, null, null);
    const tip = document.getElementById('annot-tooltip');
    if (tip) tip.classList.remove('show','interactive');
  }

  function toggleDone(id) {
    const annot = _store.find(a => a.id === id);
    if (!annot) return;
    annot.done = !annot.done;
    delete _rectCache[id];
    _persist();
    render();
    notesRefresh && notesRefresh();
    const tip = document.getElementById('annot-tooltip');
    if (tip) tip.classList.remove('show','interactive');
    showToast && showToast(annot.done ? _t2('annot_toast_done','Annotation traitée ✓') : _t2('annot_toast_reopen','Annotation réouverte'), 1800, 'ok');
  }

  function getAll() { return [..._store]; }
  function clear()  { _store = []; _nextId = 1; _rectCache = {}; render(); notesRefresh && notesRefresh(); }

  function exportData() { return _store.map(a => ({ ...a })); }
  function importData(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(a => { if (a.id) _store.push({ ...a }); });
    // Mettre à jour _nextId
    const maxId = _store.map(a => parseInt(a.id.replace('a','').split('_')[0]) || 0).reduce((m, n) => Math.max(m, n), 0);
    _nextId = maxId + 1;
    render();
  }

  // ── MIGRATION BALISES INLINE ──────────────────────────────────────────
  function migrateInlineTags(text) {
    let changed = false;
    let out = text;

    // [NOTE: contenu]
    out = out.replace(/\[NOTE:\s*([^\]]*)\]/g, (m, content) => {
      const txt = content.trim();
      const idx = out.indexOf(m);
      if (txt) add(idx, idx, 'jaune', txt, 'none', 'note', txt.slice(0, 60) || m);
      changed = true;
      return txt || m.replace(/\[NOTE:\s*/,'').replace(/\]/,'');
    });

    // [HL:couleur texte | note]
    out = out.replace(/\[HL:(\w+)\s(.*?)(?:\s*\|\s*(.*?))?\]/g, (m, color, displayText, note) => {
      const dt = (displayText || '').trim();
      const nt = (note || '').trim();
      if (dt) add(0, 0, color in PALETTE ? color : 'jaune', nt, 'none', 'hl', dt.slice(0, 80));
      changed = true;
      return dt || m;
    });

    // [TAG:type texte]
    out = out.replace(/\[TAG:(\w+)\s([^\]]*)\]/g, (m, type, displayText) => {
      const dt = (displayText || '').trim();
      if (dt) add(0, 0, 'violet', `[${type}] ${dt}`, 'none', 'tag', dt.slice(0, 80));
      changed = true;
      return dt || m;
    });

    return { text: out, changed };
  }

  // ── NAVIGATION VERS UNE ANNOTATION ───────────────────────────────────
  function navigateTo(id) {
    const annot = _store.find(a => a.id === id);
    if (!annot) return;
    const ta = document.getElementById('raw-input');
    if (!ta) return;
    const loc = _locate(annot);
    if (!loc) { showToast && showToast(_t2('annot_not_found','Passage introuvable dans le texte.'), 2000, 'error'); return; }

    // Scroller le textarea
    const cs = window.getComputedStyle(ta);
    const m  = document.createElement('div');
    ['fontFamily','fontSize','lineHeight','paddingTop','paddingLeft','paddingRight',
     'borderTopWidth','boxSizing','overflowWrap','whiteSpace','width'].forEach(p => m.style[p] = cs[p]);
    m.style.cssText += ';position:absolute;visibility:hidden;height:auto;';
    const pre = document.createTextNode(ta.value.slice(0, loc.start));
    const mark = document.createElement('span');
    mark.textContent = ta.value.slice(loc.start, loc.end);
    m.appendChild(pre); m.appendChild(mark);
    document.body.appendChild(m);
    const targetTop = mark.offsetTop - ta.clientHeight / 2 + parseInt(cs.lineHeight);
    document.body.removeChild(m);
    ta.scrollTop = Math.max(0, targetTop);
    ta.setSelectionRange(loc.start, loc.end);
    ta.focus();

    render();
    showToast && showToast(_t2('annot_navigated','Passage localisé ✦'), 1500, 'ok');
  }

  // ── PERSISTANCE LOCALE ────────────────────────────────────────────────
  function _persist() {
    try { localStorage.setItem('atelier_annotations_v2', JSON.stringify(_store)); } catch(e) {}
  }

  function _load() {
    try {
      const raw = localStorage.getItem('atelier_annotations_v2');
      if (raw) { _store = JSON.parse(raw); const max = _store.map(a => parseInt(a.id.replace('a','').split('_')[0])||0).reduce((m,n)=>Math.max(m,n),0); _nextId = max + 1; }
    } catch(e) {}
  }

  // ── INIT DOM ──────────────────────────────────────────────────────────
  function _initDOM() {
    const ta = document.getElementById('raw-input');
    if (!ta) return;

    // Clic droit → context menu
    ta.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const selStart = ta.selectionStart;
      const selEnd   = ta.selectionEnd;
      const hasSel   = selEnd > selStart && ta.value.slice(selStart, selEnd).trim().length >= 1;
      const selText  = hasSel ? ta.value.slice(selStart, selEnd) : '';

      // Détecter le mot sous le curseur (sans sélection)
      // Le regex inclut les lettres accentuées françaises et le tiret intra-mot
      const WORD_CHAR = /[a-zA-ZÀ-ÖØ-öø-ÿœŒæÆ'-]/;
      let wordStart = selStart, wordEnd = selStart, wordText = '';
      if (!hasSel) {
        const txt = ta.value;
        let ws = selStart;
        let we = selStart;
        while (ws > 0 && WORD_CHAR.test(txt[ws - 1])) ws--;
        while (we < txt.length && WORD_CHAR.test(txt[we])) we++;
        if (we > ws) {
          wordStart = ws;
          wordEnd   = we;
          wordText  = txt.slice(ws, we);
        }
      }

      _openCtxMenu(e.clientX, e.clientY, selStart, selEnd, selText, hasSel);

      // Lancer la vérification orthographique si un mot est détecté
      if (wordText.length >= 2) {
        _ltCheckWord(wordText, wordStart, wordEnd);
      } else {
        // Cacher la section orthographe si pas de mot
        const sec = document.getElementById('actx-spell-section');
        if (sec) sec.style.display = 'none';
      }
    });

    // Fermer le menu sur clic ailleurs
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('annot-ctx-menu');
      if (menu && !menu.contains(e.target)) _closeCtxMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { _closeCtxMenu(); annotDialogCancel(); }
    });

    // Scroll : repositionnement immédiat sans re-render (ultra-fluide)
    ta.addEventListener('scroll', _onScroll);
    // Re-render complet uniquement si le texte change (pour invalider le cache)
    ta.addEventListener('input', () => { _rectCache = {}; _lastText = null; render(); });

    // ResizeObserver pour gérer redimensionnement
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => render());
      ro.observe(ta);
    }

    // Charger depuis localStorage
    _load();
    // Migration des balises inline si texte existant
    if (ta.value.trim()) {
      const migrated = migrateInlineTags(ta.value);
      if (migrated.changed) ta.value = migrated.text;
    }
    setTimeout(render, 300);
  }

  return {
    render,
    add,
    remove,
    edit:       (id) => _editAnnot(id),
    toggleDone: (id) => toggleDone(id),
    // BUG #1 CORRIGÉ : méthode setPriority qui mute directement _store
    setPriority(id, prio) {
      const annot = _store.find(a => a.id === id);
      if (!annot) return;
      annot.priority = prio;
      _persist();
      render();
      notesRefresh && notesRefresh();
    },
    getAll,
    clear,
    export:     exportData,
    import:     importData,
    navigateTo,
    migrateInlineTags,
    openCtxMenu: _openCtxMenu,
    // Pour debug
    _store:     () => _store,
    _rectCache: _rectCache,
    _init:      _initDOM,
  };

  function _editAnnot(id) { edit(id); }
})();

// ── Fonctions globales pour le dialogue ──────────────────────────────────────
function annotCtxAddNote() {
  document.getElementById('annot-ctx-menu')?.classList.remove('open');
  // Récupérer la sélection courante du textarea
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  if (s === e) return;
  _ANNOT.openCtxMenu && _ANNOT.openCtxMenu(0, 0, s, e, ta.value.slice(s, e));
  // Ouvrir directement le dialogue avec couleur jaune par défaut
  setTimeout(() => {
    document.getElementById('annot-ctx-menu')?.classList.remove('open');
    // Simuler un clic sur "Ajouter une note"
    _annotDlgOpen('create', null, s, e, ta.value.slice(s, e));
  }, 10);
}

// ══════════════════════════════════════════════════════════════════════
// MENU CONTEXTUEL ÉDITEUR — fonctions d'action
// ══════════════════════════════════════════════════════════════════════

/** Ferme le menu et remet le focus sur le textarea */
function _ctxClose() {
  document.getElementById('annot-ctx-menu')?.classList.remove('open');
  document.getElementById('raw-input')?.focus();
}

/** Copier la sélection */
async function ctxCopy() {
  _ctxClose();
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
  if (!sel) return;
  try {
    await navigator.clipboard.writeText(sel);
    showToast('📋 ' + sel.length + ' caractères copiés');
  } catch(e) {
    // Fallback : execCommand (deprecated mais fonctionnel dans les contextes sans HTTPS)
    document.execCommand('copy');
  }
}

/** Couper la sélection */
async function ctxCut() {
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  if (s === e) { _ctxClose(); return; }
  const sel = ta.value.slice(s, e);
  _ctxClose();
  try {
    await navigator.clipboard.writeText(sel);
    taReplace(ta, s, e, '');
    ta.setSelectionRange(s, s);
    onRawInput();
    showToast('✂ ' + sel.length + ' caractères coupés');
  } catch(e2) {
    document.execCommand('cut');
  }
}

/** Coller depuis le presse-papiers */
async function ctxPaste() {
  const ta = document.getElementById('raw-input');
  _ctxClose();
  if (!ta) return;
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    taReplace(ta, s, e, text);
    ta.setSelectionRange(s + text.length, s + text.length);
    onRawInput();
    showToast(_nt('ctx_toast_pasted', '📋 Texte collé ({n} car.)').replace('{n}', text.length));
  } catch(err) {
    // Pas de permission clipboard : laisser le navigateur gérer
    showToast(_nt('ctx_toast_paste_denied', '⚠ Coller avec Ctrl+V — accès presse-papiers refusé'), 3500, 'error');
  }
}

/** Copier l'intégralité du texte */
async function ctxCopyAll() {
  _ctxClose();
  const ta = document.getElementById('raw-input');
  if (!ta || !ta.value) return;
  try {
    await navigator.clipboard.writeText(ta.value);
    showToast(_nt('ctx_toast_copied_all', '📄 Texte complet copié ({n} car.)').replace('{n}', ta.value.length));
  } catch(e) {
    ta.select();
    document.execCommand('copy');
  }
}

/** Tout sélectionner */
function ctxSelectAll() {
  _ctxClose();
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  ta.select();
  ta.focus();
}

/** Annuler (Ctrl+Z natif) */
function ctxUndo() {
  _ctxClose();
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  ta.focus();
  document.execCommand('undo');
}

/** Rétablir (Ctrl+Y natif) */
function ctxRedo() {
  _ctxClose();
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  ta.focus();
  document.execCommand('redo');
}

/**
 * Entourer la sélection de marqueurs (italique, gras, souligné…)
 * Si la sélection est déjà entourée → retirer les marqueurs (toggle)
 */
function ctxWrap(open, close) {
  _ctxClose();
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  if (s === e) return;
  const sel = ta.value.slice(s, e);
  const before = ta.value.slice(s - open.length, s);
  const after  = ta.value.slice(e, e + close.length);
  if (before === open && after === close) {
    // Toggle OFF — retirer les marqueurs
    taReplace(ta, s - open.length, e + close.length, sel);
    ta.setSelectionRange(s - open.length, e - open.length);
  } else {
    // Toggle ON — ajouter les marqueurs
    taReplace(ta, s, e, open + sel + close);
    ta.setSelectionRange(s + open.length, e + open.length);
  }
  onRawInput();
}

/** Lancer la recherche avec le texte sélectionné */
function ctxSearchWord() {
  const ta = document.getElementById('raw-input');
  const sel = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd).trim() : '';
  _ctxClose();
  if (!sel) return;
  const esInput = document.getElementById('es-input');
  if (!esInput) return;
  esInput.value = sel;
  esInput.dispatchEvent(new Event('input')); // déclenche esSearch()
  esInput.focus();
  esInput.select();
}

/** Insérer un saut de scène à la position du curseur */
function ctxInsertSceneBreak() {
  _ctxClose();
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  const pos = ta.selectionStart;
  const val = ta.value;
  // Insérer sur sa propre ligne avec lignes vides autour
  const before = pos > 0 && val[pos-1] !== '\n' ? '\n' : '';
  const after  = pos < val.length && val[pos] !== '\n' ? '\n' : '';
  const insert = before + '\n* * *\n' + after;
  taReplace(ta, pos, ta.selectionEnd, insert);
  const newPos = pos + insert.length;
  ta.setSelectionRange(newPos, newPos);
  onRawInput();
  showToast('— Saut de scène inséré');
}

/** Insérer une balise image — ouvre un prompt pour le nom */
function ctxInsertImageTag() {
  _ctxClose();
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  // Proposer les images déjà chargées ou demander un nom
  const keys = Object.keys(images || {});
  let name;
  if (keys.length === 0) {
    name = prompt('Nom de l\'image (ex : illustration-1) :');
  } else {
    const choices = keys.join(', ');
    name = prompt('Images disponibles : ' + choices + '\n\nNom de l\'image à insérer :', keys[0] || '');
  }
  if (!name || !name.trim()) return;
  const tag = '[IMAGE:' + name.trim().toLowerCase() + ']';
  const pos = ta.selectionStart;
  const before = pos > 0 && ta.value[pos-1] !== '\n' ? '\n' : '';
  const after  = pos < ta.value.length && ta.value[pos] !== '\n' ? '\n' : '';
  const insert = before + tag + after;
  taReplace(ta, pos, ta.selectionEnd, insert);
  ta.setSelectionRange(pos + insert.length, pos + insert.length);
  onRawInput();
  showToast('🖼 Balise ' + tag + ' insérée');
}

let _dlgState = { mode: 'create', selStart: 0, selEnd: 0, selectedColor: 'jaune', priority: 'none', annotId: null };

function _annotDlgOpen(mode, annotId, selStart, selEnd, selText) {
  const overlay = document.getElementById('annot-dialog-overlay');
  const titleEl = document.getElementById('adlg-title-label');
  const excerptEl = document.getElementById('adlg-excerpt');
  const noteEl = document.getElementById('adlg-note-text');
  if (!overlay) return;

  const existingAnnot = annotId ? _ANNOT.getAll().find(a => a.id === annotId) : null;
  _dlgState = {
    mode, annotId,
    selStart: selStart !== null ? selStart : (existingAnnot?.offset || 0),
    selEnd:   selEnd   !== null ? selEnd   : ((existingAnnot?.offset || 0) + (existingAnnot?.anchor?.length || 0)),
    selectedColor: existingAnnot ? existingAnnot.color : 'jaune',
    priority:      existingAnnot ? (existingAnnot.priority || 'none') : 'none',
  };

  if (titleEl) titleEl.textContent = _nt ? _nt(mode === 'edit' ? 'adlg_edit_title' : 'adlg_title', mode === 'edit' ? 'Modifier l\'annotation' : 'Nouvelle annotation') : (mode === 'edit' ? 'Modifier' : 'Nouvelle annotation');

  const excerpt = existingAnnot ? existingAnnot.anchor : (selText || '');
  if (excerptEl) excerptEl.textContent = excerpt ? ('"' + excerpt.slice(0, 80) + (excerpt.length > 80 ? '…' : '') + '"') : '';
  if (noteEl) noteEl.value = existingAnnot ? (existingAnnot.note || '') : '';

  // Palette de couleurs
  const colContainer = document.getElementById('adlg-colors');
  if (colContainer) {
    colContainer.innerHTML = '';
    Object.entries({ jaune:{border:'#ca8a04'}, rose:{border:'#be185d'}, vert:{border:'#15803d'}, bleu:{border:'#1d4ed8'}, orange:{border:'#c2410c'}, violet:{border:'#7c3aed'}, rouge:{border:'#dc2626'}, cyan:{border:'#0e7490'} }).forEach(([key, col]) => {
      const dot = document.createElement('div');
      dot.className = 'adlg-color-dot' + (_dlgState.selectedColor === key ? ' selected' : '');
      dot.style.background = col.border;
      dot.title = (typeof _nt === 'function') ? _nt('color_' + key, key) : key;
      dot.onclick = () => {
        _dlgState.selectedColor = key;
        colContainer.querySelectorAll('.adlg-color-dot').forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
      };
      colContainer.appendChild(dot);
    });
  }

  // Priorités
  document.querySelectorAll('.adlg-prio').forEach(btn => btn.classList.toggle('active', btn.dataset.prio === _dlgState.priority));

  overlay.classList.add('open');
  setTimeout(() => noteEl && noteEl.focus(), 80);
}

function annotDlgSetPrio(btn) {
  _dlgState.priority = btn.dataset.prio;
  document.querySelectorAll('.adlg-prio').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function annotDialogSave() {
  const noteEl = document.getElementById('adlg-note-text');
  const note = noteEl ? noteEl.value.trim() : '';

  if (_dlgState.mode === 'create') {
    _ANNOT.add(_dlgState.selStart, _dlgState.selEnd, _dlgState.selectedColor, note, _dlgState.priority);
  } else {
    // Édition
    const annot = _ANNOT.getAll().find(a => a.id === _dlgState.annotId);
    if (annot) {
      annot.note     = note;
      annot.color    = _dlgState.selectedColor;
      annot.priority = _dlgState.priority;
      if (typeof _ANNOT._rectCache !== 'undefined') delete _ANNOT._rectCache[annot.id];
      _ANNOT._store && _ANNOT.render();
      // Sauvegarder manuellement
      try { localStorage.setItem('atelier_annotations_v2', JSON.stringify(_ANNOT.getAll())); } catch(e) {}
      notesRefresh && notesRefresh();
    }
  }

  annotDialogCancel();
}

function annotDialogCancel() {
  const overlay = document.getElementById('annot-dialog-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Exposer _ANNOT.edit via la fonction globale
window._annotEdit = (id) => _annotDlgOpen('edit', id, null, null, null);

// ── Relier le bouton 💬 de la barre à l'ouverture du dialogue ───────────────
function insertComment() {
  const ta  = document.getElementById('raw-input');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  if (s === e) {
    showToast && showToast(_nt ? _nt('annot_select_first','Sélectionnez d\'abord un passage à annoter.') : 'Sélectionnez un passage.', 2200, 'error');
    return;
  }
  _annotDlgOpen('create', null, s, e, ta.value.slice(s, e));
}

// ── Relier insertNoteHL et insertNoteTag au nouveau système ─────────────────
function insertNoteHL(color) {
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  if (s === e) { showToast && showToast(_nt ? _nt('annot_select_first','Sélectionnez un passage.') : 'Sélectionnez un passage.', 2000, 'error'); return; }
  _dlgState = { mode: 'create', selStart: s, selEnd: e, selectedColor: color, priority: 'none', annotId: null };
  _annotDlgOpen('create', null, s, e, ta.value.slice(s, e));
}

function insertNoteTag(tagType) {
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  if (s === e) { showToast && showToast(_nt ? _nt('annot_select_first','Sélectionnez un passage.') : 'Sélectionnez un passage.', 2000, 'error'); return; }
  _annotDlgOpen('create', null, s, e, ta.value.slice(s, e));
}

// ── Initialisation DOM ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _ANNOT._init();
  // Re-relier _ANNOT.edit via window
  window._ANNOT = _ANNOT;
  window._ANNOT.edit = (id) => _annotDlgOpen('edit', id, null, null, null);
});
(function() {
  // Créer le tooltip unique dans le body
  const tip = document.createElement('div');
  tip.id = 'nav-rail-rich-tooltip';
  tip.innerHTML = '<div class="nav-rail-tooltip-title" id="nrt-title"></div><div class="nav-rail-tooltip-desc" id="nrt-desc"></div>';
  document.body.appendChild(tip);

  const titleEl = tip.querySelector('#nrt-title');
  const descEl  = tip.querySelector('#nrt-desc');
  let hideTimer  = null;

  function showTip(btn) {
    clearTimeout(hideTimer);
    const titleKey = btn.getAttribute('data-nrt');
    const descKey  = btn.getAttribute('data-nrd');
    if (!titleKey || !descKey) return;

    const lang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
    const t = (typeof _i18n !== 'undefined' && _i18n[lang]) ? _i18n[lang] : (_i18n && _i18n['fr']) || {};
    titleEl.textContent = t[titleKey] || titleKey;
    descEl.textContent  = t[descKey]  || descKey;

    const rect = btn.getBoundingClientRect();
    tip.style.transform = '';
    tip.classList.add('visible');
    // Calculer les dimensions réelles du tooltip avant positionnement final
    const tipH = tip.offsetHeight || 60;
    const tipW = tip.offsetWidth  || 240;
    let rawTop = rect.top + rect.height / 2 - tipH / 2;
    // Clamp vertical : reste dans la fenêtre avec 8px de marge
    const maxTop = window.innerHeight - tipH - 8;
    const top = Math.max(8, Math.min(rawTop, maxTop));
    // Clamp horizontal : si dépasse à droite, afficher à gauche de la sidebar
    let left = rect.right + 12;
    if (left + tipW > window.innerWidth - 8) left = rect.left - tipW - 12;
    tip.style.top  = top  + 'px';
    tip.style.left = left + 'px';
    tip.classList.add('visible');
  }

  function hideTip() {
    hideTimer = setTimeout(() => tip.classList.remove('visible'), 80);
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-rail-btn[data-nrt]').forEach(btn => {
      btn.addEventListener('mouseenter', () => showTip(btn));
      btn.addEventListener('mouseleave', hideTip);
      btn.addEventListener('click', hideTip);
    });
  });

  // ── TOOLTIP FIXE POUR LES ONGLETS .wt-tab ─────────────────────────────
  (function() {
    let _wtTip = null;
    let _wtTimer = null;

    function _getWtTip() {
      if (!_wtTip) {
        _wtTip = document.createElement('div');
        _wtTip.id = 'wt-tab-tooltip';
        document.body.appendChild(_wtTip);
      }
      return _wtTip;
    }

    function _showWtTip(btn) {
      const label = btn.getAttribute('title') || btn.getAttribute('data-title');
      if (!label) return;
      const t = _getWtTip();
      t.textContent = label;
      t.classList.add('visible');
      const rect = btn.getBoundingClientRect();
      const tipW = t.offsetWidth  || 120;
      const tipH = t.offsetHeight || 22;
      // Centré sous l'onglet, clampé horizontalement
      let left = rect.left + rect.width / 2 - tipW / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
      // Afficher sous l'onglet ; si pas de place en bas, afficher au-dessus
      let top = rect.bottom + 6;
      if (top + tipH > window.innerHeight - 8) top = rect.top - tipH - 6;
      t.style.left = left + 'px';
      t.style.top  = top  + 'px';
    }

    function _hideWtTip() {
      if (_wtTip) _wtTip.classList.remove('visible');
    }

    function _initWtTabTooltips() {
      document.querySelectorAll('.wt-tab[title]').forEach(btn => {
        if (btn._wtTipBound) return;
        btn._wtTipBound = true;
        // Stocker le title dans data-title et le retirer pour désactiver le tooltip natif
        btn.setAttribute('data-title', btn.getAttribute('title'));
        btn.removeAttribute('title');
        btn.addEventListener('mouseenter', () => { clearTimeout(_wtTimer); _wtTimer = setTimeout(() => _showWtTip(btn), 100); });
        btn.addEventListener('mouseleave', () => { clearTimeout(_wtTimer); _hideWtTip(); });
        btn.addEventListener('click',      () => { clearTimeout(_wtTimer); _hideWtTip(); });
      });
    }

    document.addEventListener('DOMContentLoaded', _initWtTabTooltips);
    window._initWtTabTooltips = _initWtTabTooltips;
  })();

  // Aussi disponible après rechargement dynamique
  window._initNavRailTooltips = function() {
    document.querySelectorAll('.nav-rail-btn[data-nrt]').forEach(btn => {
      if (btn._nrtBound) return;
      btn._nrtBound = true;
      btn.addEventListener('mouseenter', () => showTip(btn));
      btn.addEventListener('mouseleave', hideTip);
      btn.addEventListener('click', hideTip);
    });
  };
  document.addEventListener('DOMContentLoaded', window._initNavRailTooltips);
  setTimeout(window._initNavRailTooltips, 500);
})();

// ════════════════════════════════════════════════════════════════════════
// ██  NOUVELLES FONCTIONNALITÉS — bloc autonome
// ════════════════════════════════════════════════════════════════════════

// ── Helper i18n court ─────────────────────────────────────────────────
function _nt(key, fallback) {
  const lang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
  return (typeof _i18n !== 'undefined' && _i18n[lang] && _i18n[lang][key]) ? _i18n[lang][key] : (fallback || key);
}

// ══════════════════════════════════════════════════════════════════════
// 1. POMODORO
// ══════════════════════════════════════════════════════════════════════
const POMO = {
  WORK: 25 * 60, SHORT: 5 * 60, LONG: 15 * 60,
  state: 'idle',  // idle | work | break
  remaining: 25 * 60,
  session: 0, totalSessions: 4,
  _timer: null,
  _audio: null,
};

function _pomoBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 150, 300].forEach(delay => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 660; o.type = 'sine';
      g.gain.setValueAtTime(0.35, ctx.currentTime + delay / 1000);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.8);
      o.start(ctx.currentTime + delay / 1000);
      o.stop(ctx.currentTime + delay / 1000 + 0.8);
    });
  } catch(e) {}
}

function _pomoFmt(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function _pomoRefreshUI() {
  const btn = document.getElementById('pomodoro-btn');
  const disp = document.getElementById('pomodoro-display');
  const big = document.getElementById('pomodoro-big-timer');
  const phase = document.getElementById('pomodoro-phase-label');
  if (disp) disp.textContent = _pomoFmt(POMO.remaining);
  if (big)  { big.textContent = _pomoFmt(POMO.remaining); big.classList.toggle('break-color', POMO.state === 'break'); }
  if (btn)  { btn.className = 'pomodoro-btn'; if (POMO.state === 'work') btn.classList.add('running'); if (POMO.state === 'break') btn.classList.add('break'); }
  if (phase) {
    if (POMO.state === 'work')  phase.textContent = _nt('pomo_work_phase',  'Travail — session ' + (POMO.session + 1) + '/' + POMO.totalSessions);
    if (POMO.state === 'break') phase.textContent = POMO.session % POMO.totalSessions === 0 ? _nt('pomo_long_break', 'Grande pause ☕') : _nt('pomo_short_break', 'Petite pause 🌿');
    if (POMO.state === 'idle')  phase.textContent = _nt('pomo_idle_phase', 'Prêt à démarrer');
  }
  // Pastilles session
  const dots = document.querySelectorAll('.pomo-dot');
  dots.forEach((d, i) => d.classList.toggle('done', i < POMO.session % POMO.totalSessions));
}

function _pomoTick() {
  POMO.remaining--;
  _pomoRefreshUI();
  if (POMO.remaining <= 0) {
    _pomoBell();
    clearInterval(POMO._timer); POMO._timer = null;
    if (POMO.state === 'work') {
      POMO.session++;
      const isLong = POMO.session % POMO.totalSessions === 0;
      POMO.state = 'break';
      POMO.remaining = isLong ? POMO.LONG : POMO.SHORT;
      showToast(_nt('pomo_toast_break', '🌿 Pause ! Reposez vos yeux.'), 4000, 'ok');
    } else {
      POMO.state = 'work'; POMO.remaining = POMO.WORK;
      showToast(_nt('pomo_toast_work', '🍅 C\'est reparti ! Bonne écriture.'), 3000, 'ok');
    }
    _pomoRefreshUI();
    POMO._timer = setInterval(_pomoTick, 1000);
  }
}

function pomoStart() {
  if (POMO._timer) return;
  if (POMO.state === 'idle') { POMO.state = 'work'; POMO.remaining = POMO.WORK; }
  POMO._timer = setInterval(_pomoTick, 1000);
  _pomoRefreshUI();
}
function pomoPause() { clearInterval(POMO._timer); POMO._timer = null; _pomoRefreshUI(); }
function pomoReset() {
  clearInterval(POMO._timer); POMO._timer = null;
  POMO.state = 'idle'; POMO.remaining = POMO.WORK; POMO.session = 0;
  _pomoRefreshUI();
}
function openPomodoroModal() {
  document.getElementById('pomodoro-modal-overlay').classList.add('open');
  _pomoRefreshUI();
}
function closePomodoroModal() { document.getElementById('pomodoro-modal-overlay').classList.remove('open'); }

// Injecter le modal Pomodoro dans le DOM
document.addEventListener('DOMContentLoaded', function() {
  const overlay = document.createElement('div');
  overlay.id = 'pomodoro-modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) closePomodoroModal(); };
  overlay.innerHTML = `
    <div id="pomodoro-modal" role="dialog" aria-modal="true" aria-label="Minuterie Pomodoro">
      <h3 data-i18n="pomo_title">🍅 Pomodoro</h3>
      <div id="pomodoro-big-timer">25:00</div>
      <div id="pomodoro-phase-label"></div>
      <div class="pomo-controls">
        <button class="pomo-btn primary" onclick="pomoStart()" data-i18n="pomo_btn_start">▶ Démarrer</button>
        <button class="pomo-btn" onclick="pomoPause()" data-i18n="pomo_btn_pause">⏸ Pause</button>
        <button class="pomo-btn" onclick="pomoReset()" data-i18n="pomo_btn_reset">↺ Réinitialiser</button>
      </div>
      <div class="pomo-sessions-row">
        <span data-i18n="pomo_sessions">Sessions :</span>
        ${[0,1,2,3].map(() => '<span class="pomo-dot"></span>').join('')}
        <button class="pomo-btn" onclick="closePomodoroModal()" style="margin-left:auto;padding:3px 10px;font-size:11px;" data-i18n="pomo_btn_close">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  _pomoRefreshUI();
});

// ══════════════════════════════════════════════════════════════════════
// 2. FIL D'ARIANE + HISTORIQUE DE NAVIGATION
// ══════════════════════════════════════════════════════════════════════
const _navHistory = { stack: [], pos: -1, maxSize: 50 };

function _navPush(chapterText, scrollTop) {
  // Tronquer le futur si on navigue depuis un point non-final
  _navHistory.stack = _navHistory.stack.slice(0, _navHistory.pos + 1);
  _navHistory.stack.push({ chapterText, scrollTop });
  if (_navHistory.stack.length > _navHistory.maxSize) _navHistory.stack.shift();
  _navHistory.pos = _navHistory.stack.length - 1;
  _updateNavBtns();
}

function _updateNavBtns() {
  const back = document.getElementById('nav-back-btn');
  const fwd  = document.getElementById('nav-fwd-btn');
  if (back) back.disabled = _navHistory.pos <= 0;
  if (fwd)  fwd.disabled  = _navHistory.pos >= _navHistory.stack.length - 1;
}

function navHistoryGo(dir) {
  const next = _navHistory.pos + dir;
  if (next < 0 || next >= _navHistory.stack.length) return;
  _navHistory.pos = next;
  const entry = _navHistory.stack[next];
  const ta = document.getElementById('raw-input');
  if (ta && entry.scrollTop !== undefined) {
    ta.scrollTop = entry.scrollTop;
    if (entry.chapterText) {
      const el = document.getElementById('raw-input');
      if (el) { const idx = el.value.indexOf(entry.chapterText.slice(0, 30)); if (idx >= 0) el.setSelectionRange(idx, idx); }
    }
  }
  _updateNavBtns();
  _updateBreadcrumb();
}

function _updateBreadcrumb() {
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  const scrollTop = ta.scrollTop;
  const lineH = parseInt(getComputedStyle(ta).lineHeight) || 20;
  const approxLine = Math.floor(scrollTop / lineH);
  const lines = ta.value.split('\n');
  let currentChapter = null;
  let linesCount = 0;
  let chapterWordCount = 0;
  let inChapter = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const lvl = (typeof detectHeadingLevel === 'function') ? detectHeadingLevel(l) : 0;
    if (lvl === 1) {
      if (inChapter && i > approxLine) break;
      currentChapter = l; inChapter = true; chapterWordCount = 0;
    } else if (inChapter) {
      chapterWordCount += l.split(/\s+/).filter(w => w).length;
    }
    if (i <= approxLine) linesCount = i;
  }

  const bc = document.getElementById('bc-chapter');
  const bcPages = document.getElementById('bc-pages');
  if (bc) {
    if (currentChapter) {
      bc.textContent = currentChapter.length > 35 ? currentChapter.slice(0, 35) + '…' : currentChapter;
      bc.title = currentChapter;
    } else {
      bc.textContent = _nt('bc_no_chapter', '—');
      bc.title = '';
    }
  }
  if (bcPages && currentChapter) {
    const pages = Math.max(1, Math.ceil(chapterWordCount / 250));
    bcPages.textContent = '~' + pages + ' p.';
  } else if (bcPages) { bcPages.textContent = ''; }
}

// Hook le scroll de l'éditeur pour mettre à jour le breadcrumb
document.addEventListener('DOMContentLoaded', function() {
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  let _bcTimer = null;
  ta.addEventListener('scroll', function() {
    clearTimeout(_bcTimer);
    _bcTimer = setTimeout(_updateBreadcrumb, 120);
  });
  // Hook scrollToChapter pour mémoriser la position
  const _origScrollToChapter = window.scrollToChapter;
  if (typeof _origScrollToChapter === 'function') {
    window.scrollToChapter = function(id, chText) {
      const ta2 = document.getElementById('raw-input');
      _origScrollToChapter(id, chText);
      setTimeout(() => {
        if (ta2) _navPush(chText, ta2.scrollTop);
        _updateBreadcrumb();
      }, 200);
    };
  }
  setTimeout(_updateBreadcrumb, 800);
});

// ══════════════════════════════════════════════════════════════════════
// 3. TIMELINE CHAPITRES
// ══════════════════════════════════════════════════════════════════════
function _renderTimeline(chapters) {
  const inner = document.getElementById('chapter-timeline-inner');
  if (!inner) return;
  if (!chapters || !chapters.length) {
    inner.innerHTML = '<span style="font-size:10px;color:var(--ink-muted);" data-i18n="tl_empty">Aucun chapitre</span>';
    return;
  }
  inner.innerHTML = chapters.filter(ch => ch.level === 1).map(ch => {
    const meta = (typeof chGetMeta === 'function') ? chGetMeta(ch.text) : { status: 'draft' };
    const st = meta.status || 'draft';
    const short = ch.text.length > 14 ? ch.text.slice(0, 14) + '…' : ch.text;
    const dataKey = (typeof escHtml === 'function') ? escHtml(JSON.stringify(ch.text)) : JSON.stringify(ch.text);
    return `<span class="tl-chip st-${st}" title="${escHtml(ch.text)}"
      data-ch-id="${ch.id}" data-ch-key="${dataKey}"
      onclick="scrollToChapter(this.dataset.chId, JSON.parse(this.dataset.chKey));_highlightTimelineChip(this)">
      <span class="tl-dot"></span>${escHtml(short)}
    </span>`;
  }).join('');
}

function _highlightTimelineChip(el) {
  document.querySelectorAll('.tl-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
}

// Hook updateChapterList pour stocker les chapitres et re-rendre le corkboard si visible
(function() {
  const _orig = window.updateChapterList;
  if (typeof _orig === 'function') {
    window.updateChapterList = function(chapters) {
      _orig(chapters);
      // En mode isolé : NE PAS écraser _corkChapters — le textarea ne contient qu'un seul
      // chapitre. La vue carte lit IM.chapters directement dans corkboardRender().
      if (typeof IM !== 'undefined' && IM.active) {
        const cork = document.getElementById('sb-pane-corkboard');
        if (cork && cork.style.display !== 'none') {
          typeof corkboardRender === 'function' && corkboardRender();
        }
        return;
      }
      // Mode continu : stocker normalement dans _corkChapters
      _corkChapters = chapters || [];
      const cork = document.getElementById('sb-pane-corkboard');
      if (cork && cork.style.display !== 'none') {
        typeof corkboardRender === 'function' && corkboardRender();
      }
    };
  }
  document.addEventListener('atelier:ready', () => setTimeout(() => {
    if (typeof window.updateChapterList === 'function') window.updateChapterList([]);
  }, 300));
})();

// ══════════════════════════════════════════════════════════════════════
// 4. RÉSUMÉ IA PAR CHAPITRE
// ══════════════════════════════════════════════════════════════════════
function _injectSummaryBtns(chapters) {
  if (!chapters || !chapters.length) return;
  setTimeout(() => {
    document.querySelectorAll('.chapter-item').forEach((item) => {
      if (item.querySelector('.ch-summary-btn')) return;
      const controls = item.querySelector('.ch-controls');
      if (!controls) return;
      const chKey = item.dataset.chKey;
      const btn = document.createElement('button');
      btn.className = 'ch-summary-btn';
      btn.title = _nt('title_ch_summary', 'Résumé IA du chapitre');
      btn.textContent = '✦';
      btn.onclick = function(e) {
        e.stopPropagation();
        const chText = chKey ? JSON.parse(chKey) : '';
        openSummaryPopup(btn, chText);
      };
      controls.insertBefore(btn, controls.firstChild);
    });
  }, 60);
}

async function openSummaryPopup(triggerEl, chapterTitle) {
  let popup = document.getElementById('chapter-summary-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'chapter-summary-popup';
    popup.setAttribute('role', 'dialog');
    popup.innerHTML = `<button class="cs-close" onclick="closeSummaryPopup()">✕</button><div class="cs-title" id="cs-popup-title"></div><div id="cs-popup-body"></div>`;
    document.body.appendChild(popup);
  }
  const titleEl = document.getElementById('cs-popup-title');
  const bodyEl  = document.getElementById('cs-popup-body');

  titleEl.textContent = chapterTitle;
  bodyEl.textContent  = _nt('ch_summary_loading', 'Génération du résumé…');
  popup.style.display = 'block';
  _summaryJustOpened  = true;

  // Positionnement — recalculé après rendu pour avoir la vraie hauteur
  const _reposition = () => {
    const rect   = triggerEl.getBoundingClientRect();
    const pH     = Math.min(popup.scrollHeight, window.innerHeight - 48);
    const pW     = popup.offsetWidth || 480;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    let top = (spaceBelow >= pH || spaceBelow >= spaceAbove)
      ? rect.bottom + margin
      : rect.top - pH - margin;
    top = Math.max(8, Math.min(top, window.innerHeight - pH - 8));
    const left = Math.max(8, Math.min(rect.right - pW, window.innerWidth - pW - 8));
    popup.style.top  = top  + 'px';
    popup.style.left = left + 'px';
  };
  _reposition();
  // Repositionner une fois le contenu chargé (hauteur finale connue)
  requestAnimationFrame(_reposition);

  // ── 1. Extraire le texte COMPLET du chapitre ──────────────────────
  const ta = document.getElementById('raw-input');
  if (!ta) { bodyEl.textContent = _nt('ch_summary_no_text', 'Texte introuvable.'); return; }
  const allLines = ta.value.split('\n');
  let start = -1, end = -1;
  for (let i = 0; i < allLines.length; i++) {
    const t = allLines[i].trim();
    if (detectHeadingLevel(t) === 1 && t === chapterTitle) { start = i; continue; }
    if (start >= 0 && end < 0 && detectHeadingLevel(t) === 1) { end = i; break; }
  }
  if (start < 0) { bodyEl.textContent = _nt('ch_summary_no_text', 'Chapitre introuvable dans le texte.'); return; }
  if (end < 0) end = allLines.length;
  const fullText = allLines.slice(start, end).join('\n').replace(/\[NOTE:[^\]]*\]/g, '').trim();

  // ── 2. Lire la config IA (même logique que callAI) ─────────────────
  const _lsConfig  = (function(){ try { return JSON.parse(localStorage.getItem('ia_config') || '{}'); } catch(e){ return {}; } })();
  const activeProv = (_lsConfig.provider && AI_PROVIDERS?.[_lsConfig.provider]) ? _lsConfig.provider : (_wtProvider || 'claude');
  const provCfg    = _getProviderConfig(activeProv);
  const activeKey  = (provCfg.key || _wtApiKey || '').trim();
  const model      = provCfg.model || _wtModel || AI_PROVIDERS[activeProv]?.models[0]?.value;

  if (!activeKey) {
    const names = { claude:'Anthropic', openai:'OpenAI', gemini:'Google Gemini', groq:'Groq', openrouter:'OpenRouter' };
    bodyEl.textContent = `Clé API manquante pour ${names[activeProv] || activeProv}. Ouvrez ⚙ Paramètres → Config IA.`;
    return;
  }

  // ── 3. Découper si nécessaire (blocs ≤ 3500 mots) ─────────────────
  // On découpe sur les mots pour être sûr de ne jamais dépasser le contexte,
  // quel que soit le provider (Groq/Llama a parfois des limites basses).
  const MOTS_MAX = 3000;
  const mots = fullText.split(/\s+/);
  const blocs = [];
  for (let i = 0; i < mots.length; i += MOTS_MAX) {
    blocs.push(mots.slice(i, i + MOTS_MAX).join(' '));
  }

  // ── 4. Fonction d'appel direct (sans passer par callAI) ───────────
  async function _fetchSummary(systemTxt, userTxt) {
    let url, headers, bodyObj;
    if (activeProv === 'claude') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = { 'Content-Type':'application/json', 'x-api-key':activeKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-client-side-api-key-allowed':'true' };
      bodyObj = { model, max_tokens:600, system:systemTxt, messages:[{ role:'user', content:userTxt }] };
    } else if (activeProv === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;
      headers = { 'Content-Type':'application/json' };
      bodyObj = { system_instruction:{ parts:[{ text:systemTxt }] }, contents:[{ role:'user', parts:[{ text:userTxt }] }], generationConfig:{ maxOutputTokens:600 } };
    } else {
      // OpenAI-compat : openai, groq, openrouter
      const endpointMap = { openai:'https://api.openai.com/v1/chat/completions', groq:'https://api.groq.com/openai/v1/chat/completions', openrouter:'https://openrouter.ai/api/v1/chat/completions' };
      url = endpointMap[activeProv];
      headers = { 'Content-Type':'application/json', 'Authorization':'Bearer '+activeKey };
      bodyObj = { model, max_tokens:600, messages:[{ role:'system', content:systemTxt }, { role:'user', content:userTxt }] };
    }
    const res  = await fetch(url, { method:'POST', headers, body:JSON.stringify(bodyObj) });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || 'Erreur ' + res.status); }
    const data = await res.json();
    if (activeProv === 'claude')  return data.content?.[0]?.text || '';
    if (activeProv === 'gemini')  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return data.choices?.[0]?.message?.content || '';
  }

  // ── Prompts depuis le panneau de configuration (éditables par l'utilisateur) ──
  const SYS_COURT   = resolvePrompt('ch_summary_court');
  const SYS_PASSAGE = resolvePrompt('ch_summary_passage');
  const SYS_FINAL   = resolvePrompt('ch_summary_final');

  try {
    let finalSummary;
    if (blocs.length === 1) {
      finalSummary = await _fetchSummary(
        SYS_COURT,
        `Voici le texte intégral du chapitre "${chapterTitle}". Résume-le en couvrant toutes les scènes du début à la fin :\n\n${blocs[0]}`
      );
    } else {
      // Chapitre long : résumé passage par passage, puis synthèse
      const partials = [];
      for (let i = 0; i < blocs.length; i++) {
        bodyEl.textContent = `Analyse du passage ${i+1}/${blocs.length}…`;
        const r = await _fetchSummary(SYS_PASSAGE, `Passage ${i+1}/${blocs.length} du chapitre "${chapterTitle}" :\n\n${blocs[i]}`);
        if (r) partials.push(r.trim());
      }
      bodyEl.textContent = 'Synthèse en cours…';
      finalSummary = await _fetchSummary(
        SYS_FINAL,
        `Résumés successifs du chapitre "${chapterTitle}" :\n\n${partials.map((p,i)=>`Passage ${i+1} : ${p}`).join('\n\n')}`
      );
    }
    bodyEl.textContent = finalSummary || _nt('ch_summary_empty', 'Résumé vide.');
    _reposition();
  } catch(err) {
    bodyEl.textContent = 'Erreur : ' + err.message;
  }
}

function closeSummaryPopup() {
  const p = document.getElementById('chapter-summary-popup');
  if (p) p.style.display = 'none';
}
let _summaryJustOpened = false;
document.addEventListener('click', function(e) {
  if (_summaryJustOpened) { _summaryJustOpened = false; return; }
  const p = document.getElementById('chapter-summary-popup');
  if (!p || p.style.display === 'none') return;
  if (p.contains(e.target)) return;
  closeSummaryPopup();
});

// ══════════════════════════════════════════════════════════════════════
// 5. GUILLEMETS TYPOGRAPHIQUES AUTOMATIQUES
// ══════════════════════════════════════════════════════════════════════
let _smartQuotesEnabled = true;

function toggleSmartQuotes() {
  _smartQuotesEnabled = !_smartQuotesEnabled;
  const ind = document.getElementById('smartquotes-indicator');
  if (ind) {
    ind.style.opacity = _smartQuotesEnabled ? '1' : '0.4';
    ind.title = _nt(_smartQuotesEnabled ? 'title_smartquotes' : 'title_smartquotes_off',
      _smartQuotesEnabled ? 'Guillemets typographiques actifs — cliquer pour désactiver' : 'Guillemets typographiques inactifs — cliquer pour activer');
  }
  showToast(_nt(_smartQuotesEnabled ? 'toast_sq_on' : 'toast_sq_off',
    _smartQuotesEnabled ? '« » Guillemets typographiques activés' : '\" \" Guillemets droits (mode désactivé)'), 1800, 'ok');
}

function _applySmartQuotes(ta) {
  if (!_smartQuotesEnabled) return;
  const pos = ta.selectionStart;
  const text = ta.value;
  const before = text.slice(0, pos);
  const after = text.slice(pos);
  const lastChar = before.slice(-1);

  // " → « si au début, » si avant ponctuation ou fin de ligne
  if (lastChar === '"') {
    const prevNonSpace = before.slice(0, -1).trimEnd().slice(-1);
    const isOpening = !prevNonSpace || /[\s\n(—–]/.test(prevNonSpace);
    const replacement = isOpening ? '«\u202f' : '\u202f»';
    ta.value = before.slice(0, -1) + replacement + after;
    ta.setSelectionRange(pos, pos);
    return true;
  }
  return false;
}

document.addEventListener('DOMContentLoaded', function() {
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  ta.addEventListener('keyup', function(e) {
    if (e.key === '"') {
      if (_applySmartQuotes(ta)) onRawInput && onRawInput();
    }
  });
  // Initialiser le tooltip de l'indicateur
  const ind = document.getElementById('smartquotes-indicator');
  if (ind) ind.title = _nt('title_smartquotes', 'Guillemets typographiques automatiques — cliquer pour activer/désactiver');
});

// ══════════════════════════════════════════════════════════════════════
// 6. DÉTECTION DE RÉPÉTITIONS
// ══════════════════════════════════════════════════════════════════════
let _repPanelOpen = false;

function toggleRepPanel() {
  _repPanelOpen = !_repPanelOpen;
  const panel = document.getElementById('rep-panel');
  if (!panel) return;
  if (_repPanelOpen) { _analyzeRepetitions(); panel.classList.add('open'); }
  else panel.classList.remove('open');
}

function _analyzeRepetitions() {
  const ta = document.getElementById('raw-input');
  const list = document.getElementById('rep-list');
  if (!ta || !list) return;

  const STOP = new Set(['le','la','les','un','une','des','et','en','de','du','au','aux','que','qui','se','si','ne','il','elle','ils','elles','on','je','tu','nous','vous','ce','cet','cette','ces','son','sa','ses','mon','ma','mes','ton','ta','tes','notre','votre','leur','leurs','par','sur','sous','dans','avec','pour','mais','ou','donc','or','ni','car','est','sont','être','avoir','fait','plus','pas','très','bien','tout','tous','même','comme','aussi','ainsi','puis','alors','après','avant','entre','vers','dont','où','quand','comment','pourquoi']);

  const text = ta.value.toLowerCase();
  const words = text.match(/\b[a-zàâäéèêëîïôùûüœç]{4,}\b/g) || [];
  const windowSize = 200;

  // BUG #11 FIX : algorithme O(n) sliding-window Map au lieu de la double boucle O(n²)
  // qui gelait l'UI sur les longs textes. On enveloppe dans requestIdleCallback
  // pour rendre le calcul non-bloquant.
  const runAnalysis = () => {
    const winCounts = new Map();
    let left = 0;
    const counts = {};

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (!STOP.has(w)) {
        winCounts.set(w, (winCounts.get(w) || 0) + 1);
      }
      while (i - left >= windowSize) {
        const lw = words[left];
        if (!STOP.has(lw)) {
          const c = winCounts.get(lw) - 1;
          if (c <= 0) winCounts.delete(lw); else winCounts.set(lw, c);
        }
        left++;
      }
      if (!STOP.has(w) && (winCounts.get(w) || 0) >= 3) {
        counts[w] = (counts[w] || 0) + 1;
      }
    }

    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);

    if (!top.length) {
      list.innerHTML = '<div style="color:var(--ink-muted);font-size:11px;text-align:center;padding:8px 0;">' + _nt('rep_none', 'Aucune répétition détectée 🎉') + '</div>';
      return;
    }

    list.innerHTML = top.map(([w, c]) =>
      `<div class="rep-item">
        <span class="rep-word">${w}</span>
        <span class="rep-count">${c}× <span style="font-size:9px;">${_nt('rep_near', 'proche')}</span></span>
        <button onclick="esJumpToWord('${w}')" style="font-size:9px;padding:1px 5px;border:1px solid var(--cream);border-radius:3px;background:transparent;cursor:pointer;color:var(--accent);font-family:'DM Sans',sans-serif;" title="${_nt('rep_find', 'Trouver dans le texte')}">→</button>
      </div>`
    ).join('');
  }; // fin runAnalysis

  // Lancer en arrière-plan pour ne pas bloquer l'UI
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(runAnalysis, { timeout: 2000 });
  } else {
    setTimeout(runAnalysis, 0);
  }
}

function esJumpToWord(word) {
  const inp = document.getElementById('es-input');
  if (inp) { inp.value = word; if (typeof esSearch === 'function') esSearch(); }
  toggleRepPanel(); // ferme le panel
}

// ══════════════════════════════════════════════════════════════════════
// 7. RESIZE DE LA SIDEBAR
// ══════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  const handle = document.getElementById('sidebar-resize-handle');
  const aside = document.querySelector('aside');
  if (!handle || !aside) return;

  // BUG #5 FIX : restaurer la largeur sauvegardée
  try {
    const savedW = parseInt(localStorage.getItem('atelier_sidebar_w'));
    if (savedW && savedW >= 220 && savedW <= 560) {
      aside.style.width = savedW + 'px';
      document.documentElement.style.setProperty('--sidebar-w', savedW + 'px');
    }
  } catch(e) {}

  let dragging = false, startX = 0, startW = 0;

  handle.addEventListener('mousedown', function(e) {
    dragging = true; startX = e.clientX; startW = aside.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  });

  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const newW = Math.max(220, Math.min(560, startW + delta));
    aside.style.width = newW + 'px';
    document.documentElement.style.setProperty('--sidebar-w', newW + 'px');
  });

  document.addEventListener('mouseup', function() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    // BUG #5 FIX : sauvegarder la largeur pour la restaurer au prochain chargement
    try { localStorage.setItem('atelier_sidebar_w', aside.offsetWidth); } catch(e) {}
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. POSITION DU PANNEAU RÉPÉTITIONS (relatif au bouton)
// ══════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  const repBtn = document.getElementById('btn-rep-detect');
  const panel = document.getElementById('rep-panel');
  if (!repBtn || !panel) return;
  repBtn.addEventListener('click', function() {
    if (panel.classList.contains('open')) {
      const rect = repBtn.getBoundingClientRect();
      panel.style.top = (rect.bottom + 6) + 'px';
      panel.style.left = Math.max(8, rect.right - 248) + 'px';
    }
  });
  // Fermer en cliquant ailleurs
  document.addEventListener('click', function(e) {
    if (!panel.contains(e.target) && e.target !== repBtn) {
      panel.classList.remove('open');
      _repPanelOpen = false;
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// NEW FEATURES v52
// ══════════════════════════════════════════════════════════════════════

// ── CSS INLINE pour nouvelles fonctionnalités ─────────────────────────
(function() {
  const style = document.createElement('style');
  style.textContent = `
    /* Tags chapitres */
    .ch-tags-row { display:flex;flex-wrap:wrap;gap:2px;margin-left:2px;flex:1;min-width:0; }
    .ch-tag-chip { font-size:9px;padding:1px 5px;border-radius:10px;background:rgba(124,92,58,0.13);color:var(--accent);border:1px solid rgba(124,92,58,0.25);white-space:nowrap;font-family:'DM Sans',sans-serif; }
    .ch-tag-btn  { font-size:11px;border:none;background:transparent;cursor:pointer;padding:1px 2px;border-radius:3px;opacity:0;transition:opacity .15s;color:var(--ink-muted); }
    .chapter-item:hover .ch-tag-btn { opacity:1; }

    /* Modal tags */
    #ch-tags-modal { position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.45); }
    #ch-tags-modal.open { display:flex; }
    .ch-tags-box { background:var(--parchment);border-radius:10px;padding:20px 24px;min-width:280px;max-width:380px;box-shadow:0 12px 40px rgba(0,0,0,0.35); }
    .ch-tags-box h3 { font-family:'Playfair Display',serif;font-size:14px;margin-bottom:10px;color:var(--ink); }
    .ch-tags-input { width:100%;font-family:'DM Sans',sans-serif;font-size:12px;border:1px solid var(--cream);border-radius:5px;padding:6px 10px;background:var(--paper);color:var(--ink);outline:none; }
    .ch-tags-hint { font-size:10.5px;color:var(--ink-muted);margin-top:5px;font-style:italic; }
    .ch-tags-preview { display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;min-height:24px; }
    .ch-tags-btns { display:flex;justify-content:flex-end;gap:8px;margin-top:14px; }

    /* Versions snapshots */
    .version-card { background:var(--paper);border:1px solid var(--cream);border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:3px; }
    .version-card-top { display:flex;align-items:center;justify-content:space-between; }
    .version-name { font-size:12px;font-weight:500;color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    .version-date { font-size:10px;color:var(--ink-muted); }
    .version-words { font-size:10px;color:var(--accent); }
    .version-actions { display:flex;gap:4px;flex-shrink:0; }
    .version-btn { font-size:11px;padding:2px 8px;border:1px solid var(--cream);border-radius:3px;background:transparent;cursor:pointer;color:var(--ink-soft);font-family:'DM Sans',sans-serif;transition:all .1s; }
    .version-btn:hover { background:var(--cream); }
    .version-btn.danger:hover { background:var(--danger-bg);color:var(--danger);border-color:var(--danger-border); }

    /* Corkboard cards — vue unifiée structure+carte */
    .cork-card { background:var(--parchment);border:1px solid var(--cream);border-radius:10px;padding:10px 12px 9px;box-shadow:0 1px 4px rgba(0,0,0,0.05);cursor:pointer;transition:border-color .12s,box-shadow .12s;position:relative; }
    .cork-card:hover { border-color:var(--accent-light);box-shadow:0 2px 10px rgba(124,92,58,0.13); }
    .cork-card.cork-locked { opacity:0.72; }
    .cork-card-title { font-family:'Playfair Display',serif;font-size:12.5px;font-weight:600;color:var(--ink);margin-bottom:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }

    /* Ligne contrôles */
    .cork-card-controls { display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:nowrap;position:relative; }

    /* Capsule statut */
    .cork-status-pill { display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 6px;border-radius:12px;border:1.5px solid;font-size:10.5px;font-weight:500;cursor:pointer;user-select:none;transition:opacity .1s;white-space:nowrap;flex-shrink:0;background:var(--paper); }
    .cork-status-pill:hover { opacity:.8; }
    .cork-pill-dot { width:7px;height:7px;border-radius:50%;flex-shrink:0; }
    .cork-pill-label { font-size:10px; }
    .cork-pill-arrow { font-size:8px;margin-left:1px;opacity:.6; }

    /* Dropdown statut */
    .cork-status-dropdown { display:none;position:absolute;top:100%;left:0;z-index:400;background:var(--parchment);border:1px solid var(--cream);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.14);padding:4px;min-width:120px;margin-top:3px;flex-direction:column;gap:2px; }
    .cork-status-dropdown.open { display:flex; }
    .cork-status-opt { display:flex;align-items:center;gap:6px;padding:5px 9px;border-radius:5px;border:none;background:transparent;cursor:pointer;font-size:11px;color:var(--ink-soft);font-family:'DM Sans',sans-serif;text-align:left;transition:background .1s;width:100%; }
    .cork-status-opt:hover { background:var(--cream); }
    .cork-status-opt.active { background:var(--paper);color:var(--ink);font-weight:500; }
    .cork-opt-dot { width:7px;height:7px;border-radius:50%;flex-shrink:0; }

    /* Mots */
    .cork-words { font-size:10px;color:var(--ink-muted);margin-left:auto;white-space:nowrap;flex-shrink:0; }

    /* Boutons action */
    .cork-actions { display:flex;align-items:center;gap:3px;flex-shrink:0; }
    .cork-action-btn { background:none;border:1px solid transparent;border-radius:5px;width:24px;height:24px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;color:var(--ink-muted);transition:all .1s;padding:0;flex-shrink:0; }
    .cork-action-btn:hover { background:var(--cream);border-color:var(--cream);color:var(--ink); }
    .cork-action-btn.locked { color:var(--accent); }

    /* Résumé / preview */
    .cork-card-summary { font-size:11px;color:var(--ink-soft);font-style:italic;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-top:4px; }
    .cork-card-summary.ai { color:var(--accent);font-style:normal; }
    .cork-card-tags { display:flex;flex-wrap:wrap;gap:3px;margin-top:5px; }
    .cork-empty { text-align:center;color:var(--ink-muted);font-size:12px;padding:2rem 1rem;font-style:italic; }

    /* AI Continue inline */
    #ai-continue-popup { position:fixed;z-index:8500;background:var(--parchment);border:1px solid var(--cream);border-radius:10px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,0.2);min-width:280px;max-width:420px;display:none; }
    #ai-continue-popup.open { display:block; }
    .aicont-title { font-family:'Playfair Display',serif;font-size:13px;color:var(--ink);margin-bottom:8px;font-weight:600; }
    .aicont-result { font-size:12.5px;color:var(--ink);font-family:'Source Serif 4',serif;line-height:1.7;max-height:200px;overflow-y:auto;padding:8px;background:var(--paper);border-radius:6px;border:1px solid var(--cream);margin-bottom:8px;white-space:pre-wrap; }
    .aicont-btns { display:flex;gap:6px;justify-content:flex-end; }
    .aicont-btn { font-size:11px;padding:4px 12px;border-radius:4px;cursor:pointer;font-family:'DM Sans',sans-serif;border:1px solid var(--cream);background:transparent;color:var(--ink-soft);transition:all .1s; }
    .aicont-btn:hover { background:var(--cream); }
    .aicont-btn.primary { background:var(--accent);color:#fff;border-color:var(--accent); }
    .aicont-btn.primary:hover { background:var(--accent-hover); }

    /* Cohérence narrative */
    .coherence-issue { background:var(--paper);border:1px solid var(--cream);border-radius:6px;padding:8px 10px;margin-bottom:7px; }
    .coherence-issue.warn { border-left:3px solid var(--gold); }
    .coherence-issue.error { border-left:3px solid var(--danger); }
    .coherence-type { font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted);margin-bottom:3px; }
    .coherence-msg { font-size:11.5px;color:var(--ink);line-height:1.5; }
    .coherence-quote { font-size:10.5px;color:var(--ink-muted);font-style:italic;margin-top:3px;padding-left:7px;border-left:2px solid var(--cream);display:flex;align-items:baseline;gap:5px; }
    .coherence-cite-btn { flex-shrink:0;background:none;border:1px solid var(--cream);border-radius:3px;padding:1px 5px;font-size:10px;font-style:normal;color:var(--gold-dark);cursor:pointer;line-height:1.4;transition:background .12s,color .12s; }
    .coherence-cite-btn:hover { background:var(--gold-dark);color:#fff;border-color:var(--gold-dark); }
  `;
  document.head.appendChild(style);
})();

// ══════════════════════════════════════════════════════════════════════
// 1. EXPORT ePUB
// ══════════════════════════════════════════════════════════════════════
async function exportEpub() {
  const text = getDomVal('raw-input').trim();
  if (!text) { showToast(_t('toast_no_export_text') || 'Aucun texte à exporter.', 2500, 'error'); return; }

  showToast(_nt('toast_generating_epub','Génération du fichier ePub…'), 2000, 'ok');

  try {
    const title   = getDomVal('pg-titre')  || currentProject.nom || 'Mon Roman';
    const author  = getDomVal('pg-auteur') || 'Auteur';
    const lang    = typeof getPref === 'function' ? getPref('ia_langue') || 'fr' : 'fr';
    const lines   = text.split('\n');

    // Build chapter list
    const chapters = [];
    let currentCh = null;
    for (const line of lines) {
      const lvl = detectHeadingLevel(line.trim());
      if (lvl === 1) {
        if (currentCh) chapters.push(currentCh);
        currentCh = { title: line.trim(), body: [] };
      } else if (currentCh) {
        currentCh.body.push(line);
      } else {
        if (!currentCh) currentCh = { title: title, body: [] };
        currentCh.body.push(line);
      }
    }
    if (currentCh) chapters.push(currentCh);
    if (!chapters.length) chapters.push({ title: title, body: lines });

    // Build ePub as ZIP
    const JSZipLib = (typeof JSZip !== 'undefined') ? JSZip : null;
    if (!JSZipLib) { showToast('Erreur : JSZip non disponible pour ePub.', 3000, 'error'); return; }
    const zip = new JSZipLib();

    // mimetype (must be first, uncompressed)
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // META-INF/container.xml
    zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

    const uid = 'atelier-' + Date.now();

    // content.opf
    const manifestItems = chapters.map((_,i) =>
      `<item id="ch${i+1}" href="ch${String(i+1).padStart(3,'0')}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ');
    const spineItems = chapters.map((_,i) => `<itemref idref="ch${i+1}"/>`).join('\n    ');

    zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escHtml(title)}</dc:title>
    <dc:creator>${escHtml(author)}</dc:creator>
    <dc:language>${lang}</dc:language>
    <dc:identifier id="uid">${uid}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`);

    // toc.ncx
    const navPoints = chapters.map((ch,i) => `<navPoint id="np${i+1}" playOrder="${i+1}">
      <navLabel><text>${escHtml(ch.title)}</text></navLabel>
      <content src="ch${String(i+1).padStart(3,'0')}.xhtml"/>
    </navPoint>`).join('\n');
    zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNormal" content="0"/>
  </head>
  <docTitle><text>${escHtml(title)}</text></docTitle>
  <navMap>${navPoints}</navMap>
</ncx>`);

    // CSS
    zip.file('OEBPS/style.css', `body{font-family:Georgia,serif;font-size:1em;line-height:1.7;margin:5% 8%;color:#1a1714;}
h1{font-size:1.4em;text-align:center;margin:2em 0 1.5em;font-style:italic;}
h2{font-size:1.1em;text-align:center;margin:1.5em 0 1em;}
p{text-indent:1.5em;margin:0 0 0.1em;}
p.noindent{text-indent:0;}
.scene-break{text-align:center;margin:1.5em 0;}`);

    // Chapter XHTML files
    chapters.forEach((ch, i) => {
      const bodyLines = ch.body;
      let html = '';
      for (const line of bodyLines) {
        const l = line.trim();
        if (!l) continue;
        if (detectHeadingLevel(l) === 2) html += `<h2>${escHtml(l.replace(/^\*\s*/,''))}</h2>\n`;
        else if (isSceneBreak(l)) html += `<p class="scene-break">* * *</p>\n`;
        else html += `<p>${escHtml(l)}</p>\n`;
      }
      zip.file(`OEBPS/ch${String(i+1).padStart(3,'0')}.xhtml`,
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}">
<head>
  <meta http-equiv="Content-Type" content="application/xhtml+xml; charset=utf-8"/>
  <title>${escHtml(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
<h1>${escHtml(ch.title)}</h1>
${html}
</body>
</html>`);
    });

    const blob = await zip.generateAsync({ type:'blob', mimeType:'application/epub+zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (title.replace(/\s+/g,'_') || 'roman') + '.epub';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(_nt('toast_epub_done','Fichier ePub téléchargé ✓'), 3000, 'ok');
  } catch(e) {
    showToast('Erreur ePub : ' + e.message, 4000, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════
// 2. SUIVI DE VERSIONS / SNAPSHOTS PAR CHAPITRE
// ══════════════════════════════════════════════════════════════════════
const VERSIONS_KEY = 'atelier_chapter_versions';

function _loadVersions() {
  try { return JSON.parse(localStorage.getItem(VERSIONS_KEY) || '{}'); } catch(e) { return {}; }
}
function _saveVersions(data) {
  try { localStorage.setItem(VERSIONS_KEY, JSON.stringify(data)); } catch(e) {}
}

function versionsPopulateChapters() {
  const sel = document.getElementById('versions-chapter-sel');
  if (!sel) return;
  const raw = getDomVal('raw-input');
  const lines = raw.split('\n');
  const chs = [];
  for (const l of lines) {
    if (detectHeadingLevel(l.trim()) === 1) chs.push(l.trim());
  }
  const prev = sel.value;
  sel.innerHTML = `<option value="">${_nt('versions_select_chapter','— Choisir un chapitre —')}</option>` +
    chs.map(c => `<option value="${escHtml(c)}">${escHtml(truncate(c,40))}</option>`).join('');
  if (prev && chs.includes(prev)) sel.value = prev;
  versionsRefreshList();
}

function versionsRefreshList() {
  const sel = document.getElementById('versions-chapter-sel');
  const list = document.getElementById('versions-list');
  if (!sel || !list) return;
  const key = sel.value;
  if (!key) { list.innerHTML = ''; updateVersionsBadge(); return; }
  const data = _loadVersions();
  const snaps = (data[key] || []).slice().reverse();
  if (!snaps.length) {
    list.innerHTML = `<div style="font-size:11px;color:var(--ink-muted);text-align:center;padding:1rem 0;font-style:italic;" data-i18n="versions_empty">Aucun snapshot. Cliquez sur + Snapshot pour en créer un.</div>`;
  } else {
    list.innerHTML = snaps.map((s,i) => {
      const realIdx = snaps.length - 1 - i;
      return `<div class="version-card" data-vkey="${escHtml(key)}" data-vidx="${realIdx}">
        <div class="version-card-top">
          <span class="version-name">${escHtml(s.label)}</span>
          <div class="version-actions">
            <button class="version-btn vbtn-restore" data-i18n="versions_restore_btn">↩ Restaurer</button>
            <button class="version-btn danger vbtn-delete" title="${_t('version_delete')}">✕</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="version-date">${new Date(s.date).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
          <span class="version-words">${s.wordCount} mots</span>
        </div>
        <div style="font-size:10px;color:var(--ink-muted);font-style:italic;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(s.preview)}</div>
      </div>`;
    }).join('');

    // Attacher les événements via JS (évite les problèmes de quotes dans onclick HTML)
    list.querySelectorAll('.version-card').forEach(card => {
      const k   = card.dataset.vkey;
      const idx = parseInt(card.dataset.vidx, 10);
      card.querySelector('.vbtn-restore').addEventListener('click', () => versionsRestore(k, idx));
      card.querySelector('.vbtn-delete').addEventListener('click',  () => versionsDelete(k, idx));
    });
  }
  updateVersionsBadge();
}

function updateVersionsBadge() {
  const badge = document.getElementById('versions-badge');
  if (!badge) return;
  const data = _loadVersions();
  const total = Object.values(data).reduce((acc, arr) => acc + arr.length, 0);
  badge.textContent = total;
  badge.style.display = total > 0 ? 'flex' : 'none';
}

function createSnapshot() {
  const sel = document.getElementById('versions-chapter-sel');
  if (!sel || !sel.value) { showToast(_nt('versions_select_first','Sélectionnez d\'abord un chapitre.'), 2500, 'error'); return; }
  const key = sel.value;
  const raw = getDomVal('raw-input');
  const lines = raw.split('\n');
  let inChapter = false, chLines = [];
  for (const l of lines) {
    if (detectHeadingLevel(l.trim()) === 1) {
      if (l.trim() === key) { inChapter = true; chLines.push(l); continue; }
      if (inChapter) break;
    }
    if (inChapter) chLines.push(l);
  }
  const chText = chLines.join('\n').trim();
  if (!chText) { showToast(_nt('versions_no_text','Texte du chapitre introuvable.'), 2500, 'error'); return; }
  const wc = chText.split(/\s+/).filter(Boolean).length;
  const defaultLabel = new Date().toLocaleDateString('fr-FR') + ' — ' + wc + ' mots';

  // Modal inline (remplace prompt() qui peut être bloqué dans certains environnements)
  let overlay = document.getElementById('snapshot-name-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'snapshot-name-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--parchment);border:1px solid var(--cream);border-radius:10px;padding:1.4rem 1.6rem;min-width:300px;max-width:90vw;box-shadow:0 16px 48px rgba(0,0,0,0.4);font-family:'DM Sans',sans-serif;">
        <div style="font-size:13px;font-weight:600;color:var(--ink);margin-bottom:10px;">Nom du snapshot</div>
        <input id="snapshot-name-input" type="text" aria-label="Nom du snapshot" style="width:100%;font-size:13px;font-family:'DM Sans',sans-serif;border:1px solid var(--cream);border-radius:5px;background:var(--paper);color:var(--ink);padding:7px 10px;box-sizing:border-box;outline:none;margin-bottom:12px;">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="snapshot-name-cancel" style="font-size:12px;padding:6px 14px;border-radius:4px;border:1px solid var(--cream);background:transparent;color:var(--ink-soft);cursor:pointer;font-family:'DM Sans',sans-serif;">Annuler</button>
          <button id="snapshot-name-ok" style="font-size:12px;padding:6px 14px;border-radius:4px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-weight:500;font-family:'DM Sans',sans-serif;">Enregistrer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }
  const inp = document.getElementById('snapshot-name-input');
  inp.value = defaultLabel;
  overlay.style.display = 'flex';
  setTimeout(() => { inp.focus(); inp.select(); }, 60);

  const doSave = () => {
    const label = inp.value.trim() || 'Sans titre';
    overlay.style.display = 'none';
    const data = _loadVersions();
    if (!data[key]) data[key] = [];
    data[key].push({ label, date: Date.now(), wordCount: wc, preview: chText.slice(0,120), text: chText });
    _saveVersions(data);
    versionsRefreshList();
    showToast(_nt('versions_saved','Snapshot enregistré ✓'), 2000, 'ok');
  };
  const doCancel = () => { overlay.style.display = 'none'; };
  document.getElementById('snapshot-name-ok').onclick = doSave;
  document.getElementById('snapshot-name-cancel').onclick = doCancel;
  overlay.onclick = (e) => { if (e.target === overlay) doCancel(); };
  inp.onkeydown = (e) => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') doCancel(); };
}

function _confirmDialog(message, onOk) {
  let dlg = document.getElementById('_confirm-overlay');
  if (!dlg) {
    dlg = document.createElement('div');
    dlg.id = '_confirm-overlay';
    dlg.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
    dlg.innerHTML = `<div style="background:var(--parchment);border:1px solid var(--cream);border-radius:10px;padding:1.4rem 1.6rem;min-width:280px;max-width:88vw;box-shadow:0 16px 48px rgba(0,0,0,0.4);font-family:'DM Sans',sans-serif;">
      <div id="_confirm-msg" style="font-size:13px;color:var(--ink);line-height:1.55;margin-bottom:14px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="_confirm-no"  style="font-size:12px;padding:6px 14px;border-radius:4px;border:1px solid var(--cream);background:transparent;color:var(--ink-soft);cursor:pointer;font-family:'DM Sans',sans-serif;">Annuler</button>
        <button id="_confirm-yes" style="font-size:12px;padding:6px 14px;border-radius:4px;border:none;background:var(--danger,#dc2626);color:#fff;cursor:pointer;font-weight:500;font-family:'DM Sans',sans-serif;">Confirmer</button>
      </div></div>`;
    document.body.appendChild(dlg);
  }
  document.getElementById('_confirm-msg').textContent = message;
  dlg.style.display = 'flex';
  const close = () => { dlg.style.display = 'none'; };
  document.getElementById('_confirm-yes').onclick = () => { close(); onOk(); };
  document.getElementById('_confirm-no').onclick  = close;
  dlg.onclick = (e) => { if (e.target === dlg) close(); };
}

function versionsDelete(key, idx) {
  _confirmDialog(
    _nt('versions_confirm_delete','Supprimer ce snapshot ?'),
    () => {
      const data = _loadVersions();
      if (data[key]) { data[key].splice(idx, 1); if (!data[key].length) delete data[key]; }
      _saveVersions(data);
      versionsRefreshList();
    }
  );
}

function versionsRestore(key, idx) {
  const data = _loadVersions();
  const snap = data[key]?.[idx];
  if (!snap) return;
  _confirmDialog(
    _nt('versions_confirm_restore','Restaurer cette version ? Le texte actuel sera remplacé. Action irréversible.'),
    () => {
      const ta = document.getElementById('raw-input');
      if (!ta) return;
      const lines = ta.value.split('\n');
      let start = -1, end = -1;
      for (let i = 0; i < lines.length; i++) {
        if (detectHeadingLevel(lines[i].trim()) === 1) {
          if (lines[i].trim() === key) { start = i; continue; }
          if (start >= 0 && end < 0) { end = i; break; }
        }
      }
      if (start < 0) { showToast(_nt('versions_chapter_not_found','Chapitre introuvable dans le texte.'), 2500, 'error'); return; }
      if (end < 0) end = lines.length;
      lines.splice(start, end - start, ...snap.text.split('\n'));
      ta.value = lines.join('\n');
      onRawInput();
      markUnsaved();
      showToast(_nt('versions_restored','Version restaurée ✓'), 2000, 'ok');
    }
  );
}

// ══════════════════════════════════════════════════════════════════════
// 3. TAGS SUR LES CHAPITRES
// ══════════════════════════════════════════════════════════════════════
let _tagEditKey = null;

function chEditTags(key) {
  _tagEditKey = key;
  const meta = chGetMeta(key);
  const modal = document.getElementById('ch-tags-modal');
  if (!modal) return;
  const inp = document.getElementById('ch-tags-input');
  if (inp) inp.value = (meta.tags || []).join(', ');
  _tagsPreviewUpdate();
  modal.classList.add('open');
  if (inp) inp.focus();
}

function _tagsPreviewUpdate() {
  const inp = document.getElementById('ch-tags-input');
  const prev = document.getElementById('ch-tags-preview');
  if (!inp || !prev) return;
  const tags = inp.value.split(/[,;]+/).map(t=>t.trim()).filter(Boolean);
  prev.innerHTML = tags.map(t=>`<span class="ch-tag-chip">${escHtml(t)}</span>`).join('');
}

function chTagsSave() {
  if (!_tagEditKey) return;
  const inp = document.getElementById('ch-tags-input');
  const tags = inp ? inp.value.split(/[,;]+/).map(t=>t.trim()).filter(Boolean) : [];
  const meta = chGetMeta(_tagEditKey);
  meta.tags = tags;
  markUnsaved();
  document.getElementById('ch-tags-modal')?.classList.remove('open');
  _tagEditKey = null;
  if (typeof _corkChapters !== 'undefined' && _corkChapters.length) updateChapterList(_corkChapters);
}

function chTagsCancel() {
  document.getElementById('ch-tags-modal')?.classList.remove('open');
  _tagEditKey = null;
}

// ══════════════════════════════════════════════════════════════════════
// 4. VUE CARTE / CORKBOARD (fusionné avec structure)
// ══════════════════════════════════════════════════════════════════════

// Source de vérité : stocké à chaque updateChapterList
let _corkChapters = [];

// Ferme tous les dropdowns statut ouverts sauf celui dont l'id est passé
function _closeCorkStatusDropdowns(exceptId) {
  document.querySelectorAll('.cork-status-dropdown.open').forEach(d => {
    if (d.dataset.cardId !== exceptId) d.classList.remove('open');
  });
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.cork-status-pill')) _closeCorkStatusDropdowns(null);
});

function corkSetStatus(cardId, st) {
  const card = document.querySelector('.cork-card[data-card-id="' + cardId + '"]');
  if (!card) return;
  const chTitle = decodeURIComponent(card.dataset.chTitle);
  const meta = chGetMeta(chTitle);
  meta.status = st;
  markUnsaved();

  const STATUS_COLORS = ['var(--status-draft)','var(--status-wip)','var(--status-done)','var(--status-review)'];
  const STATUS_LABELS = [_t('ch_st_draft'), _t('ch_st_wip'), _t('ch_st_done'), _t('ch_st_review')];
  const color = STATUS_COLORS[st];

  const pill = card.querySelector('.cork-status-pill');
  if (pill) {
    pill.style.borderColor = color;
    pill.style.color = color;
    const dot = pill.querySelector('.cork-pill-dot');
    if (dot) dot.style.background = color;
    const lbl = pill.querySelector('.cork-pill-label');
    if (lbl) lbl.textContent = STATUS_LABELS[st];
  }
  card.querySelector('.cork-status-dropdown')?.classList.remove('open');
  card.querySelectorAll('.cork-status-opt').forEach(o => o.classList.toggle('active', +o.dataset.st === st));
}

function _corkToggleLock(cardId) {
  const card = document.querySelector('.cork-card[data-card-id="' + cardId + '"]');
  if (!card) return;
  const chTitle = decodeURIComponent(card.dataset.chTitle);
  const meta = chGetMeta(chTitle);
  meta.locked = !meta.locked;
  card.classList.toggle('cork-locked', meta.locked);
  const btn = card.querySelector('.cork-lock-btn');
  if (btn) { btn.textContent = meta.locked ? '🔒' : '🔓'; btn.classList.toggle('locked', meta.locked); }
  markUnsaved();
  _updateEditorLockState();
}

function corkboardRender() {
  const container = document.getElementById('corkboard-cards');
  if (!container) return;

  // ── SOURCE DE VÉRITÉ ──
  // En mode isolé : utiliser IM.chapters (le textarea ne contient qu'un seul chapitre)
  // En mode continu : utiliser _corkChapters (peuplé par updateChapterList)
  let chapters;
  const isIsolated = (typeof IM !== 'undefined') && IM.active;
  if (isIsolated && IM.chapters && IM.chapters.length) {
    // Convertir IM.chapters (format {title,body}) en format corkboard (format {text,level,id})
    chapters = IM.chapters
      .map((ch, realIdx) => ({ text: ch.title, level: 1, id: 'im-ch-' + realIdx, _imIdx: realIdx }))
      .filter(ch => ch.text);  // ignorer le prologue sans titre (après map pour garder le vrai index)
    // Si aucun H1, montrer quand même tout
    if (!chapters.length) {
      chapters = _corkChapters;
    }
  } else {
    chapters = _corkChapters;
  }
  if (!chapters || !chapters.length) {
    container.innerHTML = `<div class="cork-empty">Aucun chapitre détecté. Collez votre roman dans l'éditeur.</div>`;
    return;
  }

  const tagFilter = (document.getElementById('cork-tag-filter')?.value || '').toLowerCase().trim();

  // Compter les mots par chapitre.
  // En mode isolé : reconstruire le texte complet depuis IM.chapters
  // (le textarea ne contient qu'un seul chapitre à la fois).
  // En mode continu : lire le textarea normalement.
  let raw;
  if (isIsolated && typeof _joinChapters === 'function' && IM.chapters && IM.chapters.length) {
    raw = _joinChapters(IM.chapters);
  } else {
    raw = (typeof getDomVal === 'function') ? getDomVal('raw-input') : (document.getElementById('raw-input')?.value || '');
  }
  const wordCounts = {};
  const previews = {};
  if (raw) {
    const lines = raw.split('\n');
    let curTitle = null;
    let curLines = [];
    const flush = () => {
      if (curTitle !== null) {
        const text = curLines.join(' ').replace(/\s+/g,' ').trim();
        wordCounts[curTitle] = text ? text.split(/\s+/).length : 0;
        previews[curTitle] = text.slice(0, 220);
        curLines = [];
      }
    };
    for (const line of lines) {
      const lvl = (typeof detectHeadingLevel === 'function') ? detectHeadingLevel(line.trim()) : 0;
      if (lvl === 1) {
        // Nouveau chapitre H1 : on ferme le précédent
        flush();
        curTitle = line.trim();
      } else if (curTitle !== null) {
        // Texte courant, H2 ou H3 : tout s'accumule dans le H1 parent
        if (line.trim()) curLines.push(line.trim());
      }
    }
    flush();
  }

  const STATUS_LABELS = [_t('ch_st_draft'), _t('ch_st_wip'), _t('ch_st_done'), _t('ch_st_review')];
  const STATUS_COLORS = ['var(--status-draft)','var(--status-wip)','var(--status-done)','var(--status-review)'];

  let cardIdx = 0;
  const cards = chapters.map((ch) => {
    // Ne montrer que les chapitres H1 dans le corkboard
    if (ch.level !== 1) return '';
    const meta = chGetMeta(ch.text);
    const tags = meta.tags || [];
    if (tagFilter && !tags.some(t => t.toLowerCase().includes(tagFilter))) return '';
    const st = meta.status || 0;
    const statusLabel = STATUS_LABELS[st] || STATUS_LABELS[0];
    const statusColor = STATUS_COLORS[st] || STATUS_COLORS[0];
    const isLocked = !!meta.locked;
    const words = wordCounts[ch.text] || 0;
    const preview = previews[ch.text] || '';
    const aiSummary = _chapterSummaryCache?.[ch.text] || '';
    const cardId = 'cork-' + (cardIdx++);
    // Encoder le titre pour data-attribute (évite les problèmes de guillemets)
    const titleEncoded = encodeURIComponent(ch.text);

    const statusOpts = STATUS_LABELS.map((lbl, i) => `<button class="cork-status-opt${i===st?' active':''}" data-st="${i}"
      onclick="event.stopPropagation();corkSetStatus('${cardId}',${i})"
      ><span class="cork-opt-dot" style="background:${STATUS_COLORS[i]}"></span>${escHtml(lbl)}</button>`).join('');

    const isActiveChapter = isIsolated && (ch._imIdx === IM.activeIdx);
    const activeBorder = isActiveChapter ? 'border-left:3px solid var(--accent);padding-left:9px;' : '';

    return `<div class="cork-card${isLocked?' cork-locked':''}" data-card-id="${cardId}" data-ch-title="${titleEncoded}"
        style="${activeBorder}"
        onclick="scrollToChapter('${escHtml(ch.id)}', decodeURIComponent(this.dataset.chTitle))">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px;">
        <div class="cork-card-title" style="margin-bottom:0;flex:1;min-width:0;">${escHtml(ch.text)}</div>
        <button class="cork-action-btn" title="${_t('cork_delete_t')}"
          style="flex-shrink:0;color:#dc2626;font-size:16px;font-weight:700;opacity:${isIsolated?'1':'0.25'};cursor:${isIsolated?'pointer':'default'};"
          onclick="event.stopPropagation();corkDeleteChapter(decodeURIComponent(this.closest('.cork-card').dataset.chTitle))">−</button>
      </div>
      <div class="cork-card-controls" onclick="event.stopPropagation()">
        <div class="cork-status-pill" style="border-color:${statusColor};color:${statusColor}"
          onclick="event.stopPropagation();var d=this.parentElement.querySelector('.cork-status-dropdown');var wasOpen=d.classList.contains('open');_closeCorkStatusDropdowns(wasOpen?null:'${cardId}');d.classList.toggle('open',!wasOpen);">
          <span class="cork-pill-dot" style="background:${statusColor}"></span>
          <span class="cork-pill-label">${escHtml(statusLabel)}</span>
          <span class="cork-pill-arrow">▾</span>
        </div>
        <div class="cork-status-dropdown" data-card-id="${cardId}">
          ${statusOpts}
        </div>
        <span class="cork-words">${words.toLocaleString('fr')} mots</span>
        <div class="cork-actions">
          <button class="cork-action-btn" title="${_t('cork_summary_t')}"
            onclick="event.stopPropagation();openSummaryPopup(this, decodeURIComponent(this.closest('.cork-card').dataset.chTitle))">✦</button>
          <button class="cork-action-btn" title="${_t('cork_tag_t')}"
            onclick="event.stopPropagation();chEditTags(decodeURIComponent(this.closest('.cork-card').dataset.chTitle))">🏷</button>
          <button class="cork-action-btn cork-lock-btn${isLocked?' locked':''}" title="${isLocked?_t('cork_unlock_t'):_t('cork_lock_t')}"
            onclick="event.stopPropagation();_corkToggleLock('${cardId}')">${isLocked?'🔒':'🔓'}</button>
        </div>
      </div>
      ${tags.length ? `<div class="cork-card-tags">${tags.map(t=>`<span class="ch-tag-chip">${escHtml(t)}</span>`).join('')}</div>` : ''}
      ${aiSummary
        ? `<div class="cork-card-summary ai">✦ ${escHtml(aiSummary)}</div>`
        : (preview ? `<div class="cork-card-summary">${escHtml(preview)}…</div>` : '')}
    </div>`;
  }).filter(Boolean);

  if (!cards.length) {
    container.innerHTML = `<div class="cork-empty">Aucun chapitre correspond au filtre « ${escHtml(tagFilter)} ».</div>`;
  } else {
    container.innerHTML = cards.join('');
  }
}

// Cache des résumés IA pour le corkboard
const _chapterSummaryCache = {};

// ══════════════════════════════════════════════════════════════════════
// ACTIONS VUE CARTE : ajouter / supprimer un chapitre
// ══════════════════════════════════════════════════════════════════════

/**
 * Affiche le modal d'ajout de chapitre et crée le chapitre au nom saisi.
 * Bouton + en tête du panneau Vue carte.
 * En mode isolé  : ajoute directement dans IM.chapters (en dernière position).
 * En mode continu: appende un titre H1 dans le textarea et active le mode isolé.
 */
function corkAddChapter() {
  // Utiliser window.IM pour accéder à l'objet exposé par l'IIFE
  const _IM = window.IM;
  if (!_IM) return;

  // Calcul du numéro de chapitre proposé par défaut
  const chNum = _IM.active
    ? (_IM.chapters.filter(c => c.title).length + 1)
    : ((_corkChapters || []).filter(c => c.level === 1).length + 1);
  const defaultTitle = 'Chapitre ' + chNum;

  // ── Créer le modal de saisie ──
  const overlay = document.createElement('div');
  overlay.id = 'cork-add-modal-overlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:9999;',
    'background:rgba(0,0,0,0.45);',
    'display:flex;align-items:center;justify-content:center;',
    'font-family:\'DM Sans\',sans-serif;',
  ].join('');

  overlay.innerHTML = `
    <div style="background:var(--parchment);border:1px solid var(--cream);border-radius:8px;
      box-shadow:0 8px 32px rgba(0,0,0,0.28);padding:28px 28px 22px;width:360px;max-width:90vw;">
      <div style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:600;
        color:var(--ink);margin-bottom:16px;">Nouveau chapitre</div>
      <label style="display:block;font-size:13px;color:var(--ink-muted);margin-bottom:6px;">
        Nom du chapitre
      </label>
      <input id="cork-add-modal-input" type="text"
        value="${defaultTitle.replace(/"/g,'&quot;')}"
        maxlength="200"
        style="width:100%;padding:8px 10px;border:1px solid var(--cream);border-radius:4px;
          background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;font-size:14px;
          outline:none;box-sizing:border-box;"/>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
        <button id="cork-add-modal-cancel"
          style="padding:7px 16px;border-radius:4px;border:1px solid var(--cream);
            background:transparent;color:var(--ink-muted);cursor:pointer;font-size:13px;">
          Annuler
        </button>
        <button id="cork-add-modal-confirm"
          style="padding:7px 16px;border-radius:4px;border:1px solid var(--gold);
            background:var(--gold);color:#fff;cursor:pointer;font-size:13px;font-weight:500;">
          Créer
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const input = document.getElementById('cork-add-modal-input');
  // Sélectionner tout le texte pour faciliter la saisie
  setTimeout(() => { input.focus(); input.select(); }, 30);

  function _closeModal() {
    const el = document.getElementById('cork-add-modal-overlay');
    if (el) el.remove();
  }

  function _confirmAdd() {
    const newTitle = (input.value || '').trim();
    if (!newTitle) {
      input.style.borderColor = 'var(--danger)';
      input.focus();
      return;
    }
    _closeModal();
    _corkConfirmAdd(newTitle);
  }

  document.getElementById('cork-add-modal-cancel').addEventListener('click', _closeModal);
  document.getElementById('cork-add-modal-confirm').addEventListener('click', _confirmAdd);
  // Valider avec Entrée, fermer avec Échap
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); _confirmAdd(); }
    if (e.key === 'Escape') { e.preventDefault(); _closeModal(); }
  });
  // Clic hors du modal = annuler
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _closeModal();
  });
}
window.corkAddChapter = corkAddChapter;

/**
 * Appelé après validation du modal — ajoute le chapitre en dernière position.
 */
function _corkConfirmAdd(newTitle) {
  const _IM = window.IM;
  if (!_IM) return;

  if (_IM.active) {
    // ── Mode isolé : ajouter directement en fin de liste ──
    if (typeof window._saveCurrentChapterFromEditor === 'function') window._saveCurrentChapterFromEditor();
    const newIdx = _IM.chapters.length;
    _IM.chapters.push({ title: newTitle, body: '' });
    _IM.activeIdx = newIdx;
    if (typeof window._loadChapterInEditor === 'function') window._loadChapterInEditor(newIdx);
    if (typeof window._updateTabsBar === 'function') window._updateTabsBar();
    setTimeout(corkboardRender, 40);
    const ta = document.getElementById('raw-input');
    if (ta) { ta.focus(); ta.setSelectionRange(newTitle.length + 1, newTitle.length + 1); }
    if (typeof showToast === 'function') showToast('Chapitre « ' + newTitle + ' » créé', 1800, 'ok');

  } else {
    // ── Mode continu : ajouter dans le textarea puis activer le mode isolé ──
    const ta = document.getElementById('raw-input');
    if (!ta) return;
    const sep = ta.value.trim() ? '\n\n' : '';
    ta.value = ta.value.trimEnd() + sep + newTitle + '\n';
    if (typeof onRawInput === 'function') onRawInput();
    ta.focus();
    ta.setSelectionRange(ta.value.length - 1, ta.value.length - 1);
    if (typeof activateIsolatedMode === 'function') activateIsolatedMode();
    if (typeof showToast === 'function') showToast('Chapitre « ' + newTitle + ' » créé — mode isolé activé', 2200, 'ok');
  }
}
window._corkConfirmAdd = _corkConfirmAdd;

/**
 * Bouton − sur une carte. Supprime le chapitre.
 * Bloqué si le chapitre est verrouillé (🔒).
 * Fonctionne en mode isolé ET en mode continu.
 */
function corkDeleteChapter(chapterTitle) {
  const label = chapterTitle.length > 50 ? chapterTitle.slice(0, 50) + '…' : chapterTitle;

  // ── Vérifier le verrou AVANT tout ──
  const meta = (typeof chGetMeta === 'function') ? chGetMeta(chapterTitle) : {};
  if (meta && meta.locked) {
    if (typeof showToast === 'function') showToast('Chapitre verrouillé — déverrouillez d\'abord 🔒', 2500, 'error');
    return;
  }

  const _IM = window.IM;
  const isIsolated = _IM && _IM.active;

  if (isIsolated) {
    // ── Mode isolé : opérer sur IM.chapters ──
    if (_IM.chapters.filter(c => c.title).length <= 1) {
      if (typeof showToast === 'function') showToast('Impossible : dernier chapitre', 2000, 'error');
      return;
    }
    if (!confirm('Supprimer « ' + label + ' » ? Cette action est irréversible.')) return;
    if (typeof window._saveCurrentChapterFromEditor === 'function') window._saveCurrentChapterFromEditor();
    const idx = _IM.chapters.findIndex(c => c.title === chapterTitle);
    if (idx < 0) return;
    _IM.chapters.splice(idx, 1);
    let newIdx = _IM.activeIdx;
    if (idx < _IM.activeIdx) newIdx--;
    else if (idx === _IM.activeIdx) newIdx = Math.min(_IM.activeIdx, _IM.chapters.length - 1);
    _IM.activeIdx = newIdx;
    if (typeof window._loadChapterInEditor === 'function') window._loadChapterInEditor(newIdx);
    if (typeof window._updateTabsBar === 'function') window._updateTabsBar();
    setTimeout(corkboardRender, 40);
    if (typeof showToast === 'function') showToast('Chapitre supprimé', 1500, 'ok');

  } else {
    // ── Mode continu : supprimer dans le textarea brut ──
    const ta = document.getElementById('raw-input');
    if (!ta) return;
    const allChaps = _corkChapters.filter(c => c.level === 1);
    if (allChaps.length <= 1) {
      if (typeof showToast === 'function') showToast('Impossible : dernier chapitre', 2000, 'error');
      return;
    }
    if (!confirm('Supprimer « ' + label + ' » ? Cette action est irréversible.')) return;

    const raw = ta.value;
    const lines = raw.split('\n');
    let startLine = -1, endLine = lines.length;
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      const lvl = (typeof detectHeadingLevel === 'function') ? detectHeadingLevel(lines[i].trim()) : 0;
      if (lvl === 1) {
        if (found) { endLine = i; break; }
        if (lines[i].trim() === chapterTitle) { startLine = i; found = true; }
      }
    }
    if (startLine < 0) { if (typeof showToast === 'function') showToast('Chapitre introuvable', 2000, 'error'); return; }
    lines.splice(startLine, endLine - startLine);
    ta.value = lines.join('\n');
    if (typeof onRawInput === 'function') onRawInput();
    if (typeof showToast === 'function') showToast('Chapitre supprimé', 1500, 'ok');
  }
}
window.corkDeleteChapter = corkDeleteChapter;

// ══════════════════════════════════════════════════════════════════════
// 5. CONTINUATION DE TEXTE IA
// ══════════════════════════════════════════════════════════════════════
let _aiContPopupOpen = false;

async function aiContinueText() {
  if (!_requireTextAndKey()) return;
  const ta = document.getElementById('raw-input');
  if (!ta) return;

  const cursorPos = ta.selectionStart;
  const text = ta.value;
  // Prend les 600 derniers caractères avant le curseur
  const context = text.slice(Math.max(0, cursorPos - 600), cursorPos);
  if (!context.trim()) { showToast(_nt('ai_continue_no_context','Placez le curseur dans votre texte.'), 2500, 'error'); return; }

  // Créer/afficher le popup
  let popup = document.getElementById('ai-continue-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'ai-continue-popup';
    popup.innerHTML = `
      <div class="aicont-title" data-i18n="ai_continue_title">✦ Continuation IA</div>
      <div id="aicont-result" class="aicont-result" style="font-style:italic;color:var(--ink-muted);">Génération en cours…</div>
      <div class="aicont-btns">
        <button class="aicont-btn" onclick="aiContInsert()" data-i18n="ai_continue_insert">↩ Insérer</button>
        <button class="aicont-btn" onclick="aiContRegenerate()" data-i18n="ai_continue_regen">⟳ Régénérer</button>
        <button class="aicont-btn" onclick="aiContClose()" data-i18n="ai_continue_close">✕ Fermer</button>
      </div>`;
    document.body.appendChild(popup);
  }

  // Positionner près du curseur
  const rect = ta.getBoundingClientRect();
  popup.style.left = Math.min(rect.left + 20, window.innerWidth - 450) + 'px';
  popup.style.top  = Math.min(rect.top + 60, window.innerHeight - 300) + 'px';
  popup.classList.add('open');
  popup._context = context;
  popup._cursorPos = cursorPos;

  await _aiContGenerate(context, popup);
}

async function _aiContGenerate(context, popup) {
  const resultEl = popup.querySelector('#aicont-result');
  if (resultEl) { resultEl.textContent = 'Génération en cours…'; resultEl.style.fontStyle = 'italic'; resultEl.style.color = 'var(--ink-muted)'; }

  const lang = typeof getPref === 'function' ? getPref('ia_langue') || 'fr' : 'fr';
  const systemPrompt = (lang === 'fr')
    ? `Tu es un auteur ghostwriter spécialisé dans la fiction romanesque française. Tu dois continuer un extrait de roman en t'effaçant totalement derrière la voix de l'auteur.

ANALYSE DU PASSAGE FOURNI avant d'écrire :
— Identifie le temps verbal dominant (passé simple ? imparfait ? présent de narration ?) → utilise UNIQUEMENT ce temps.
— Identifie le point de vue (1re personne ? 3e omniscient ? 3e limité ?) → maintiens-le sans dévier.
— Repère le registre (soutenu, neutre, familier, archaïsant) → respecte-le mot à mot.
— Observe la longueur moyenne des phrases → adopte le même rythme, ne change pas le style.

RÈGLES ABSOLUES :
- Continue directement le texte, sans saut de ligne d'introduction, sans guillemet d'ouverture parasite.
- N'introduis aucun nouveau personnage, aucun lieu non mentionné, aucun retournement de situation.
- N'ajoute aucune conclusion dramatique artificielle — reste dans le ton du passage.
- 80 à 140 mots maximum.
- Aucun commentaire, aucune introduction, aucun guillemet de cadrage — uniquement la continuation brute.`
    : (lang === 'es')
    ? `Eres un autor literario. Continúa el texto de manera coherente, respetando exactamente el estilo, la voz narrativa, el tiempo verbal y el punto de vista del pasaje. No introduzcas nuevos personajes ni lugares. Escribe 80-140 palabras máximo, sin introducción ni comentario — únicamente la continuación directa del texto.`
    : `You are a literary ghostwriter specializing in fiction. Continue the passage by mirroring the author's voice exactly — same verb tense, same POV, same rhythm, same register. Do not introduce new characters, new locations, or artificial plot turns. 80-140 words maximum, no intro, no commentary — only the raw continuation.`;

  try {
    const result = await callAI(systemPrompt, context, 250);
    if (result && !result.error) {
      popup._lastResult = result.trim();
      if (resultEl) { resultEl.textContent = result.trim(); resultEl.style.fontStyle = ''; resultEl.style.color = ''; }
    } else {
      if (resultEl) { resultEl.textContent = '⚠ ' + (result?.error || 'Erreur'); resultEl.style.color = 'var(--danger)'; }
    }
  } catch(e) {
    if (resultEl) { resultEl.textContent = '⚠ ' + e.message; resultEl.style.color = 'var(--danger)'; }
  }
}

function aiContInsert() {
  const popup = document.getElementById('ai-continue-popup');
  if (!popup?._lastResult) return;
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  const pos = popup._cursorPos ?? ta.selectionStart;
  const val = ta.value;
  ta.value = val.slice(0, pos) + '\n' + popup._lastResult + val.slice(pos);
  ta.setSelectionRange(pos + 1 + popup._lastResult.length, pos + 1 + popup._lastResult.length);
  onRawInput();
  aiContClose();
  showToast(_nt('ai_continue_inserted','Continuation insérée ✓'), 1800, 'ok');
}

function aiContRegenerate() {
  const popup = document.getElementById('ai-continue-popup');
  if (!popup) return;
  _aiContGenerate(popup._context, popup);
}

function aiContClose() {
  const popup = document.getElementById('ai-continue-popup');
  if (popup) popup.classList.remove('open');
}

// ══════════════════════════════════════════════════════════════════════
// 6. ANALYSE DE COHÉRENCE NARRATIVE IA
// ══════════════════════════════════════════════════════════════════════
async function runCoherenceCheck() {
  if (!_requireTextAndKey()) return;
  const text = getDomVal('raw-input').trim();
  if (!text) { showToast(_t('toast_no_text'), 2500, 'error'); return; }

  const btn = document.getElementById('wt-btn-coherence');
  const box = document.getElementById('wt-coherence-results');
  if (!box) return;

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse en cours…'; }
  box.innerHTML = `<div style="color:var(--ink-muted);font-style:italic;font-size:11px;text-align:center;padding:1rem;">✦ Analyse de cohérence narrative…</div>`;

  // Fiches personnages / lieux
  const persos = typeof getPersos === 'function' ? getPersos() : [];
  const lieux   = typeof getLieux  === 'function' ? getLieux()  : [];
  const persoDesc = persos.map(p => `• ${p.nom}${p.description ? ' : ' + p.description.slice(0,120) : ''}${p.notes ? ' — ' + p.notes.slice(0,80) : ''}`).join('\n');
  const lieuxDesc  = lieux.map(l => `• ${l.nom}${l.description ? ' : ' + l.description.slice(0,120) : ''}`).join('\n');

  const lang = typeof getPref === 'function' ? getPref('ia_langue') || 'fr' : 'fr';

  // ── Découper le roman en chapitres ──────────────────────────
  function _splitChapters(fullText) {
    const lines = fullText.split('\n');
    const chapters = [];
    let curTitle = null, curLines = [];
    const flush = () => {
      if (curTitle !== null) {
        chapters.push({ title: curTitle, body: curLines.join('\n').trim() });
        curLines = [];
      }
    };
    for (const line of lines) {
      const lvl = (typeof detectHeadingLevel === 'function') ? detectHeadingLevel(line.trim()) : 0;
      if (lvl === 1) { flush(); curTitle = line.trim(); }
      else if (curTitle !== null) curLines.push(line);
    }
    flush();
    return chapters;
  }

  const chapters = _splitChapters(text);

  // ── Construire le texte à envoyer ───────────────────────────
  // Budget : ~20 000 caractères pour le roman (fenêtre IA confortable).
  // Si le roman tient dans ce budget → envoi intégral.
  // Sinon → 600 caractères par chapitre (début + fin pour capter les arcs).
  const BUDGET = 20000;
  let novelBlock;
  if (text.length <= BUDGET) {
    // Roman court : on envoie tout
    novelBlock = chapters.length
      ? chapters.map((ch, i) => `=== Chapitre ${i+1} : ${ch.title} ===\n${ch.body}`).join('\n\n')
      : text;
  } else {
    // Roman long : début (400 chars) + fin (200 chars) de chaque chapitre
    const perCh = Math.max(400, Math.floor(BUDGET / Math.max(chapters.length, 1)));
    novelBlock = chapters.map((ch, i) => {
      const b = ch.body;
      const snippet = b.length <= perCh
        ? b
        : b.slice(0, Math.round(perCh * 0.67)) + '\n[…]\n' + b.slice(-Math.round(perCh * 0.33));
      return `=== Chapitre ${i+1} : ${ch.title} ===\n${snippet}`;
    }).join('\n\n');
  }

  // ── Prompts ──────────────────────────────────────────────────
  const systemPrompt = (lang === 'fr')
    ? `Tu es un éditeur littéraire chargé de vérifier la cohérence interne d'un roman.

RÈGLES STRICTES :
- Ne signale UNE incohérence QUE si tu peux citer deux passages du texte qui se contredisent explicitement.
- N'invente rien, ne fais aucune supposition. Si tu n'es pas certain à 100 %, ne signale pas.
- Les structures narratives non-linéaires (flashbacks, retours en arrière, ellipses, récits emboîtés) NE sont PAS des incohérences.
- Un changement de POV clairement signalé par l'auteur (nouveau chapitre, astérisque, saut de ligne) N'est PAS une incohérence.
- Un lieu mentionné sans description initiale N'est PAS une incohérence.
- Ignore tout ce qui relève du style, du rythme ou des choix artistiques.

SEULES CES 4 CATÉGORIES sont valides :
1. personnage — un personnage déclaré mort réapparaît vivant SANS explication, ou son prénom/physique change d'un chapitre à l'autre sans raison narrative.
2. chronologie — deux événements datés explicitement dans le texte se contredisent (ex: événement A dit "avant B" mais arrive après dans le récit ET les deux dates sont citées mot pour mot).
3. lieu — un lieu est décrit de façon radicalement contradictoire dans deux passages (ex: "au nord" puis "au sud").
4. objet — un objet détruit ou perdu réapparaît intact sans explication.

FORMAT DE SORTIE : JSON pur, sans balise markdown, sans commentaire.
{"issues":[{"type":"personnage|chronologie|lieu|objet","severity":"error|warn","message":"description factuelle en 1 phrase","citation_a":"citation exacte passage 1 (≤30 chars)","citation_b":"citation exacte passage 2 contradictoire (≤30 chars)"}]}
Si aucune incohérence certaine : {"issues":[]}
Maximum 5 issues. Mieux vaut retourner [] que d'inventer.`
    : `You are a literary editor verifying the internal consistency of a novel.

STRICT RULES:
- Only flag an inconsistency if you can quote TWO passages from the text that explicitly contradict each other.
- Do not invent or assume anything. If not 100% certain, do not flag.
- Non-linear narrative structures (flashbacks, ellipses, nested stories) are NOT inconsistencies.
- A POV change clearly marked by the author (new chapter, asterisk, blank line) is NOT an inconsistency.
- A location mentioned without prior description is NOT an inconsistency.
- Ignore style, rhythm or artistic choices.

ONLY THESE 4 CATEGORIES are valid:
1. character — a character declared dead reappears alive WITHOUT explanation, or their name/appearance changes between chapters without narrative reason.
2. timeline — two explicitly dated events contradict each other (both dates quoted verbatim from the text).
3. location — a place is described in radically contradictory ways in two passages.
4. object — an object destroyed or lost reappears intact without explanation.

OUTPUT FORMAT: pure JSON, no markdown, no comment.
{"issues":[{"type":"character|timeline|location|object","severity":"error|warn","message":"one factual sentence","citation_a":"exact quote passage 1 (≤30 chars)","citation_b":"exact quote passage 2 contradicting it (≤30 chars)"}]}
If no certain inconsistency: {"issues":[]}
Max 5 issues. Returning [] is better than inventing.`;

  const userMsg = [
    persoDesc ? `FICHES PERSONNAGES:\n${persoDesc}` : '',
    lieuxDesc  ? `FICHES LIEUX:\n${lieuxDesc}`      : '',
    `TEXTE DU ROMAN (${chapters.length} chapitre${chapters.length>1?'s':''}) :\n${novelBlock}`
  ].filter(Boolean).join('\n\n');

  try {
    const raw = await callAI(systemPrompt, userMsg, 1200);
    if (!raw || raw.error) throw new Error(raw?.error || 'Aucune réponse');

    let issues = [];
    try {
      const cleaned = raw.replace(/```json[\s\S]*?```|```/g,'').trim();
      const parsed  = JSON.parse(cleaned);
      issues = parsed.issues || [];
    } catch(e) {
      box.innerHTML = `<div style="font-size:11px;color:var(--ink);line-height:1.6;padding:8px;">${escHtml(raw)}</div>`;
      return;
    }

    if (!issues.length) {
      box.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--status-done);font-size:13px;">✓ Aucune incohérence certaine détectée</div>`;
    } else {
      const icons = { personnage:'👤', lieu:'🗺', chronologie:'⏱', pov:'👁', objet:'📦', character:'👤', location:'🗺', timeline:'⏱', object:'📦' };
      box.innerHTML = issues.map(issue => `
        <div class="coherence-issue ${issue.severity || 'warn'}">
          <div class="coherence-type">${icons[issue.type] || '⚠'} ${escHtml(issue.type)}</div>
          <div class="coherence-msg">${escHtml(issue.message)}</div>
          ${issue.citation_a ? `<div class="coherence-quote"><span>① « ${escHtml(issue.citation_a)} »</span><button class="coherence-cite-btn" onclick="_coherenceJumpTo(${JSON.stringify(issue.citation_a)})" title="Pointer dans le texte">↗</button></div>` : ''}
          ${issue.citation_b ? `<div class="coherence-quote"><span>② « ${escHtml(issue.citation_b)} »</span><button class="coherence-cite-btn" onclick="_coherenceJumpTo(${JSON.stringify(issue.citation_b)})" title="Pointer dans le texte">↗</button></div>` : ''}
        </div>`).join('');
    }
  } catch(e) {
    box.innerHTML = `<div style="color:var(--danger);font-size:11px;">⚠ Erreur : ${escHtml(e.message)}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = _nt('btn_coherence','🧩 Vérifier la cohérence narrative'); }
  }
}
// ══════════════════════════════════════════════════════════════════════
// NAVIGATION VERS UNE CITATION DE COHÉRENCE DANS LE TEXTE
// ══════════════════════════════════════════════════════════════════════
function _coherenceJumpTo(citation) {
  if (!citation) return;
  const needle = citation.trim();
  if (!needle) return;

  const _IM = window.IM;
  const isIsolated = _IM && _IM.active;

  // ── Recherche insensible à la casse, avec fallback partiel (premiers 15 chars) ──
  function _findIn(haystack, needle) {
    const lo = haystack.toLowerCase();
    const ndlo = needle.toLowerCase();
    let pos = lo.indexOf(ndlo);
    if (pos >= 0) return pos;
    // Fallback : premiers 15 chars du needle (la citation IA est parfois tronquée)
    const short = ndlo.slice(0, 15).trim();
    if (short.length >= 4) pos = lo.indexOf(short);
    return pos;
  }

  if (isIsolated && _IM.chapters && _IM.chapters.length) {
    // ── Mode isolé : chercher dans quel chapitre se trouve la citation ──
    const fullText = (typeof window._joinChapters === 'function')
      ? window._joinChapters(_IM.chapters)
      : _IM.chapters.map(c => (c.title ? c.title + '\n' : '') + c.body).join('\n');

    // Chercher dans chaque chapitre individuellement pour trouver le bon
    let found = false;
    for (let ci = 0; ci < _IM.chapters.length; ci++) {
      const ch = _IM.chapters[ci];
      const chText = (ch.title ? ch.title + '\n' : '') + ch.body;
      const pos = _findIn(chText, needle);
      if (pos >= 0) {
        // Switcher vers ce chapitre si ce n'est pas l'actif
        if (ci !== _IM.activeIdx) {
          if (typeof window.switchToChapter === 'function') window.switchToChapter(ci);
          // Attendre que l'éditeur soit chargé avant de sélectionner
          setTimeout(() => _coherenceSelectInTA(pos, needle.length), 120);
        } else {
          _coherenceSelectInTA(pos, needle.length);
        }
        found = true;
        break;
      }
    }
    if (!found) {
      if (typeof showToast === 'function') showToast('Citation introuvable dans le texte', 2200, 'error');
    }

  } else {
    // ── Mode continu : chercher dans le textarea global ──
    const ta = document.getElementById('raw-input');
    if (!ta) return;
    const pos = _findIn(ta.value, needle);
    if (pos < 0) {
      if (typeof showToast === 'function') showToast('Citation introuvable dans le texte', 2200, 'error');
      return;
    }
    _coherenceSelectInTA(pos, needle.length);
  }
}

function _coherenceSelectInTA(pos, len) {
  const ta = document.getElementById('raw-input');
  if (!ta) return;
  // Basculer vers l'éditeur si on est en prévisualisation pure
  const editBtn = document.getElementById('btn-view-split') || document.getElementById('btn-view-edit');
  if (editBtn && typeof setView === 'function') {
    const editorArea = document.querySelector('.editor-area');
    if (editorArea && editorArea.classList.contains('view-preview')) {
      setView('split');
    }
  }
  ta.focus();
  ta.setSelectionRange(pos, pos + len);
  // Scroller jusqu'à la sélection
  const lineH = parseInt(getComputedStyle(ta).lineHeight) || 20;
  const linesBefore = ta.value.slice(0, pos).split('\n').length;
  ta.scrollTop = Math.max(0, (linesBefore - 4) * lineH);
  if (typeof showToast === 'function') showToast('Citation repérée dans le texte ↗', 1600, 'ok');
}
window._coherenceJumpTo = _coherenceJumpTo;

// ══════════════════════════════════════════════════════════════════════
// 7. MODAL TAGS — HTML injecté dynamiquement
// ══════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  // Injecter la modal tags dans le DOM
  const modal = document.createElement('div');
  modal.id = 'ch-tags-modal';
  modal.innerHTML = `
    <div class="ch-tags-box">
      <h3 data-i18n="tags_modal_title">🏷 Tags du chapitre</h3>
      <input type="text" id="ch-tags-input" class="ch-tags-input" placeholder="POV, Paris, Adrien, action…" data-i18n-placeholder="tags_modal_placeholder" oninput="_tagsPreviewUpdate()">
      <p class="ch-tags-hint" data-i18n="tags_modal_hint">Séparez les tags par des virgules. Ex : POV:Adrien, Paris, action</p>
      <div class="ch-tags-preview" id="ch-tags-preview"></div>
      <div class="ch-tags-btns">
        <button class="aicont-btn" onclick="chTagsCancel()" data-i18n="tags_cancel_btn">Annuler</button>
        <button class="aicont-btn primary" onclick="chTagsSave()" data-i18n="tags_save_btn">Enregistrer</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) chTagsCancel(); });
  document.body.appendChild(modal);

  // Mettre à jour le badge versions au démarrage
  updateVersionsBadge();
});

// ══════════════════════════════════════════════════════════════════════
// 8. i18n — Nouvelles clés (FR / EN / ES)
// ══════════════════════════════════════════════════════════════════════
// Extension des catalogues _i18n existants
if (typeof _i18n !== 'undefined') {
  // ── FRANÇAIS ──
  Object.assign(_i18n.fr || {}, {
    btn_export_epub:       '⬇ ePub',
    toast_generating_epub: 'Génération du fichier ePub…',
    toast_epub_done:       'Fichier ePub (.epub) téléchargé ✓',
    // Versions
    versions_title:        'Versions du chapitre',
    versions_save_btn:     '+ Snapshot',
    versions_hint:         'Sauvegardez des instantanés nommés de votre chapitre actif.',
    versions_select_chapter:'— Choisir un chapitre —',
    versions_empty:        'Aucun snapshot. Cliquez sur + Snapshot pour en créer un.',
    versions_restore_btn:  '↩ Restaurer',
    versions_saved:        'Snapshot enregistré ✓',
    versions_restored:     'Version restaurée ✓',
    versions_select_first: 'Sélectionnez d\'abord un chapitre.',
    versions_no_text:      'Texte du chapitre introuvable.',
    versions_confirm_delete:'Supprimer ce snapshot ?',
    versions_confirm_restore:'Restaurer cette version ? Le texte actuel du chapitre sera remplacé. Cette action est irréversible.',
    versions_label_prompt: 'Nom du snapshot',
    versions_chapter_not_found: 'Chapitre introuvable dans le texte.',
    // Tags
    tags_modal_title:      '🏷 Tags du chapitre',
    tags_modal_placeholder:'POV, Paris, Adrien, action…',
    tags_modal_hint:       'Séparez les tags par des virgules. Ex : POV:Adrien, Paris, action',
    tags_cancel_btn:       'Annuler',
    tags_save_btn:         'Enregistrer',
    // Corkboard
    corkboard_title:       'Vue carte — Roman',
    cork_tag_filter_placeholder: 'Filtrer par tag…',
    cork_empty:            'Aucun chapitre détecté. Collez votre roman dans l\'éditeur.',
    // AI Continue
    title_ai_continue:     'Continuer le texte par IA depuis le curseur (clé requise)',
    ai_continue_title:     '✦ Continuation IA',
    ai_continue_no_context:'Placez le curseur dans votre texte.',
    ai_continue_insert:    '↩ Insérer',
    ai_continue_regen:     '⟳ Régénérer',
    ai_continue_close:     '✕ Fermer',
    ai_continue_inserted:  'Continuation insérée ✓',
    // Cohérence
    btn_coherence:         '🧩 Vérifier la cohérence narrative',
    coherence_sub_hint:    'Personnages · Lieux · Continuité — IA requise',
    wt_empty_coherence:    'Cliquez pour analyser la cohérence de votre roman.',
    title_tab_coherence:   'Cohérence narrative IA',
    // Nav-rail tooltips
    nrb_corkboard_title:   'Vue carte',
    nrb_corkboard_desc:    'Tableau de bord de votre roman — chapitres, statuts, résumés et tags.',
    nrb_versions_title:    'Versions',
    nrb_versions_desc:     'Snapshots nommés de vos chapitres pour suivre l\'évolution de l\'écriture.',
    // Menu contextuel éditeur
    ctx_section_clipboard: 'Presse-papiers',
    ctx_cut:               '✂ Couper',
    ctx_copy:              '⎘ Copier',
    ctx_paste:             '📋 Coller',
    ctx_copy_all:          '📄 Copier tout le texte',
    ctx_section_edit:      'Édition',
    ctx_select_all:        '⬜ Tout sélectionner',
    ctx_undo:              '↩ Annuler',
    ctx_redo:              '↪ Rétablir',
    ctx_section_format:    'Mise en forme',
    ctx_italic:            'I Mettre en italique',
    ctx_bold:              'B Mettre en gras',
    ctx_underline:         'S Souligner',
    ctx_wc_word_s:         '{n} mot',
    ctx_wc_words_pl:       '{n} mots',
    ctx_wc_char_s:         '{n} caractère',
    ctx_wc_chars_pl:       '{n} caractères',
    ctx_section_note:      'Note d\'auteur',
    ctx_add_note:          '💬 Ajouter une note…',
    ctx_section_tools:     'Outils',
    ctx_search_word:       '🔍 Chercher dans le texte',
    ctx_search_word_preview:'🔍 Chercher « {w} »',
    ctx_scene_break:       '— Insérer un saut de scène',
    ctx_image_tag:         '🖼 Insérer une balise image…',
    ctx_toast_pasted:      '📋 Texte collé ({n} car.)',
    ctx_toast_paste_denied:'⚠ Coller avec Ctrl+V — accès presse-papiers refusé',
    ctx_toast_copied_all:  '📄 Texte complet copié ({n} car.)',
  });

  // ── ENGLISH ──
  if (_i18n.en) Object.assign(_i18n.en, {
    btn_export_epub:       '⬇ ePub',
    toast_generating_epub: 'Generating ePub file…',
    toast_epub_done:       'ePub file downloaded ✓',
    versions_title:        'Chapter versions',
    versions_save_btn:     '+ Snapshot',
    versions_hint:         'Save named snapshots of your active chapter.',
    versions_select_chapter:'— Choose a chapter —',
    versions_empty:        'No snapshots yet. Click + Snapshot to create one.',
    versions_restore_btn:  '↩ Restore',
    versions_saved:        'Snapshot saved ✓',
    versions_restored:     'Version restored ✓',
    versions_select_first: 'Please select a chapter first.',
    versions_no_text:      'Chapter text not found.',
    versions_confirm_delete:'Delete this snapshot?',
    versions_confirm_restore:'Restore this version? The current chapter text will be replaced. This is irreversible.',
    versions_label_prompt: 'Snapshot name',
    versions_chapter_not_found: 'Chapter not found in text.',
    tags_modal_title:      '🏷 Chapter tags',
    tags_modal_placeholder:'POV, London, Adrian, action…',
    tags_modal_hint:       'Separate tags with commas. E.g.: POV:Adrian, London, action',
    tags_cancel_btn:       'Cancel',
    tags_save_btn:         'Save',
    corkboard_title:       'Novel overview',
    cork_tag_filter_placeholder: 'Filter by tag…',
    cork_empty:            'No chapters detected. Paste your novel in the editor.',
    title_ai_continue:     'Continue text with AI from cursor (key required)',
    ai_continue_title:     '✦ AI Continuation',
    ai_continue_no_context:'Place the cursor in your text.',
    ai_continue_insert:    '↩ Insert',
    ai_continue_regen:     '⟳ Regenerate',
    ai_continue_close:     '✕ Close',
    ai_continue_inserted:  'Continuation inserted ✓',
    btn_coherence:         '🧩 Check narrative consistency',
    coherence_sub_hint:    'Characters · Locations · Continuity — AI required',
    wt_empty_coherence:    'Click to analyze your novel\'s consistency (characters, locations, continuity).',
    title_tab_coherence:   'Narrative consistency AI',
    nrb_corkboard_title:   'Novel overview',
    nrb_corkboard_desc:    'Dashboard for your novel — chapters, statuses, summaries and tags.',
    nrb_versions_title:    'Versions',
    nrb_versions_desc:     'Named snapshots of your chapters to track writing progress.',
    // Editor context menu
    ctx_section_clipboard: 'Clipboard',
    ctx_cut:               '✂ Cut',
    ctx_copy:              '⎘ Copy',
    ctx_paste:             '📋 Paste',
    ctx_copy_all:          '📄 Copy all text',
    ctx_section_edit:      'Edit',
    ctx_select_all:        '⬜ Select all',
    ctx_undo:              '↩ Undo',
    ctx_redo:              '↪ Redo',
    ctx_section_format:    'Format',
    ctx_italic:            'I Italic',
    ctx_bold:              'B Bold',
    ctx_underline:         'S Underline',
    ctx_wc_word_s:         '{n} word',
    ctx_wc_words_pl:       '{n} words',
    ctx_wc_char_s:         '{n} character',
    ctx_wc_chars_pl:       '{n} characters',
    ctx_section_note:      'Author note',
    ctx_add_note:          '💬 Add a note…',
    ctx_section_tools:     'Tools',
    ctx_search_word:       '🔍 Search in text',
    ctx_search_word_preview:'🔍 Search « {w} »',
    ctx_scene_break:       '— Insert scene break',
    ctx_image_tag:         '🖼 Insert image tag…',
    ctx_toast_pasted:      '📋 Text pasted ({n} chars.)',
    ctx_toast_paste_denied:'⚠ Use Ctrl+V to paste — clipboard access denied',
    ctx_toast_copied_all:  '📄 Full text copied ({n} chars.)',
  });

  // ── ESPAÑOL ──
  if (_i18n.es) Object.assign(_i18n.es, {
    btn_export_epub:       '⬇ ePub',
    toast_generating_epub: 'Generando archivo ePub…',
    toast_epub_done:       'Archivo ePub descargado ✓',
    versions_title:        'Versiones del capítulo',
    versions_save_btn:     '+ Snapshot',
    versions_hint:         'Guarda instantáneas nombradas de tu capítulo activo.',
    versions_select_chapter:'— Elegir un capítulo —',
    versions_empty:        'Sin snapshots. Haz clic en + Snapshot para crear uno.',
    versions_restore_btn:  '↩ Restaurar',
    versions_saved:        'Snapshot guardado ✓',
    versions_restored:     'Versión restaurada ✓',
    versions_select_first: 'Selecciona primero un capítulo.',
    versions_no_text:      'Texto del capítulo no encontrado.',
    versions_confirm_delete:'¿Eliminar este snapshot?',
    versions_confirm_restore:'¿Restaurar esta versión? El texto actual del capítulo será reemplazado. Esto es irreversible.',
    versions_label_prompt: 'Nombre del snapshot',
    versions_chapter_not_found: 'Capítulo no encontrado en el texto.',
    tags_modal_title:      '🏷 Tags del capítulo',
    tags_modal_placeholder:'POV, Madrid, Adrián, acción…',
    tags_modal_hint:       'Separa los tags con comas.',
    tags_cancel_btn:       'Cancelar',
    tags_save_btn:         'Guardar',
    corkboard_title:       'Vista tablero',
    cork_tag_filter_placeholder: 'Filtrar por tag…',
    cork_empty:            'No se detectaron capítulos.',
    title_ai_continue:     'Continuar el texto con IA desde el cursor (clave requerida)',
    ai_continue_title:     '✦ Continuación IA',
    ai_continue_no_context:'Coloca el cursor en tu texto.',
    ai_continue_insert:    '↩ Insertar',
    ai_continue_regen:     '⟳ Regenerar',
    ai_continue_close:     '✕ Cerrar',
    ai_continue_inserted:  'Continuación insertada ✓',
    btn_coherence:         '🧩 Verificar coherencia narrativa',
    coherence_sub_hint:    'Personajes · Lugares · Continuidad — IA requerida',
    wt_empty_coherence:    'Haz clic para analizar la coherencia de tu novela.',
    title_tab_coherence:   'Coherencia narrativa IA',
    nrb_corkboard_title:   'Vista tablero',
    nrb_corkboard_desc:    'Panel de tu novela — capítulos, estados, resúmenes y tags.',
    nrb_versions_title:    'Versiones',
    nrb_versions_desc:     'Instantáneas de tus capítulos para seguir la evolución.',
    // Menú contextual del editor
    ctx_section_clipboard: 'Portapapeles',
    ctx_cut:               '✂ Cortar',
    ctx_copy:              '⎘ Copiar',
    ctx_paste:             '📋 Pegar',
    ctx_copy_all:          '📄 Copiar todo el texto',
    ctx_section_edit:      'Edición',
    ctx_select_all:        '⬜ Seleccionar todo',
    ctx_undo:              '↩ Deshacer',
    ctx_redo:              '↪ Rehacer',
    ctx_section_format:    'Formato',
    ctx_italic:            'I Cursiva',
    ctx_bold:              'N Negrita',
    ctx_underline:         'S Subrayar',
    ctx_wc_word_s:         '{n} palabra',
    ctx_wc_words_pl:       '{n} palabras',
    ctx_wc_char_s:         '{n} carácter',
    ctx_wc_chars_pl:       '{n} caracteres',
    ctx_section_note:      'Nota del autor',
    ctx_add_note:          '💬 Agregar una nota…',
    ctx_section_tools:     'Herramientas',
    ctx_search_word:       '🔍 Buscar en el texto',
    ctx_search_word_preview:'🔍 Buscar « {w} »',
    ctx_scene_break:       '— Insertar separador de escena',
    ctx_image_tag:         '🖼 Insertar etiqueta de imagen…',
    ctx_toast_pasted:      '📋 Texto pegado ({n} car.)',
    ctx_toast_paste_denied:'⚠ Usa Ctrl+V para pegar — acceso al portapapeles denegado',
    ctx_toast_copied_all:  '📄 Texto completo copiado ({n} car.)',
  });

  // Re-appliquer les traductions si déjà chargées
  if (typeof applyI18n === 'function') {
    try { applyI18n(typeof getPref === 'function' ? getPref('ui_lang') || 'fr' : 'fr'); } catch(e) {}
  }
}

// Compat: sauvegarder/restaurer les tags dans saveProject / applyProjectData
// Patch de collectChapterMeta pour inclure les tags (déjà inclus via chGetMeta qui stocke tags)

// Appliquer les traductions sur les éléments dynamiques après init i18n
document.addEventListener('atelier:ready', function() {
  _updateNavBtns();
  _pomoRefreshUI();
  setTimeout(_updateBreadcrumb, 600);
  updateVersionsBadge();
});




// ══════════════════════════════════════════════════════════════════════════════
//  AUTOCORRECT ENGINE v1.0 — Atelier Édition
//  Architecture : LanguageRules | TypographicEngine | SafeCorrectionEngine | ACPrefs
//  Entièrement local, sans IA, sans cloud, sans réécriture stylistique.
// ══════════════════════════════════════════════════════════════════════════════

const AC_STORAGE_KEY = 'atelier_autocorrect_prefs';

// ── DEFAULT PREFERENCES ────────────────────────────────────────────────────
const AC_DEFAULT_PREFS = {
  enabled:        true,
  lang:           'fr',
  capitals:       true,
  dblSpaces:      true,
  trailingSpaces: true,
  apostrophes:    true,
  quotes:         true,
  punctuation:    true,
  repetitions:    true,
  ellipsis:       true,
  pluralVerb:     true,
  pluralAdj:      true,
  pluralNoun:     true,
  spell:          true,   // correction orthographique lexicale
  participes:     true,   // correction des participes passés (auxiliaire avoir)
};

// ── ACPrefs : gestionnaire de préférences ─────────────────────────────────
const ACPrefs = (() => {
  let _cache = null;

  function load() {
    if (_cache) return _cache;
    try {
      const raw = localStorage.getItem(AC_STORAGE_KEY);
      _cache = raw ? { ...AC_DEFAULT_PREFS, ...JSON.parse(raw) } : { ...AC_DEFAULT_PREFS };
    } catch(e) { _cache = { ...AC_DEFAULT_PREFS }; }
    return _cache;
  }

  function get(key) { return load()[key] ?? AC_DEFAULT_PREFS[key]; }

  function set(key, value) {
    _cache = null;
    const p = load();
    p[key] = value;
    _cache = p;
    try { localStorage.setItem(AC_STORAGE_KEY, JSON.stringify(p)); } catch(e) {}
    SafeCorrectionEngine.onPrefsChange();
  }

  function refreshUI() {
    const p = load();
    const map = {
      'ac-enabled':         p.enabled,
      'ac-capitals':        p.capitals,
      'ac-dbl-spaces':      p.dblSpaces,
      'ac-trailing-spaces': p.trailingSpaces,
      'ac-apostrophes':     p.apostrophes,
      'ac-quotes':          p.quotes,
      'ac-punctuation':     p.punctuation,
      'ac-repetitions':     p.repetitions,
      'ac-ellipsis':        p.ellipsis,
      'ac-plural-verb':     p.pluralVerb,
      'ac-plural-adj':      p.pluralAdj,
      'ac-plural-noun':     p.pluralNoun,
      'ac-spell':           p.spell,
      'ac-participes':      p.participes,
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    });
    // La langue de correction est pilotée par le sélecteur de langue du projet (pref-ui-langue)
    // On passe par set() pour invalider le cache correctement et déclencher onPrefsChange()
    const uiLang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
    if (uiLang !== p.lang) {
      // set() invalide _cache et sauvegarde — pas de mutation directe
      set('lang', uiLang);
      // Recharger p après le set pour que les lignes suivantes voient la valeur à jour
      const p2 = load();
      const sub = document.getElementById('ac-suboptions');
      if (sub) sub.style.opacity = p2.enabled ? '1' : '0.45';
      if (sub) sub.style.pointerEvents = p2.enabled ? '' : 'none';
      _updateBadge(p2.enabled);
      return;
    }
    const sub = document.getElementById('ac-suboptions');
    if (sub) sub.style.opacity = p.enabled ? '1' : '0.45';
    if (sub) sub.style.pointerEvents = p.enabled ? '' : 'none';
    _updateBadge(p.enabled);
  }

  function _updateBadge(active) {
    const badge = document.getElementById('ac-status-badge');
    if (!badge) return;
    badge.classList.toggle('active', !!active);
    badge.classList.add('visible');
    badge.title = active ? 'Correction automatique active' : 'Correction automatique désactivée';
    badge.querySelector('.ac-badge-txt').textContent = active ? 'Auto' : 'Off';
  }

  return { load, get, set, refreshUI };
})();

// ── LanguageRules : règles par langue ─────────────────────────────────────
const LanguageRules = {
  fr: {
    // Guillemets : « espace »
    openQuote:  '\u00ab\u202f',
    closeQuote: '\u202f\u00bb',
    // Ponctuation : espace insécable avant : ; ! ?
    // Normalisation : pas d'espace AVANT la virgule/point, espace APRES
    punctSpaceBefore: /([^!\?\:;,\s])([\!\?\:;])/g,
    punctSpaceBeforeReplace: '$1\u202f$2',
    punctNoSpaceBefore: /\s+([,\.])/g,
    punctNoSpaceBeforeReplace: '$1',
    punctSpaceAfter: /([,\.;!\?])([^\s\n\)\]\»"'])/g,
    punctSpaceAfterReplace: '$1 $2',
    // Pas d'espace insécable pour la virgule/point
    highPunct: ['!', '?', ':', ';'],
    // Répétitions : mots courants courts
    dupWords: /\b(le|la|les|de|du|un|une|des|et|en|à|au|aux|je|tu|il|elle|on|nous|vous|ils|elles|ce|se|sa|son|ses|mon|ton|ma|ta|me|te|que|qui|ne|y|si|ou|car|or|ni|mais|donc)\s+\1\b/gi,
  },
  en: {
    openQuote:  '\u201c',
    closeQuote: '\u201d',
    punctSpaceBefore: /([^!\?\:;,\s])([\!\?\:;])/g,
    punctSpaceBeforeReplace: null, // EN : pas d'espace avant !?
    punctNoSpaceBefore: /\s+([\!\?\:;,\.])/g,
    punctNoSpaceBeforeReplace: '$1',
    punctSpaceAfter: /([,\.;!\?])([^\s\n\)\]\u201d"'])/g,
    punctSpaceAfterReplace: '$1 $2',
    highPunct: [],
    dupWords: /\b(the|a|an|of|in|on|at|to|for|and|but|or|nor|so|yet|as|it|is|was|are|be|I|he|she|we|they|my|your|his|her|its|our|this|that|these|those|with|by|from)\s+\1\b/gi,
  },
  es: {
    openQuote:  '\u00ab',
    closeQuote: '\u00bb',
    punctSpaceBefore: /([^!\?\:;,\s])([\!\?\:;])/g,
    punctSpaceBeforeReplace: null,
    punctNoSpaceBefore: /\s+([\!\?\:;,\.])/g,
    punctNoSpaceBeforeReplace: '$1',
    punctSpaceAfter: /([,\.;!\?])([^\s\n\)\]\u00bb"'])/g,
    punctSpaceAfterReplace: '$1 $2',
    highPunct: [],
    dupWords: /\b(el|la|los|las|de|del|un|una|unos|unas|y|en|a|al|que|se|es|su|sus|me|te|le|lo|nos|con|por|para|pero|si|o|ni)\s+\1\b/gi,
  },
};


// ── PluralEngine : accord pluriel (FR / EN / ES) ──────────────────────────────
// Trois corrections indépendantes :
//   1. applyNounPlural  : "des chat"   → "des chats"   / "les fleur" → "les fleurs"
//   2. applyPluralVerb  : "ils travail"→ "ils travaillent" / "les chats mange" → "mangent"
//   3. applyPluralAdj   : "des chats noir" → "des chats noirs"
const PluralEngine = (() => {

  // ── Déterminants pluriels ──────────────────────────────────────────────────
  const DET_PLUR_FR = '(?:les|des|ces|mes|tes|ses|nos|vos|leurs|tous|toutes|plusieurs|quelques|certains|certaines|aux)';
  const DET_PLUR_EN = '(?:the|these|those|some|many|few|several|all|both|our|your|their|my)';
  const DET_PLUR_ES = '(?:los|las|unos|unas|estos|estas|esos|esas|aquellos|aquellas|mis|tus|sus|nuestros|nuestras|vuestros|vuestras|varios|varias|algunos|algunas|muchos|muchas|pocos|pocas|todos|todas)';

  // ── Pronoms sujets pluriels ────────────────────────────────────────────────
  // FR
  const PRON_PLUR_FR = /^(?:ils|elles|nous|vous|on)$/i;
  // EN
  const PRON_PLUR_EN = /^(?:they|we|you)$/i;
  // ES
  const PRON_PLUR_ES = /^(?:ellos|ellas|nosotros|nosotras|vosotros|vosotras|ustedes)$/i;

  // ══════════════════════════════════════════════════════════════════════════
  // 1. ACCORD NOMINAL : "des chat" → "des chats"
  // ══════════════════════════════════════════════════════════════════════════

  // Exceptions : mots invariables ou déjà pluriels implicites
  const NOUN_INVARIABLE_FR = new Set([
    'bras','bois','bois','corps','cours','fois','fois','mois','pays','poids',
    'pois','prix','puits','repas','secours','sens','temps','voix','voix',
    'nez','rez','nez','flux','choix','noix','paix','croix','nuix',
    'os','bus','virus','campus','plus','moins','très','mais','dans','sous',
    'tous','nous','vous','ils','elles','leurs','ces','mes','tes','ses','aux',
    'des','les','quelques','plusieurs','certains','certaines',
    'après','avant','avec','sans','pour','par','sur','sous','vers',
  ]);

  function applyNounPlural(text, lang) {
    if (lang === 'en' || lang === 'es') return text; // EN/ES : accord nominal complexe, non traité
    // FR uniquement
    const det = DET_PLUR_FR;
    // Pattern : déterminant pluriel + NOM qui ne finit pas par s/x/z
    const re = new RegExp(
      '\\b(' + det + ')\\s+([a-zA-Z\u00C0-\u017E]{3,})\\b',
      'gi'
    );
    return text.replace(re, (m, d, noun) => {
      // Déjà au pluriel ?
      if (/[sxz]$/i.test(noun)) return m;
      // Invariable ?
      if (NOUN_INVARIABLE_FR.has(noun.toLowerCase())) return m;
      // Mot trop court (articles, prépositions captées malgré le look-ahead)
      if (noun.length <= 2) return m;
      // Verbes conjugués communs qui ne doivent pas être touchés
      if (/(?:ent|ons|ez|ant|ment|ait|aient|erait|eraient|ais|aient)$/i.test(noun)) return m;
      // Terminaison -au → -aux, -al → -aux, -eu → -eux
      if (/eau$/i.test(noun)) return d + ' ' + noun + 'x';
      if (/au$/i.test(noun) && noun.length > 3) return d + ' ' + noun + 'x';
      if (/eu$/i.test(noun) && !/(bleu|pneu)$/i.test(noun)) return d + ' ' + noun + 'x';
      // Cas standard : +s
      return d + ' ' + noun + 's';
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. ACCORD VERBE : "ils travail" → "ils travaillent" / "les chats mange" → "mangent"
  // ══════════════════════════════════════════════════════════════════════════

  // FR : table sing → plur (3e pers.)
  const VERB_FR = {
    'mange':'mangent','parle':'parlent','arrive':'arrivent','pousse':'poussent',
    'court':'courent','pense':'pensent','reste':'restent','entre':'entrent',
    'tombe':'tombent','chante':'chantent','marche':'marchent','joue':'jouent',
    'aime':'aiment','regarde':'regardent','écoute':'écoutent','cherche':'cherchent',
    'trouve':'trouvent','donne':'donnent','porte':'portent','monte':'montent',
    'descend':'descendent','attend':'attendent','répond':'répondent',
    'prend':'prennent','vend':'vendent','perd':'perdent','tient':'tiennent',
    'vient':'viennent','devient':'deviennent','revient':'reviennent',
    'sort':'sortent','dort':'dorment','part':'partent','sert':'servent',
    'lit':'lisent','écrit':'écrivent','dit':'disent','fait':'font',
    'voit':'voient','croit':'croient','boit':'boivent','reçoit':'reçoivent',
    'sait':'savent','peut':'peuvent','doit':'doivent','veut':'veulent',
    'va':'vont','est':'sont','a':'ont','met':'mettent','bat':'battent',
    'suit':'suivent','vit':'vivent','rit':'rient','souffre':'souffrent',
    'ouvre':'ouvrent','offre':'offrent','couvre':'couvrent',
    'grandit':'grandissent','finit':'finissent','choisit':'choisissent',
    'réussit':'réussissent','ralentit':'ralentissent','grossit':'grossissent',
    'rougit':'rougissent','obéit':'obéissent','bâtit':'bâtissent',
    'applique':'appliquent','avance':'avancent','lance':'lancent',
    'commence':'commencent','place':'placent','trace':'tracent',
    'annonce':'annoncent','prononce':'prononcent','renonce':'renoncent',
    'refuse':'refusent','accuse':'accusent','habite':'habitent',
    'invite':'invitent','quitte':'quittent','évite':'évitent',
    'profite':'profitent','mérite':'méritent','limite':'limitent',
    'compte':'comptent','affronte':'affrontent','domine':'dominent',
    'examine':'examinent','illumine':'illuminent','imagine':'imaginent',
    'termine':'terminent','détermine':'déterminent','semble':'semblent',
    'ressemble':'ressemblent','tremble':'tremblent','trouble':'troublent',
    'double':'doublent','rentre':'rentrent','travaille':'travaillent',
    'paye':'payent','essaye':'essayent','envoie':'envoient',
    'nettoie':'nettoient','emploie':'emploient',
    'appelle':'appellent','rappelle':'rappellent','jette':'jettent',
    'tourne':'tournent','pleure':'pleurent',
    'demeure':'demeurent','améliore':'améliorent','explore':'explorent',
    'ignore':'ignorent','adore':'adorent','dévore':'dévorent',
    'parcoure':'parcourent','découvre':'découvrent','recouvre':'recouvrent',
  };

  // Note : VERB_RADICAL_FR et VERB_INF_TO_PLUR_FR supprimées (tables jamais utilisées)

  // EN : sing → base
  const VERB_EN = {
    'runs':'run','walks':'walk','talks':'talk','eats':'eat','drinks':'drink',
    'sleeps':'sleep','wakes':'wake','writes':'write','reads':'read',
    'thinks':'think','knows':'know','feels':'feel','sees':'see',
    'hears':'hear','says':'say','goes':'go','does':'do','has':'have',
    'gets':'get','makes':'make','takes':'take','gives':'give',
    'comes':'come','becomes':'become','looks':'look','seems':'seem',
    'wants':'want','needs':'need','tries':'try','works':'work',
    'plays':'play','lives':'live','loves':'love','hates':'hate',
    'likes':'like','finds':'find','leaves':'leave','starts':'start',
    'stops':'stop','shows':'show','tells':'tell','asks':'ask',
    'moves':'move','turns':'turn','falls':'fall','stands':'stand',
    'waits':'wait','calls':'call','helps':'help','puts':'put',
    'keeps':'keep','holds':'hold','brings':'bring','begins':'begin',
    'ends':'end','opens':'open','closes':'close','follows':'follow',
    'watches':'watch','listens':'listen','laughs':'laugh','cries':'cry',
    'sits':'sit','lies':'lie','rises':'rise','sets':'set',
    'leads':'lead','grows':'grow','draws':'draw','builds':'build',
    'kills':'kill','hits':'hit','wins':'win','loses':'lose',
    'sends':'send','receives':'receive','carries':'carry','drops':'drop',
    'catches':'catch','throws':'throw','jumps':'jump','flies':'fly',
    'drives':'drive','meets':'meet','beats':'beat','breaks':'break',
    'wears':'wear','reaches':'reach','enters':'enter','returns':'return',
    'remembers':'remember','forgets':'forget','believes':'believe',
    'decides':'decide','chooses':'choose','allows':'allow','creates':'create',
  };

  // ES : sing → plur
  const VERB_ES = {
    'habla':'hablan','come':'comen','vive':'viven','corre':'corren',
    'llega':'llegan','sale':'salen','entra':'entran','sube':'suben',
    'baja':'bajan','trabaja':'trabajan','juega':'juegan','canta':'cantan',
    'escucha':'escuchan','mira':'miran','busca':'buscan',
    'encuentra':'encuentran','da':'dan','toma':'toman','deja':'dejan',
    'lleva':'llevan','trae':'traen','viene':'vienen','va':'van',
    'está':'están','tiene':'tienen','hace':'hacen','dice':'dicen',
    'sabe':'saben','puede':'pueden','quiere':'quieren','debe':'deben',
    'pone':'ponen','ve':'ven','lee':'leen','escribe':'escriben',
    'piensa':'piensan','siente':'sienten','cree':'creen',
    'sigue':'siguen','abre':'abren','cierra':'cierran','cambia':'cambian',
    'parece':'parecen','necesita':'necesitan','ayuda':'ayudan','espera':'esperan',
    'pregunta':'preguntan','responde':'responden','empieza':'empiezan',
    'termina':'terminan','recibe':'reciben','mueve':'mueven','cae':'caen',
    'ríe':'ríen','llora':'lloran','duerme':'duermen','despierta':'despiertan',
    'compra':'compran','vende':'venden','gana':'ganan','pierde':'pierden',
  };

  function _preserveCase(original, replacement) {
    if (!original || !replacement) return replacement;
    const isUpper = original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase();
    return isUpper ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
  }

  // ── Pré-compilation des tables de verbes (effectuée UNE seule fois au chargement) ──
  // Chaque entrée → { re: RegExp, plur: string }
  function _compileVerbTable(table, subjRe) {
    return Object.entries(table).map(([sing, plur]) => ({
      re: new RegExp('\\b(' + subjRe + ')\\s+(' + sing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'gi'),
      plur,
    }));
  }

  // Tables compilées (pronom pluriel) — créées à l'initialisation du module
  const _VERB_FR_PRON_COMPILED  = _compileVerbTable(VERB_FR, '(?:ils|elles|nous|vous|on)');
  const _VERB_EN_PRON_COMPILED  = _compileVerbTable(VERB_EN, '(?:they|we|you)');
  const _VERB_ES_PRON_COMPILED  = _compileVerbTable(VERB_ES, '(?:ellos|ellas|nosotros|nosotras|vosotros|vosotras|ustedes)');

  // Tables compilées (sujet nominal pluriel FR)
  const _VERB_FR_NOM_COMPILED = Object.entries(VERB_FR).map(([sing, plur]) => ({
    re: new RegExp(
      '\\b(' + DET_PLUR_FR + '(?:\\s+[a-zA-Z\u00C0-\u017E]+){1,3})\\s+(' +
      sing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'gi'),
    plur,
  }));
  const _VERB_EN_NOM_COMPILED = Object.entries(VERB_EN).map(([sing, plur]) => ({
    re: new RegExp(
      '\\b(' + DET_PLUR_EN + '(?:\\s+[a-zA-Z]+){1,2})\\s+(' +
      sing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'gi'),
    plur,
  }));
  const _VERB_ES_NOM_COMPILED = Object.entries(VERB_ES).map(([sing, plur]) => ({
    re: new RegExp(
      '\\b(' + DET_PLUR_ES + '(?:\\s+[a-zA-Z\u00C0-\u017E]+){1,3})\\s+(' +
      sing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'gi'),
    plur,
  }));

  /** Applique une table pré-compilée (pronom fixe) */
  function _applyVerbTable(text, compiled) {
    let result = text;
    for (const { re, plur } of compiled) {
      re.lastIndex = 0; // reset car flag g
      result = result.replace(re, (m, subj, v) => subj + ' ' + _preserveCase(v, plur));
    }
    return result;
  }

  function _applyPluralVerbFR(text) {
    // Pattern 1 : pronom pluriel + verbe non accordé (table pré-compilée)
    let result = _applyVerbTable(text, _VERB_FR_PRON_COMPILED);
    // Pattern 2 : déterminant + NOM pluriel(s/x) + verbe non accordé (sujet nominal)
    for (const { re, plur } of _VERB_FR_NOM_COMPILED) {
      re.lastIndex = 0;
      result = result.replace(re, (m, subj, v) => {
        const lastWord = subj.trim().split(/\s+/).pop();
        // Condition resserrée : le dernier mot doit finir par s ou x (marque pluriel)
        // et avoir au moins 4 caractères pour éviter les articles/déterminants courts
        if (/[sx]$/i.test(lastWord) && lastWord.length >= 4) {
          return subj + ' ' + _preserveCase(v, plur);
        }
        return m;
      });
    }
    return result;
  }

  function _applyPluralVerbEN(text) {
    let result = _applyVerbTable(text, _VERB_EN_PRON_COMPILED);
    // Sujet nominal pluriel
    for (const { re, plur } of _VERB_EN_NOM_COMPILED) {
      re.lastIndex = 0;
      result = result.replace(re, (m, subj, v) => {
        const lastWord = subj.trim().split(/\s+/).pop();
        if (/[sx]$/i.test(lastWord)) return subj + ' ' + _preserveCase(v, plur);
        return m;
      });
    }

    // ── Corrections supplémentaires EN ─────────────────────────────────────
    result = result.replace(/\b(they)\s+is\b/gi, (m, p) => p + ' are');
    result = result.replace(/\b(they)\s+was\b/gi, (m, p) => p + ' were');
    result = result.replace(/\b(we|you)\s+is\b/gi, (m, p) => p + ' are');
    result = result.replace(/\b(i)\s+has\b/gi, (m, p) => p + ' have');
    result = result.replace(/\bdon't\s+thinks\b/gi, "don't think");
    result = result.replace(/\bdoesn't\s+think\b/gi, "doesn't think");
    result = result.replace(/\b(she|he|it)\s+don't\b/gi, (m, p) => p + " doesn't");
    result = result.replace(/\b(i|they|we|you)\s+doesn't\b/gi, (m, p) => p + " don't");

    return result;
  }

  function _applyPluralVerbES(text) {
    let result = _applyVerbTable(text, _VERB_ES_PRON_COMPILED);
    for (const { re, plur } of _VERB_ES_NOM_COMPILED) {
      re.lastIndex = 0;
      result = result.replace(re, (m, subj, v) => {
        const lastWord = subj.trim().split(/\s+/).pop();
        if (/[sx]$/i.test(lastWord) && lastWord.length >= 4) return subj + ' ' + _preserveCase(v, plur);
        return m;
      });
    }

    // ── Corrections supplémentaires ES ─────────────────────────────────────
    result = result.replace(/\b(yo)\s+tiene\b/gi, (m, p) => p + ' tengo');
    result = result.replace(/\b(yo)\s+cree\b/gi, (m, p) => p + ' creo');
    result = result.replace(/\b(yo)\s+va\b/gi, (m, p) => p + ' voy');
    result = result.replace(/\b(ellos|ellas|ustedes)\s+va\b/gi, (m, p) => p + ' van');
    result = result.replace(/\b(ellos|ellas|ustedes)\s+esta\b/gi, (m, p) => p + ' están');
    result = result.replace(/\b(ellos|ellas|ustedes)\s+está\b/gi, (m, p) => p + ' están');
    result = result.replace(/\b(la\s+\w+)\s+son\b/gi, (m, subj) => subj + ' es');
    result = result.replace(/\b(nosotros|nosotras)\s+es\b/gi, (m, p) => p + ' somos');
    result = result.replace(/\b(ellos|ellas|ustedes)\s+vive\b/gi, (m, p) => p + ' viven');

    return result;
  }

  function applyPluralVerb(text, lang) {
    if (lang === 'en') return _applyPluralVerbEN(text);
    if (lang === 'es') return _applyPluralVerbES(text);
    return _applyPluralVerbFR(text);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. ACCORD ADJECTIF : "des chats noir" → "des chats noirs"
  // ══════════════════════════════════════════════════════════════════════════

  const ADJ_AL_FR = [
    'général','local','national','régional','total','brutal','central','final',
    'fatal','global','légal','loyal','moral','normal','oral','royal','social',
    'spécial','tribal','vital','amical','banal','cardinal','médical','musical',
    'nominal','original','principal','théâtral','horizontal','vertical',
    'littéral','magistral','monumental','architectural','sentimental',
    'instrumental','matrimonial','familial','filial','cordial','trivial',
    'provincial','commercial','artisanal','environnemental',
    'intellectuel','professionnel','conventionnel','traditionnel','exceptionnel',
  ];

  function _applyPluralAdjFR(text) {
    let result = text;
    // -al → -aux
    for (const adj of ADJ_AL_FR) {
      const esc = adj.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(
        '(' + DET_PLUR_FR + '(?:\\s+[a-zA-Z\u00C0-\u017E]+){1,2}\\s+)(' + esc + ')\\b(?![sx]|ux)',
        'gi'
      );
      result = result.replace(re, (m, pre, a) => pre + a.slice(0, -2) + 'aux');
    }
    // Cas général : det + NOM-s/x + ADJ sans -s
    const reAdj = new RegExp(
      '\\b(' + DET_PLUR_FR + '\\s+[a-zA-Z\u00C0-\u017E]*[sx]\\s+)([a-zA-Z\u00C0-\u017E]{3,}[b-df-hj-lp-rt-vz])\\b',
      'gi'
    );
    result = result.replace(reAdj, (m, pre, adj) => {
      if (/[sxz]$/i.test(adj)) return m;
      if (/(?:nt|ment|ant|ons|ez|er|ir|oir|re)$/i.test(adj)) return m;
      return pre + adj + 's';
    });
    return result;
  }

  function _applyPluralAdjES(text) {
    let result = text;
    const reAdj = new RegExp(
      '\\b(' + DET_PLUR_ES + '\\s+[a-zA-Z\u00C0-\u017E]*[os]\\s+)([a-zA-Z\u00C0-\u017E]{3,}[oa])\\b',
      'gi'
    );
    result = result.replace(reAdj, (m, pre, adj) => {
      if (/[s]$/i.test(adj)) return m;
      return pre + adj + 's';
    });
    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. ACCORD EN GENRE (FR) : "la chaussure noir" → "la chaussure noire"
  //                           "le lapin blanche" → "le lapin blanc"
  // ══════════════════════════════════════════════════════════════════════════

  // Déterminants singuliers féminins
  const DET_FEM_FR = '(?:la|une|cette|ma|ta|sa|quelle)';
  // Déterminants singuliers masculins (notre/votre/leur exclus car ambigus masc/fém)
  const DET_MASC_FR = '(?:le|un|ce|mon|ton|son|quel)';

  // Table adjectifs : [masculin, féminin]
  const ADJ_GENDER_FR = [
    ['noir','noire'],['blanc','blanche'],['bleu','bleue'],['rouge','rouge'],
    ['vert','verte'],['grand','grande'],['petit','petite'],['gros','grosse'],
    ['fort','forte'],['court','courte'],['long','longue'],['bon','bonne'],
    ['beau','belle'],['nouveau','nouvelle'],['vieux','vieille'],
    ['froid','froide'],['chaud','chaude'],['lourd','lourde'],['léger','légère'],
    ['rapide','rapide'],['lent','lente'],['doux','douce'],['dur','dure'],
    ['plein','pleine'],['vide','vide'],['clair','claire'],['sombre','sombre'],
    ['seul','seule'],['tel','telle'],['pareil','pareille'],['vieil','vieille'],
    ['actuel','actuelle'],['réel','réelle'],['cruel','cruelle'],['nul','nulle'],
    ['heureux','heureuse'],['malheureux','malheureuse'],['sérieux','sérieuse'],
    ['curieux','curieuse'],['furieux','furieuse'],['nerveux','nerveuse'],
    ['généreux','généreuse'],['dangereux','dangereuse'],['amoureux','amoureuse'],
    ['propre','propre'],['sale','sale'],['libre','libre'],['triste','triste'],
    ['sage','sage'],['belle','belle'],
    // Couleurs
    ['marron','marron'],['rose','rose'],['orange','orange'],['beige','beige'],
    ['violet','violette'],['gris','grise'],['jaune','jaune'],
    // Nationaux/ethniques fréquents
    ['français','française'],['anglais','anglaise'],['espagnol','espagnole'],
    ['algérien','algérienne'],['marocain','marocaine'],['tunisien','tunisienne'],
    ['américain','américaine'],['africain','africaine'],['européen','européenne'],
    ['italien','italienne'],['mexicain','mexicaine'],['canadien','canadienne'],
  ];

  function _applyGenderAdjFR(text) {
    let result = text;
    for (const [masc, fem] of ADJ_GENDER_FR) {
      if (masc === fem) continue; // invariable, rien à faire
      const escMasc = masc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escFem  = fem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Cas 1 : déterminant féminin + NOM + adjectif masculin → féminin
      // ex. "la chaussure noir" → "la chaussure noire"
      const reMascAfterFem = new RegExp(
        '\\b(' + DET_FEM_FR + '(?:\\s+[a-zA-ZÀ-ÿ]+){1,2}\\s+)(' + escMasc + ')\\b',
        'gi'
      );
      result = result.replace(reMascAfterFem, (m, pre, adj) => {
        // Vérifier que l'adjectif n'est pas déjà au féminin
        const lower = adj.toLowerCase();
        if (lower === fem) return m;
        return pre + _preserveCase(adj, fem);
      });

      // Cas 2 : déterminant masculin + NOM + adjectif féminin → masculin
      // ex. "le lapin blanche" → "le lapin blanc"
      const reFemAfterMasc = new RegExp(
        '\\b(' + DET_MASC_FR + '(?:\\s+[a-zA-ZÀ-ÿ]+){1,2}\\s+)(' + escFem + ')\\b(?!s\\b)',
        'gi'
      );
      result = result.replace(reFemAfterMasc, (m, pre, adj) => {
        const lower = adj.toLowerCase();
        // Ne corriger que si le adj est clairement au féminin (différent du masculin)
        if (lower === masc) return m;
        if (fem === masc) return m;
        return pre + _preserveCase(adj, masc);
      });
    }
    return result;
  }

  function applyPluralAdj(text, lang) {
    if (lang === 'en') return text; // EN adj invariable
    if (lang === 'es') return _applyPluralAdjES(text);
    // FR : pluriel + genre
    let result = _applyPluralAdjFR(text);
    result = _applyGenderAdjFR(result);
    return result;
  }

  return { applyNounPlural, applyPluralVerb, applyPluralAdj };
})();


// ── SpellEngine : corrections orthographiques lexicales (FR/EN/ES) ──────────
const SpellEngine = {
  // Dictionnaire FR : forme incorrecte → forme correcte (minuscules)
  _dict_fr: {
    // Accents manquants / mauvais
    'regler':'régler','reglement':'règlement','reglements':'règlements',
    'regie':'régie','regle':'règle','regles':'règles','reglons':'réglons',
    'probleme':'problème','problemes':'problèmes',
    'systeme':'système','systemes':'systèmes',
    'poeme':'poème','poemes':'poèmes',
    'phenomene':'phénomène','phenomenes':'phénomènes',
    'academie':'académie','academies':'académies',
    'generale':'générale','generales':'générales','general':'général',
    'medecin':'médecin','medecins':'médecins',
    'periode':'période','periodes':'périodes',
    'categorie':'catégorie','categories':'catégories',
    'electricite':'électricité','electricien':'électricien',
    'ecole':'école','ecoles':'écoles','ecolier':'écolier',
    'etude':'étude','etudes':'études','etudiant':'étudiant','etudiants':'étudiants',
    'etat':'État','etats':'États',
    'evenement':'événement','evenements':'événements',
    'element':'élément','elements':'éléments',
    'equipe':'équipe','equipes':'équipes',
    'epoque':'époque','epoques':'époques',
    'ecrit':'écrit','ecrits':'écrits','ecrire':'écrire','ecrivent':'écrivent',
    'espace':'espace', // pas d'accent
    'tache':'tâche','taches':'tâches',
    'meme':'même','memes':'mêmes',
    'etre':'être',
    'fete':'fête','fetes':'fêtes',
    'tete':'tête','tetes':'têtes',
    'foret':'forêt','forets':'forêts',
    'interets':'intérêts','interet':'intérêt',
    'hopital':'hôpital','hopitaux':'hôpitaux',
    'hotel':'hôtel','hotels':'hôtels',
    'cote':'côté','cotes':'côtés',
    'grace':'grâce',
    'baton':'bâton','batons':'bâtons',
    'depot':'dépôt','depots':'dépôts',
    'noel':'Noël',
    // Conjugaisons / accords erronés fréquents
    'serait':'serait', // correct — ne pas toucher le conditionnel
    'serais':'serais',
    'travail':'travail', // nettoyé selon contexte par PluralEngine
    // Orthographe lexicale
    'heuresement':'heureusement',
    'maleureusement':'malheureusement','maleheureusement':'malheureusement',
    'beaucoups':'beaucoup','baucoup':'beaucoup','beaucoub':'beaucoup',
    'toutefoi':'toutefois',
    'cependan':'cependant',
    'egalement':'également',
    'surement':'sûrement','surment':'sûrement',
    'evidement':'évidemment','evidemment':'évidemment',
    'recemment':'récemment','recement':'récemment',
    'frequemment':'fréquemment','frequement':'fréquemment',
    'suffisament':'suffisamment',
    'aparemment':'apparemment','apparament':'apparemment',
    'maintanant':'maintenant','maintenent':'maintenant',
    'peut-etre':'peut-être','peux-être':'peut-être',
    'plutot':'plutôt',
    'bientot':'bientôt',
    'aussitot':'aussitôt',
    'sitot':'sitôt',
    'apres':'après',
    'voila':'voilà',
    'deja':'déjà',
    'dela':'delà',
    'tres':'très',
    'pres':'près',
    'derriere':'derrière',
    'separement':'séparément',
    'completement':'complètement',
    'reellement':'réellement',
    'presentement':'présentement',
    'precedement':'précédemment','precedemment':'précédemment',
    'courramment':'couramment','courament':'couramment',
    'abondament':'abondamment',
    'differement':'différemment','differemment':'différemment',
    'violament':'violemment',
    'savament':'savamment',
    'elegament':'élégamment','elegamment':'élégamment',
    // Noms communs courants mal orthographiés
    'employes':'employés','employais':'employés',
    'employe':'employé',
    'travaile':'travaille',
    'reponse':'réponse','reponses':'réponses',
    'annee':'année','annees':'années',
    'journee':'journée','journees':'journées',
    'soiree':'soirée','soirees':'soirées',
    'matinee':'matinée','matinees':'matinées',
    'maniere':'manière','manieres':'manières',
    'facon':'façon','facons':'façons',
    'caractere':'caractère','caracteres':'caractères',
  },

  // Dictionnaire EN : forme incorrecte → forme correcte
  _dict_en: {
    // Accords sujet-verbe (singulier avec sujet pluriel / pronom incorrect)
    'childrens':'children','childs':'children',
    'peoples':'people',
    'informations':'information','informations':'information',
    'advices':'advice','furnitures':'furniture','equipments':'equipment',
    // Conjugaisons courantes erronées
    'dont':'don\'t','doesnt':'doesn\'t','isnt':'isn\'t','arent':'aren\'t',
    'wasnt':'wasn\'t','werent':'weren\'t','hasnt':'hasn\'t','havent':'haven\'t',
    'hadnt':'hadn\'t','wont':'won\'t','cant':'can\'t','shouldnt':'shouldn\'t',
    'wouldnt':'wouldn\'t','couldnt':'couldn\'t',
    // "they is" / "i has" : géré par PluralEngine, mais fallback ici
    // Mots fréquemment mal orthographiés
    'recieve':'receive','beleive':'believe','definately':'definitely',
    'occured':'occurred','occuring':'occurring','occurence':'occurrence',
    'seperate':'separate','untill':'until','wich':'which','wether':'whether',
    'probaly':'probably','differant':'different','existance':'existence',
    'independant':'independent','occurence':'occurrence','persue':'pursue',
    'responsability':'responsibility','posible':'possible','posibly':'possibly',
    'accomodate':'accommodate','achievment':'achievement','arguement':'argument',
    'begining':'beginning','bizzare':'bizarre','calender':'calendar',
    'concious':'conscious','dilemna':'dilemma','embarass':'embarrass',
    'enviroment':'environment','existance':'existence','goverment':'government',
    'grammer':'grammar','harrass':'harass','ignorence':'ignorance',
    'immediatly':'immediately','independance':'independence','knowlege':'knowledge',
    'lisense':'license','maintainance':'maintenance','medival':'medieval',
    'millenium':'millennium','mischievious':'mischievous','necesary':'necessary',
    'noticable':'noticeable','ocasion':'occasion','occassion':'occasion',
    'persistant':'persistent','privelege':'privilege','publically':'publicly',
    'reccommend':'recommend','relavant':'relevant','rythm':'rhythm',
    'sieze':'seize','sucess':'success','suprise':'surprise','tatoo':'tattoo',
    'tendancy':'tendency','truely':'truly','vaccuum':'vacuum','wierd':'weird',
  },

  // Dictionnaire ES : forme incorrecte → forme correcte
  _dict_es: {
    // Accents manquants
    'tambien':'también','ademas':'además','despues':'después','todavia':'todavía',
    'aqui':'aquí','ahi':'ahí','alla':'allá','aca':'acá','asi':'así',
    'jamas':'jamás','quizas':'quizás','atras':'atrás','detras':'detrás',
    'facil':'fácil','dificil':'difícil','util':'útil','fragil':'frágil',
    'agil':'ágil','fertil':'fértil','arbol':'árbol','arboles':'árboles',
    'camara':'cámara','cine':'cine','musica':'música','numero':'número',
    'numeros':'números','pagina':'página','paginas':'páginas',
    'telefono':'teléfono','telefonos':'teléfonos','medico':'médico',
    'publico':'público','economico':'económico','historico':'histórico',
    'matematicas':'matemáticas','informatica':'informática',
    'rapido':'rápido','rapidos':'rápidos','rapida':'rápida',
    'debil':'débil','debiles':'débiles',
    // Conjugaisons incorrectes courantes
    'soy':'soy','eres':'eres','somos':'somos','son':'son',
    'esta':'está','estan':'están','estas':'estás',
    'tenia':'tenía','teniamos':'teníamos','habia':'había',
    'venia':'venía','sabia':'sabía','podia':'podía','queria':'quería',
    'hacia':'hacía','decia':'decía',
    // Mots courants mal orthographiés
    'haiga':'haya','hubieron':'hubo','preveer':'prever',
    'satisfacer':'satisfacer','satisfaga':'satisfaga',
    'influir':'influir','construir':'construir',
    'sobretodo':'sobre todo','sinembargo':'sin embargo',
    'acerca':'acerca','atraves':'a través','porqué':'por qué',
    'masomenos':'más o menos','entretanto':'entre tanto',
    'sinnúmero':'sin número','contrarreloj':'contra reloj',
  },

  /** Corriger les fautes d'orthographe lexicales dans le texte */
  applySpell(text, lang) {
    let dict;
    if (lang === 'en') dict = SpellEngine._dict_en;
    else if (lang === 'es') dict = SpellEngine._dict_es;
    else dict = SpellEngine._dict_fr;

    return text.replace(/\b([a-zA-ZÀ-ÿ'-]{3,})\b/g, (match) => {
      const lower = match.toLowerCase();
      const correction = dict[lower];
      if (!correction || correction === lower) return match;
      // Préserver la casse initiale
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return correction[0].toUpperCase() + correction.slice(1);
      }
      return correction;
    });
  },

  /** Corriger "j'ai parle" → "j'ai parlé", "j'ai manger" → "j'ai mangé", etc. */
  applyParticipes(text) {
    // Liste des mots terminant en -er qui NE sont PAS des infinitifs
    // (noms, adjectifs, prépositions fréquentes) — à ne pas toucher
    const NON_INFINITIFS = new Set([
      'premier','dernier','léger','singulier','entier','particulier',
      'familier','régulier','irrégulier','étranger','janvier','février',
      'quartier','couleur','longueur','hauteur','valeur','peur','coeur',
      'bonheur','malheur','honneur','erreur','ardeur','douceur','chaleur',
      'froideur','lenteur','auteur','docteur','secteur','vecteur',
      'intérieur','extérieur','inférieur','supérieur','antérieur','postérieur',
      'mineur','majeur','meilleur','seigneur','ingénieur','fleur','soeur',
      'beurre','heure','demeure','manoeuvre','épreuve',
      'ver','hier','amer','cher','fier','clair','pair','soir',
    ]);

    // Auxiliaire avoir + mot en -er → participe passé en -é
    return text.replace(
      /\b(ai|as|a|avons|avez|ont)\s+([a-zA-ZÀ-ÿ]{3,}er)\b/g,
      (m, aux, verb) => {
        // Déjà au participe (terminaison -é/-ée/-és/-ées)
        if (/[eé]e?s?$/.test(verb)) return m;
        // Mot dans la liste d'exclusion
        if (NON_INFINITIFS.has(verb.toLowerCase())) return m;
        // Ne pas toucher les verbes déjà fléchis en -er (ex. "ils parlèrent")
        if (/[èà]rent$/.test(verb)) return m;
        // Transformer infinitif -er en -é
        return aux + ' ' + verb.slice(0, -2) + 'é';
      }
    );
  },
};

// ── TypographicEngine : transformations pures ─────────────────────────────
const TypographicEngine = {

  /** Capitalise après . ? ! et en début de paragraphe */
  applyCapitals(text) {
    // Début de texte / après newline
    text = text.replace(/(^|\n)([ \t]*)([a-zàâäéèêëîïôùûüç])/gm, (m, nl, sp, ch) => nl + sp + ch.toUpperCase());
    // Après . ? ! (suivi d'espace ou de quote)
    text = text.replace(/([.?!])([\s\u202f]+)([a-zàâäéèêëîïôùûüç])/g, (m, p, sp, ch) => p + sp + ch.toUpperCase());
    return text;
  },

  /** Supprime les doubles espaces (mais pas les indentations en début de ligne) */
  removeDoubleSpaces(text) {
    // Ne touche pas les espaces de début de ligne ni les espaces insécables
    return text.replace(/([^\n]) {2,}/g, (m, pre) => pre + ' ');
  },

  /** Supprime les espaces en fin de ligne */
  removeTrailingSpaces(text) {
    return text.replace(/[ \t]+$/gm, '');
  },

  /** Apostrophes droites → typographiques (couvre aussi les variantes iOS/Word) */
  applyApostrophes(text) {
    // Normalise d'abord les variantes d'apostrophe (U+2018 ' et U+0060 `) en apostrophe droite ASCII
    text = text.replace(/[\u2018\u0060]/g, "'");
    // Apostrophe droite entre lettre/chiffre + lettre → ' typographique (U+2019)
    return text.replace(/([a-zA-ZÀ-ÿ0-9])'([a-zA-ZÀ-ÿ])/g, '$1\u2019$2');
  },

  /** Guillemets droits → typographiques selon langue, normalise aussi les variantes existantes */
  applyQuotes(text, lang) {
    const rules = LanguageRules[lang] || LanguageRules.fr;
    // Normalise les guillemets typographiques "curly" anglais en guillemets droits d'abord
    // pour que le remplacement ci-dessous les prenne en charge uniformément
    text = text.replace(/[\u201c\u201d]/g, '"');
    // Remplace les guillemets droits : "..." → « … » (FR) ou "…" (EN/ES)
    text = text.replace(/"([^"\n]{1,200})"/g, (m, inner) => {
      return rules.openQuote + inner + rules.closeQuote;
    });
    return text;
  },

  /** Normalise les espaces autour de la ponctuation selon la langue */
  applyPunctuation(text, lang) {
    if (lang === 'fr') {
      // Ajoute espace insécable AVANT ! ? : ; (si absent)
      text = text.replace(/([^\s\u202f\u00ab])([!?:;])/g, '$1\u202f$2');
      // Supprime espace(s) avant , .
      text = text.replace(/\s+([,\.](?!\.))/g, '$1');
      // Espace après , ; ! ? si pas déjà espace ou fin de ligne
      text = text.replace(/([,;!?])([^\s\n\)\]\u00bb"'\u201d\u2019])/g, '$1 $2');
      // Espace après point — SAUF :
      //  • nombre décimal : 3.14, 1.5
      //  • ellipse : ...
      //  • URL/domaine : .com .fr .net etc.
      //  • abréviation + espace déjà présente (le \s la couvre)
      text = text.replace(
        /(\.)([^\s\n\)\]\u00bb"'\u201d\u2019\.])/g,
        (m, dot, next) => {
          // Ne pas espacer si précédé d'un chiffre et suivi d'un chiffre (décimal)
          const before = m.length >= 2 ? m[0] : '';
          // On inspecte via un replace avec lookbehind émulé : on reparse le contexte
          return dot + ' ' + next;
        }
      );
      // Correction du cas décimal : annuler l'espace ajoutée par-dessus
      // Pattern : chiffre . espace chiffre → chiffre . chiffre
      text = text.replace(/(\d)\. (\d)/g, '$1.$2');
      // Annuler aussi pour les extensions de fichier/domaine courants
      text = text.replace(/\. (com|fr|net|org|io|co|uk|de|es|eu|be|ch|ca|gov|edu)\b/gi, '.$1');
    } else {
      // EN/ES : pas d'espace avant ponctuation
      text = text.replace(/\s+([!?:;,\.](?!\.))/g, '$1');
      // Espace après ponctuation si absent
      text = text.replace(/([,;:!?])([^\s\n\)\]"'\u00bb\u201d\u2019])/g, '$1 $2');
      text = text.replace(/([\.])([^\s\n\)\]"'\u00bb\u201d\u2019\.])/g, '$1 $2');
      // Correction décimaux
      text = text.replace(/(\d)\. (\d)/g, '$1.$2');
      text = text.replace(/\. (com|fr|net|org|io|co|uk|de|es|eu|be|ch|ca|gov|edu)\b/gi, '.$1');
    }
    return text;
  },

  /** Réduit les répétitions accidentelles de mots courts */
  applyRepetitions(text, lang) {
    const rules = LanguageRules[lang] || LanguageRules.fr;
    return text.replace(rules.dupWords, (m, word) => word);
  },

  /** Remplace ponctuation excessive par ellipse typographique */
  applyEllipsis(text) {
    // 4+ points → …
    text = text.replace(/\.{4,}/g, '\u2026');
    // 3 points → …  (seulement si pas déjà ...) — optionnel, conservateur
    // text = text.replace(/\.\.\./g, '\u2026');
    // Exclamations/questions excessives : 3+ → 2
    text = text.replace(/!{3,}/g, '!!');
    text = text.replace(/\?{3,}/g, '??');
    return text;
  },
};

// ── SafeCorrectionEngine : moteur principal, appliqué de façon sûre ────────
const SafeCorrectionEngine = (() => {
  let _debounceTimer = null;
  let _attached = false;
  let _lastText   = null;

  /** Applique toutes les corrections activées sur le texte complet. */
  function applyAll(text, prefs) {
    if (!prefs.enabled) return text;
    const lang = prefs.lang || 'fr';
    let t = text;

    // Ordre important : ellipsis d'abord (évite interférence avec ponctuation)
    if (prefs.ellipsis)        t = TypographicEngine.applyEllipsis(t);
    if (prefs.apostrophes)     t = TypographicEngine.applyApostrophes(t);
    if (prefs.quotes)          t = TypographicEngine.applyQuotes(t, lang);
    if (prefs.punctuation)     t = TypographicEngine.applyPunctuation(t, lang);
    if (prefs.repetitions)     t = TypographicEngine.applyRepetitions(t, lang);
    if (prefs.dblSpaces)       t = TypographicEngine.removeDoubleSpaces(t);
    if (prefs.trailingSpaces)  t = TypographicEngine.removeTrailingSpaces(t);
    if (prefs.pluralNoun)      t = PluralEngine.applyNounPlural(t, lang);
    if (prefs.pluralVerb)      t = PluralEngine.applyPluralVerb(t, lang);
    if (prefs.pluralAdj)       t = PluralEngine.applyPluralAdj(t, lang);
    if (prefs.capitals)        t = TypographicEngine.applyCapitals(t);
    // Corrections orthographiques lexicales + participes passés (conditionnelles)
    if (prefs.spell)           t = SpellEngine.applySpell(t, lang);
    if (prefs.participes)      t = SpellEngine.applyParticipes(t);

    return t;
  }

  /** Applique les corrections de façon sûre dans le textarea, préserve le curseur. */
  function _safeApply(ta) {
    const prefs = ACPrefs.load();
    if (!prefs.enabled) return;

    const original = ta.value;
    if (original === _lastText) return;

    // Position exacte du curseur AVANT toute modification
    const selStart = ta.selectionStart;
    const selEnd   = ta.selectionEnd;

    // Applique les corrections en protégeant la ligne courante du curseur
    // contre removeTrailingSpaces (elle est encore en cours d'écriture).
    const corrected = _applyAllSafe(original, prefs, selStart);
    if (corrected === original) { _lastText = original; return; }

    // Calcul du décalage curseur par diff caractère-à-caractère
    const delta = _computeCursorDelta(original, corrected, selStart);
    const newStart = Math.max(0, Math.min(selStart + delta, corrected.length));
    const newEnd   = selStart === selEnd
      ? newStart
      : Math.max(0, Math.min(selEnd + delta, corrected.length));

    // Écriture directe — pas d'execCommand (incompatible navigateur web)
    ta.value = corrected;

    // Restauration immédiate et synchrone du curseur
    ta.setSelectionRange(newStart, newEnd);

    _lastText = corrected;

    // Mise à jour stats/pagination (debounce déjà géré par onRawInput)
    if (typeof onRawInput === 'function') {
      try { onRawInput(); } catch(e) {}
    }
  }

  /**
   * Variante de applyAll qui protège la ligne courante du curseur contre
   * removeTrailingSpaces — cette ligne est encore en cours d'écriture.
   * Toutes les autres corrections s'appliquent normalement sur le texte entier.
   */
  function _applyAllSafe(text, prefs, cursorPos) {
    if (!prefs.enabled) return text;
    const lang = prefs.lang || 'fr';
    let t = text;

    if (prefs.ellipsis)      t = TypographicEngine.applyEllipsis(t);
    if (prefs.apostrophes)   t = TypographicEngine.applyApostrophes(t);
    if (prefs.quotes)        t = TypographicEngine.applyQuotes(t, lang);
    if (prefs.punctuation)   t = TypographicEngine.applyPunctuation(t, lang);
    if (prefs.repetitions)   t = TypographicEngine.applyRepetitions(t, lang);
    if (prefs.dblSpaces)     t = TypographicEngine.removeDoubleSpaces(t);

    // removeTrailingSpaces : protège la ligne où se trouve le curseur.
    // Seules les lignes TERMINÉES (hors ligne courante) sont nettoyées.
    if (prefs.trailingSpaces) {
      const linesBefore = text.slice(0, cursorPos).split('\n');
      const cursorLine  = linesBefore.length - 1; // 0-indexed
      const lines = t.split('\n');
      t = lines.map((line, idx) => {
        if (idx === cursorLine) return line;          // ligne en cours → intouchée
        return line.replace(/[ \t]+$/, '');           // autres lignes → nettoyées
      }).join('\n');
    }

    if (prefs.pluralNoun) t = PluralEngine.applyNounPlural(t, lang);
    if (prefs.pluralVerb) t = PluralEngine.applyPluralVerb(t, lang);
    if (prefs.pluralAdj)  t = PluralEngine.applyPluralAdj(t, lang);
    if (prefs.capitals)   t = TypographicEngine.applyCapitals(t);
    // Corrections orthographiques lexicales + participes passés (conditionnelles)
    if (prefs.spell)      t = SpellEngine.applySpell(t, lang);
    if (prefs.participes) t = SpellEngine.applyParticipes(t);

    return t;
  }

  /**
   * Calcule le décalage de position du curseur entre `original` et `corrected`,
   * en faisant un diff linéaire jusqu'à `cursorPos`.
   * Symétrique : détecte aussi les suppressions dans original (corrections raccourcissantes).
   */
  function _computeCursorDelta(original, corrected, cursorPos) {
    let i = 0; // index dans original
    let j = 0; // index dans corrected
    let delta = 0;
    const lookahead = 8;

    while (i < cursorPos) {
      if (i >= original.length) break;
      if (j >= corrected.length) { i++; delta--; continue; }

      if (original[i] === corrected[j]) {
        i++; j++;
      } else {
        // Cherche original[i] en avance dans corrected (insertion dans corrected)
        let foundInCorrected = false;
        for (let k = 1; k <= lookahead && (j + k) < corrected.length; k++) {
          if (corrected[j + k] === original[i]) {
            delta += k;
            j += k;
            foundInCorrected = true;
            break;
          }
        }
        if (!foundInCorrected) {
          // Cherche corrected[j] en avance dans original (suppression dans original)
          let foundInOriginal = false;
          for (let k = 1; k <= lookahead && (i + k) < original.length && (i + k) < cursorPos; k++) {
            if (original[i + k] === corrected[j]) {
              delta -= k;
              i += k;
              foundInOriginal = true;
              break;
            }
          }
          if (!foundInOriginal) {
            // Pas de correspondance dans aucune direction → suppression simple
            i++; delta--;
          }
        }
      }
    }
    return delta;
  }

  /** Déclencheur sur événements clavier/pause */
  function _onKeyUp(e) {
    const ta = e.target;
    if (!ta || ta.id !== 'raw-input') return;

    const prefs = ACPrefs.load();
    if (!prefs.enabled) return;

    // Déclencher après espace, ponctuation, Entrée, ou pause
    const trigger = e.key === ' ' || e.key === 'Enter' ||
                    /^[.?!;:,\n]$/.test(e.key);

    if (!trigger) {
      // Pause de frappe : 1400ms
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => _safeApply(ta), 1400);
      return;
    }

    clearTimeout(_debounceTimer);
    // Légère pause pour laisser le caractère s'insérer
    _debounceTimer = setTimeout(() => _safeApply(ta), 80);
  }

  /** Déclencheur sur collage (paste) */
  function _onPaste(e) {
    const ta = e.target;
    if (!ta || ta.id !== 'raw-input') return;
    const prefs = ACPrefs.load();
    if (!prefs.enabled) return;
    // Forcer la réinitialisation de _lastText pour que _safeApply ne saute pas la correction
    _lastText = null;
    // Premier passage : attendre l'insertion du contenu collé par le navigateur
    setTimeout(() => {
      _lastText = null;
      _safeApply(ta);
      // Mémoriser le texte après le premier passage
      const afterFirst = ta.value;
      // Second passage : uniquement si le navigateur a encore modifié le textarea
      // (copier-coller riche/lent sur certains navigateurs)
      setTimeout(() => {
        if (ta.value !== afterFirst) {
          _lastText = null;
          _safeApply(ta);
        }
      }, 400);
    }, 200);
  }

  /** Attache les listeners sur le textarea principal */
  function attach() {
    if (_attached) return;
    const ta = document.getElementById('raw-input');
    if (!ta) return;
    ta.addEventListener('keyup', _onKeyUp, { passive: true });
    ta.addEventListener('paste', _onPaste, { passive: true });
    _attached = true;
    console.log('[ACEngine] Attached to #raw-input (keyup + paste)');
  }

  /** Appelé quand les préférences changent */
  function onPrefsChange() {
    ACPrefs.refreshUI();
    // Pas de re-correction immédiate — attendre la prochaine frappe
  }

  /** Initialisation complète */
  function init() {
    attach();
    // Synchroniser la langue de correction depuis la langue du projet au démarrage
    const uiLang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
    const p = ACPrefs.load();
    if (uiLang !== p.lang) {
      ACPrefs.set('lang', uiLang);
    }
    ACPrefs.refreshUI();
    _injectBadge();
  }

  /** Injecte le badge statut dans la statusbar */
  function _injectBadge() {
    const bar = document.getElementById('editor-statusbar');
    if (!bar || document.getElementById('ac-status-badge')) return;
    const badge = document.createElement('span');
    badge.id = 'ac-status-badge';
    badge.className = 'autocorrect-badge';
    badge.innerHTML = '<span class="autocorrect-badge-dot"></span><span class="ac-badge-txt">Auto</span>';
    badge.title = 'Correction automatique';
    bar.appendChild(badge);
    ACPrefs.refreshUI();
  }

  return { init, attach, onPrefsChange, applyAll };
})();

// initPrefsPane est déjà patchée directement dans le corps de la fonction
// pour appeler ACPrefs.refreshUI() — voir définition ci-dessus.

// ── DÉMARRAGE ─────────────────────────────────────────────────────────────
// Attendre que le DOM et l'app soient prêts
(function() {
  function tryInit() {
    const ta = document.getElementById('raw-input');
    if (ta) {
      SafeCorrectionEngine.init();
    } else {
      setTimeout(tryInit, 400);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
  // atelier:ready : on attache uniquement si ce n'est pas déjà fait
  // (_attached guard dans attach() évite le double-attachement)
  // On ne rappelle pas init() pour éviter un double _injectBadge.
  document.addEventListener('atelier:ready', () => {
    SafeCorrectionEngine.attach();
    ACPrefs.refreshUI();
  });
})();

// ══════════════════════════════════════════════════════════════════════════════
//  END AUTOCORRECT ENGINE
