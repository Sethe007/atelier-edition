// ── PARAMÈTRES TYPO ────────────────────────────────────
function applySettings() {
  markUnsaved();
  // Synchroniser les contrôles de la sidebar avec les valeurs réelles du modèle
  syncSidebarToFormat();
  updateStats(); // recalcule pages selon le nouveau format
  updateSubmitInfoBox();
  formatRoman();
}

/**
 * Met à jour les selects de la sidebar pour refléter les valeurs
 * réellement utilisées par le modèle actif (ex: soumission impose
 * interligne 2.0 et tabulation 0).
 */
function syncSidebarToFormat() {
  const isSubmit = isSubmitFormat();
  const lhSel  = document.getElementById('line-height');
  const indSel = document.getElementById('indent-size');
  const fsSel  = document.getElementById('font-size');

  if (isSubmit) {
    lhSel.value  = '2.0';
    indSel.value = '1em';
    fsSel.value  = '12';
    lhSel.disabled = indSel.disabled = fsSel.disabled = true;
    lhSel.title  = 'Fixé par le format de soumission';
    indSel.title = 'Sans tabulation en mode soumission';
    fsSel.title  = 'Fixé par le format de soumission (12 pt)';
  } else {
    lhSel.disabled = indSel.disabled = fsSel.disabled = false;
    lhSel.title = indSel.title = fsSel.title = '';
  }
}

// Données des formats soumission pour l'encart d'info
const SUBMIT_INFO = {
  SUBMIT_AMI: {
    titre: '📬 Soumission Pro (double interligne)',
    regles: [
      'Format : 25 lignes × 60 signes par page',
      'Double interligne (×2)',
      'Police : Times New Roman 12 pt',
      'Marges larges (3 cm gauche, 2,5 cm autres)',
      'Fichiers acceptés : DOCX, PDF, EPUB, MOBI',
      'Comptage : 1 feuillet normalisé = 1 500 signes',
    ],
    note: 'Le compteur "feuillets" ci-dessous suit ce standard.',
  },
  SUBMIT_STD: {
    titre: '📬 Soumission standard (France)',
    regles: [
      'Format A4, portrait',
      'Double interligne recommandé',
      'Police sérif 12 pt (Times, Garamond…)',
      'Marges 2,5–3 cm, numérotation des pages',
      'Page de garde : titre, auteur, genre, nb mots',
      '1 feuillet = 1 500 signes espaces compris',
    ],
    note: 'Vérifiez toujours les consignes spécifiques de chaque éditeur.',
  },
};

function updateSubmitInfoBox() {
  const fmt  = getDomVal('page-format');
  const box  = document.getElementById('submit-info-box');
  const txt  = document.getElementById('submit-info-text');
  const info = SUBMIT_INFO[fmt];
  if (!info) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  txt.innerHTML =
    '<strong style="font-size:11.5px;display:block;margin-bottom:5px;">' + info.titre + '</strong>' +
    info.regles.map(r => '<div class="info-rule">' + r + '</div>').join('') +
    (info.note ? '<div style="margin-top:5px;font-size:10px;color:var(--ink-muted);font-style:italic;">' + info.note + '</div>' : '');
}

// ── CHAPITRES SIDEBAR ──────────────────────────────────
// ── ÉTAT DES CHAPITRES ─────────────────────────────────
// clé = texte du chapitre (trimmed), valeur = { status: 0-3, locked: bool }
let _chapterMeta = {};  // persisté dans le projet via save/load
let _currentChapterText = null; // texte du chapitre actif (pour "Chapitre actif seulement")

const CH_STATUS_KEYS = [
  { icon: '○', key: 'ch_st_draft',  st: 0 },
  { icon: '◑', key: 'ch_st_wip',    st: 1 },
  { icon: '●', key: 'ch_st_done',   st: 2 },
  { icon: '◈', key: 'ch_st_review', st: 3 },
];
// CH_STATUS reste accessible mais les titles sont résolus dynamiquement
const CH_STATUS = CH_STATUS_KEYS.map(s => ({
  icon: s.icon, st: s.st,
  get title() { return (typeof _t === 'function') ? _t(s.key) : s.key; }
}));

function chGetMeta(key) {
  if (!_chapterMeta[key]) _chapterMeta[key] = { status: 0, locked: false, tags: [] };
  if (!_chapterMeta[key].tags) _chapterMeta[key].tags = [];
  return _chapterMeta[key];
}

function chCycleStatus(key, el, event) {
  event.stopPropagation();
  const meta = chGetMeta(key);
  meta.status = (meta.status + 1) % 4;
  const s = CH_STATUS[meta.status];
  el.textContent   = s.icon;
  el.title         = s.title;
  el.dataset.st    = meta.status;
  markUnsaved();
}

function chToggleLock(key, el, rowEl, event) {
  event.stopPropagation();
  const meta = chGetMeta(key);
  meta.locked = !meta.locked;
  el.textContent = meta.locked ? '🔒' : '🔓';
  el.title       = meta.locked ? 'Chapitre verrouillé — cliquez pour déverrouiller' : 'Verrouiller ce chapitre';
  el.classList.toggle('locked', meta.locked);
  rowEl.classList.toggle('locked', meta.locked);
  markUnsaved();
  // Bloquer ou débloquer l'écriture sur le textarea si le chapitre actif est verrouillé
  _updateEditorLockState();
}

// Vérifie si le curseur est dans un chapitre verrouillé et bloque la saisie
function _updateEditorLockState() {
  const ta = getTA();
  if (!ta) return;
  // On vérifie seulement si le projet a des chapitres verrouillés
  const hasLock = Object.values(_chapterMeta).some(m => m.locked);
  if (!hasLock) {
    ta.readOnly = false;
    ta.title = '';
    return;
  }
  // Trouver dans quel chapitre se trouve le curseur
  const pos   = ta.selectionStart;
  const raw   = ta.value;
  const lines = raw.split('\n');
  let cursor = 0;
  let lockedChapter = null;
  for (const line of lines) {
    const t = line.trim();
    if (detectHeadingLevel(t) >= 1) {
      lockedChapter = chGetMeta(t).locked ? t : null;
    }
    cursor += line.length + 1;
    if (cursor > pos) break;
  }
  if (lockedChapter) {
    ta.readOnly = true;
    ta.title = `🔒 Chapitre verrouillé — déverrouillez-le dans la structure pour modifier.`;
  } else {
    ta.readOnly = false;
    ta.title = '';
  }
}

function updateChapterList(chapters) {
  const list = document.getElementById('chapter-list');
  if (!chapters.length) {
    list.innerHTML = '<div class="no-chapters">Aucun chapitre détecté.</div>';
    return;
  }
  list.innerHTML = chapters.map((ch) => {
    const key   = ch.text;
    const meta  = chGetMeta(key);
    const s     = CH_STATUS[meta.status];
    const isLocked = meta.locked;
    const indent = ch.level === 2 ? '↳ ' : '';
    // NOTE: le texte du chapitre est stocké en data-key (encodé JSON) pour éviter
    // que les apostrophes françaises (ex: "L'Île") cassent les handlers onclick inline.
    const dataKey = escHtml(JSON.stringify(key));
    return `<div class="chapter-item h${ch.level}${isLocked ? ' locked' : ''}" id="chrow-${ch.id}"
                 data-ch-id="${ch.id}" data-ch-key="${dataKey}"
                 onclick="scrollToChapter(this.dataset.chId, JSON.parse(this.dataset.chKey))"
                 title="${escHtml(ch.text)}">
      <span class="ch-title">${indent}${escHtml(truncate(ch.text, 28))}</span>
      ${meta.tags && meta.tags.length ? `<span class="ch-tags-row">${meta.tags.map(t=>`<span class="ch-tag-chip">${escHtml(t)}</span>`).join('')}</span>` : ''}
      <span class="ch-controls">
        <button class="ch-lock${isLocked ? ' locked' : ''}"
          title="${isLocked ? _t('ch_unlock_label') : _t('ch_lock_label')}"
          onclick="event.stopPropagation();chToggleLock(JSON.parse(this.closest('[data-ch-key]').dataset.chKey), this, document.getElementById('chrow-${ch.id}'), event)">${isLocked ? '🔒' : '🔓'}</button>
        <button class="ch-status" data-st="${meta.status}"
          title="${s.title}"
          onclick="event.stopPropagation();chCycleStatus(JSON.parse(this.closest('[data-ch-key]').dataset.chKey), this, event)">${s.icon}</button>
        <button class="ch-tag-btn" title="${_t('ch_tag_btn')}" onclick="event.stopPropagation();chEditTags(JSON.parse(this.closest('[data-ch-key]').dataset.chKey))">🏷</button>
      </span>
    </div>`;
  }).join('');
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

function scrollToChapter(id, chapterText) {
  // Mémoriser le chapitre actif pour "Chapitre actif seulement" dans le correcteur
  _currentChapterText = chapterText || null;
  // ── 1. Prévisualisation ──────────────────────────────
  const el = document.getElementById(id);
  if (el) {
    const page = el.closest('.book-page') || el;
    const pane = document.getElementById('preview-pane');
    if (pane) {
      const paneRect = pane.getBoundingClientRect();
      const pageRect = page.getBoundingClientRect();
      const offset   = pageRect.top - paneRect.top + pane.scrollTop - 24;
      pane.scrollTo({ top: offset, behavior: 'smooth' });
    } else {
      page.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ── 2. Éditeur textarea ──────────────────────────────
  const ta  = document.getElementById('raw-input');
  if (!ta || !chapterText) return;
  const h = SE.fuzzyFind(chapterText) || SE.findOne(chapterText);
  if (!h) return;
  SE.scrollTo(ta, h.start);
  // Placer le curseur au début du titre sans voler le focus de façon agressive
  const wasFocused = document.activeElement === ta;
  ta.focus();
  ta.setSelectionRange(h.start, h.end);
  if (!wasFocused) ta.blur();
}

// ── IMAGES ─────────────────────────────────────────────
// images[name] = { src, caption, width, rotation, align }

let pendingImgSrc = null;

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    pendingImgSrc = ev.target.result;
    const name = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s+/g, '-');
    document.getElementById('img-name-input').value = name;
    document.getElementById('img-caption-input').value = '';
    document.getElementById('img-modal').classList.add('open');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function confirmImage() {
  const name    = document.getElementById('img-name-input').value.trim().toLowerCase();
  const caption = document.getElementById('img-caption-input').value.trim();
  if (!name || !pendingImgSrc) { closeImgModal(); return; }
  images[name] = { src: pendingImgSrc, caption, width: 100, rotation: 0, align: 'center', valign: 'top', marginTop: null, marginBot: null, marginLeft: null, marginRight: null, spaceBefore: null, spaceAfter: null };
  closeImgModal();
  renderImgList();
  formatRoman();
  markUnsaved();
  showToast(_t('toast_image_loaded').replace(/\{name\}/g, name));
}

function closeImgModal() {
  document.getElementById('img-modal').classList.remove('open');
  pendingImgSrc = null;
}

function deleteImage(name) {
  showConfirm(
    `Supprimer l'image « ${name} » ?`,
    'Cette action est définitive.',
    () => {
      delete images[name];
      renderImgList();
      formatRoman();
      markUnsaved();
      showToast(_t('toast_image_deleted').replace('{name}', name));
    }
  );
}

function showConfirm(title, msg, onConfirm) {
  let modal = document.getElementById('confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box">
      <h3 id="confirm-title"></h3>
      <p id="confirm-msg" style="font-size:13px;color:var(--ink-muted);margin:8px 0 16px;"></p>
      <div class="modal-actions">
        <button class="btn btn-ghost" style="color:var(--ink-soft);border-color:var(--cream);" onclick="document.getElementById('confirm-modal').classList.remove('open')">Annuler</button>
        <button class="btn btn-accent" id="confirm-ok">Supprimer</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  document.getElementById('confirm-ok').onclick = () => {
    modal.classList.remove('open');
    onConfirm();
  };
  modal.classList.add('open');
}

function updateImgProp(name, prop, value) {
  if (!images[name]) return;
  images[name][prop] = value;
  if (prop === 'width') {
    const card = document.querySelector('[data-img="' + name + '"]');
    if (card) { const lbl = card.querySelector('.range-val'); if (lbl) lbl.textContent = value + '%'; }
    // Sync live dans le rendu sans re-paginer
    document.querySelectorAll('.book-image[data-img-key="' + name + '"]').forEach(wrap => {
      wrap.style.width = value + '%';
      const tip = wrap.querySelector('.img-size-tooltip');
      if (tip) tip.textContent = value + '%';
    });
  }
  if (prop === 'spaceBefore' || prop === 'spaceAfter') {
    // Mise à jour live immédiate des marges visibles (avant repagination)
    const _sBefore = images[name].spaceBefore != null ? images[name].spaceBefore + 'pt' : '16pt';
    const _sAfter  = images[name].spaceAfter  != null ? images[name].spaceAfter  + 'pt' : '10pt';
    document.querySelectorAll('.book-image[data-img-key="' + name + '"]').forEach(wrap => {
      if (!wrap.classList.contains('img-watermark') && wrap.dataset.isFullPage !== '1') {
        wrap.style.setProperty('margin-top',    _sBefore, 'important');
        wrap.style.setProperty('margin-bottom', _sAfter,  'important');
      }
    });
    // Repaginer pour que la mesure de hauteur prenne en compte les nouvelles marges
    formatRoman();
    return;
  }
  formatRoman();
}

function rotateImage(name, delta) {
  if (!images[name]) return;
  images[name].rotation = ((images[name].rotation || 0) + delta + 360) % 360;
  // Mise à jour visuelle directe, sans repaginer (rotation = purement visuelle)
  document.querySelectorAll('.book-image[data-img-key="' + name + '"]').forEach(wrap => {
    const im = wrap.querySelector('img');
    if (im) im.style.transform = 'rotate(' + images[name].rotation + 'deg)';
  });
  const card = document.querySelector('[data-img="' + name + '"]');
  if (card) {
    const thumb = card.querySelector('.img-thumb');
    if (thumb) thumb.style.transform = 'rotate(' + images[name].rotation + 'deg)';
  }
  markUnsaved();
  // NE PAS appeler formatRoman() — la rotation ne change pas les dimensions du flux
}

/**
 * Met à jour l'opacité du filigrane directement, sans repaginer.
 * Valeur entre 0 et 100 (affiché en %, stocké en décimal dans images[name].opacity).
 */
function setImgOpacity(name, pct) {
  if (!images[name]) return;
  const val = Math.max(0, Math.min(100, +pct));
  images[name].opacity = val / 100;
  // Mise à jour visuelle directe sur tous les wrappers .img-watermark
  document.querySelectorAll('.book-image[data-img-key="' + name + '"]').forEach(wrap => {
    if (wrap.classList.contains('img-watermark')) {
      wrap.style.opacity = images[name].opacity;
    }
  });
  // Mettre à jour l'affichage de la valeur dans le panel
  const card = document.querySelector('[data-img="' + name + '"]');
  if (card) {
    const display = card.querySelector('.opacity-val');
    if (display) display.textContent = val + '%';
  }
  markUnsaved();
  // Pas de formatRoman() — l'opacité ne change pas le flux
}

function setImgAlign(name, align) {
  if (!images[name]) return;
  images[name].align = align;
  // Mise à jour directe sans repaginer si image pleine page
  document.querySelectorAll('.book-image[data-img-key="' + name + '"]').forEach(wrap => {
    wrap.style.marginLeft  = align === 'right'  ? 'auto' : align === 'center' ? 'auto' : '0';
    wrap.style.marginRight = align === 'left'   ? 'auto' : align === 'center' ? 'auto' : '0';
  });
  const card = document.querySelector('[data-img="' + name + '"]');
  if (card) card.querySelectorAll('.align-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.align === align));
  markUnsaved();
  // Repaginer seulement si image dans le flux (valign=top)
  if ((images[name].valign || 'top') === 'top') formatRoman();
}

function setImgValign(name, valign) {
  if (!images[name]) return;
  images[name].valign = valign;
  const card = document.querySelector('[data-img="' + name + '"]');
  if (card) {
    card.querySelectorAll('.valign-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.valign === valign));
    // Afficher/masquer les marges selon le mode
    const marginsRow = card.querySelector('.margins-section');
    if (marginsRow) marginsRow.style.display = (valign === 'middle' || valign === 'fill') ? '' : 'none';
    // Afficher/masquer le contrôle de largeur (bandeau = toujours 100%, pas de slider)
    const widthRow = card.querySelector('.img-width-row');
    if (widthRow) widthRow.style.display = valign === 'bandeau' ? 'none' : '';
    // Afficher/masquer le slider d'opacité (filigrane uniquement)
    const opacityRow = card.querySelector('.opacity-section');
    if (opacityRow) opacityRow.style.display = valign === 'watermark' ? '' : 'none';
    // Note contextuelle sur le mode actif
    const modeNote = card.querySelector('.valign-mode-note');
    const notes = {
      'top':         '',
      'float-left':  '⟵ Le texte entoure l\'image à droite',
      'float-right': '⟶ Le texte entoure l\'image à gauche',
      'bandeau':     '▬ Pleine largeur, bord à bord',
      'watermark':   '◎ Image en fond de page, transparente',
      'middle':      '⊕ Page dédiée, centrée verticalement',
      'fill':        '⬛ Page dédiée, remplit toute la surface',
    };
    if (modeNote) modeNote.textContent = notes[valign] || '';
  }
  formatRoman();
}

function insertImageTag(name) {
  const ta    = document.getElementById('raw-input');
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const tag   = '[IMAGE:' + name + ']';
  taReplace(ta, start, end, tag);
  const newPos = start + tag.length;
  ta.setSelectionRange(newPos, newPos);
  ta.focus();
  onRawInput();
  showToast(_t('toast_image_inserted').replace('{name}', name));
}

function toggleImgControls(name) {
  const card = document.querySelector('[data-img="' + name + '"]');
  if (!card) return;
  card.querySelector('.img-controls').classList.toggle('open');
}

function renderImgList() {
  const list = document.getElementById('img-list');
  if (!list) return;
  const keys = Object.keys(images);
  if (!keys.length) { list.innerHTML = ''; return; }
  const rawText = getDomVal('raw-input');

  // Mémoriser les volets ouverts avant de re-rendre
  const openPanels = new Set();
  list.querySelectorAll('[data-img]').forEach(card => {
    if (card.querySelector('.img-controls.open')) openPanels.add(card.dataset.img);
  });

  list.innerHTML = keys.map(name => {
    const img    = images[name];
    const eName  = escHtml(name); // nom échappé pour les attributs HTML — correctif injection
    const inUse  = rawText.includes('[IMAGE:' + name + ']');
    const sColor = inUse ? '#16a34a' : '#d97706';
    const sTxt   = inUse ? '✓ placée dans le texte' : '⚠ non placée';
    const rot    = img.rotation || 0;
    const w      = img.width    || 100;
    const align  = img.align    || 'center';
    const valign = img.valign   || 'top';
    const isPage = valign === 'middle' || valign === 'fill'; // modes page dédiée seulement
    const aL = align === 'left'   ? ' active' : '';
    const aC = align === 'center' ? ' active' : '';
    const aR = align === 'right'  ? ' active' : '';
    const vT  = valign === 'top'          ? ' active' : '';
    const vFL = valign === 'float-left'   ? ' active' : '';
    const vFR = valign === 'float-right'  ? ' active' : '';
    const vBD = valign === 'bandeau'      ? ' active' : '';
    const vWM = valign === 'watermark'    ? ' active' : '';
    const vM  = valign === 'middle'       ? ' active' : '';
    const vF  = valign === 'fill'         ? ' active' : '';
    const mT  = img.marginTop    != null ? img.marginTop    : '';
    const mB  = img.marginBot    != null ? img.marginBot    : '';
    const mL2 = img.marginLeft   != null ? img.marginLeft   : '';
    const mR2 = img.marginRight  != null ? img.marginRight  : '';
    const sBefore = img.spaceBefore != null ? img.spaceBefore : 16;
    const sAfter  = img.spaceAfter  != null ? img.spaceAfter  : 10;
    const marginsDisplay   = isPage ? '' : 'display:none';
    const inlineSpacingDisplay = isPage || valign === 'watermark' ? 'display:none' : '';
    const widthDisplay     = valign === 'bandeau' ? 'display:none' : '';
    const opacityDisplay   = valign === 'watermark' ? '' : 'display:none';
    const opacityPct       = Math.round((img.opacity != null ? img.opacity : 0.10) * 100);

    const modeNotes = {
      'top':         '',
      'float-left':  '⟵ Texte à droite de l\'image',
      'float-right': '⟶ Texte à gauche de l\'image',
      'bandeau':     '▬ Pleine largeur, bord à bord',
      'watermark':   '◎ Fond de page, transparente',
      'middle':      '⊕ Page dédiée, centrée',
      'fill':        '⬛ Page dédiée, bord à bord',
    };
    const currentModeNote = modeNotes[valign] || '';

    return `<div class="img-card" data-img="${eName}">
  <div class="img-card-top">
    <img class="img-thumb" src="${img.src}" alt="${eName}"
         style="transform:rotate(${rot}deg)"
         onclick="toggleImgControls(this.closest('[data-img]').dataset.img)"
         title="${_t('img_options')}">
    <div class="img-card-info">
      <div class="img-card-name" title="${eName}">${eName}</div>
      <div class="img-card-tag"
           onclick="insertImageTag(this.closest('[data-img]').dataset.img)"
           title="${_t('img_insert_tag')}">[IMAGE:${eName}]</div>
      <div class="img-card-status" style="color:${sColor}">${sTxt}</div>
    </div>
    <div class="img-card-actions">
      <button class="img-action-btn"
              onclick="insertImageTag(this.closest('[data-img]').dataset.img)"
              title="${_t('img_insert_btn')}">⊕</button>
      <button class="img-action-btn"
              onclick="toggleImgControls(this.closest('[data-img]').dataset.img)"
              title="${_t('img_options')}">⚙</button>
      <button class="img-action-btn danger"
              onclick="deleteImage(this.closest('[data-img]').dataset.img)"
              title="${_t('img_delete_btn')}">✕</button>
    </div>
  </div>
  <div class="img-controls">
    <div style="font-size:10px;color:var(--accent);margin-bottom:5px;font-style:italic;">
      ✦ Cliquez l'image dans l'aperçu, puis tirez les poignées pour redimensionner
    </div>

    <div class="ctrl-section-label">Taille & position</div>

    <div class="img-ctrl-row img-width-row" style="${widthDisplay}">
      <span class="img-ctrl-label">Largeur</span>
      <input type="range" min="10" max="200" step="5" value="${w}"
             oninput="updateImgProp(this.closest('[data-img]').dataset.img,'width',+this.value)">
      <span class="range-val">${w}%</span>
    </div>

    <div class="img-ctrl-row">
      <span class="img-ctrl-label">H. align</span>
      <div class="align-btns">
        <button class="align-btn${aL}" data-align="left"
                onclick="setImgAlign(this.closest('[data-img]').dataset.img,'left')" title="${_t('img_align_left')}">◀</button>
        <button class="align-btn${aC}" data-align="center"
                onclick="setImgAlign(this.closest('[data-img]').dataset.img,'center')" title="${_t('img_align_center')}">●</button>
        <button class="align-btn${aR}" data-align="right"
                onclick="setImgAlign(this.closest('[data-img]').dataset.img,'right')" title="${_t('img_align_right')}">▶</button>
      </div>
    </div>

    <div class="ctrl-section-label" style="margin-top:7px;">Positionnement dans le texte</div>

    <div class="img-ctrl-row" style="flex-wrap:wrap;gap:4px 3px;align-items:flex-start;">
      <button class="valign-btn align-btn${vT}" data-valign="top" style="font-size:10px;padding:3px 6px;"
              onclick="setImgValign(this.closest('[data-img]').dataset.img,'top')"
              title="Image dans le flux, alignée au texte">↕ Flux</button>
      <button class="valign-btn align-btn${vFL}" data-valign="float-left" style="font-size:10px;padding:3px 6px;"
              onclick="setImgValign(this.closest('[data-img]').dataset.img,'float-left')"
              title="Float gauche : le texte entoure à droite">⟵ Float G</button>
      <button class="valign-btn align-btn${vFR}" data-valign="float-right" style="font-size:10px;padding:3px 6px;"
              onclick="setImgValign(this.closest('[data-img]').dataset.img,'float-right')"
              title="Float droite : le texte entoure à gauche">Float D ⟶</button>
      <button class="valign-btn align-btn${vBD}" data-valign="bandeau" style="font-size:10px;padding:3px 6px;"
              onclick="setImgValign(this.closest('[data-img]').dataset.img,'bandeau')"
              title="Bandeau pleine largeur, bord à bord">▬ Bandeau</button>
      <button class="valign-btn align-btn${vWM}" data-valign="watermark" style="font-size:10px;padding:3px 6px;"
              onclick="setImgValign(this.closest('[data-img]').dataset.img,'watermark')"
              title="Filigrane : image transparente en fond de page">◎ Filigrane</button>
      <button class="valign-btn align-btn${vM}" data-valign="middle" style="font-size:10px;padding:3px 6px;"
              onclick="setImgValign(this.closest('[data-img]').dataset.img,'middle')"
              title="Page dédiée, centrée verticalement">⊕ Page</button>
      <button class="valign-btn align-btn${vF}" data-valign="fill" style="font-size:10px;padding:3px 6px;"
              onclick="setImgValign(this.closest('[data-img]').dataset.img,'fill')"
              title="Page dédiée, remplit toute la surface">⬛ Fill</button>
    </div>
    <div class="valign-mode-note" style="font-size:9.5px;color:var(--accent-light);margin-top:3px;font-style:italic;min-height:14px;">${currentModeNote}</div>

    <div class="img-ctrl-row">
      <span class="img-ctrl-label">Rotation</span>
      <div class="rotate-btns">
        <button class="rotate-btn"
                onclick="rotateImage(this.closest('[data-img]').dataset.img,-90)">↺</button>
        <button class="rotate-btn"
                onclick="rotateImage(this.closest('[data-img]').dataset.img,90)">↻</button>
      </div>
    </div>

    <div class="img-ctrl-row opacity-section" style="${opacityDisplay}">
      <span class="img-ctrl-label">Opacité</span>
      <input type="range" min="2" max="100" step="1" value="${opacityPct}"
             oninput="setImgOpacity(this.closest('[data-img]').dataset.img, +this.value)"
             style="flex:1;min-width:0;">
      <span class="range-val opacity-val">${opacityPct}%</span>
    </div>

    <div class="margins-section" style="${marginsDisplay}">
      <div class="ctrl-section-label" style="margin-top:6px;">Marges de page (mm) <span style="font-weight:400;color:var(--ink-muted)">— vide = défaut</span></div>
      <div class="img-ctrl-row">
        <span class="img-ctrl-label">Haut</span>
        <input type="number" min="0" max="80" step="1" value="${mT}" placeholder="auto"
               style="width:48px;text-align:center;"
               onchange="updateImgProp(this.closest('[data-img]').dataset.img,'marginTop', this.value===''?null:+this.value)">
        <span class="img-ctrl-label" style="margin-left:8px;">Bas</span>
        <input type="number" min="0" max="80" step="1" value="${mB}" placeholder="auto"
               style="width:48px;text-align:center;"
               onchange="updateImgProp(this.closest('[data-img]').dataset.img,'marginBot', this.value===''?null:+this.value)">
      </div>
      <div class="img-ctrl-row">
        <span class="img-ctrl-label">Gauche</span>
        <input type="number" min="0" max="80" step="1" value="${mL2}" placeholder="auto"
               style="width:48px;text-align:center;"
               onchange="updateImgProp(this.closest('[data-img]').dataset.img,'marginLeft', this.value===''?null:+this.value)">
        <span class="img-ctrl-label" style="margin-left:8px;">Droite</span>
        <input type="number" min="0" max="80" step="1" value="${mR2}" placeholder="auto"
               style="width:48px;text-align:center;"
               onchange="updateImgProp(this.closest('[data-img]').dataset.img,'marginRight', this.value===''?null:+this.value)">
      </div>
      <div style="font-size:9.5px;color:var(--ink-muted);margin-top:3px;font-style:italic;">
        Mettre à 0 pour une image bord-à-bord (plein page)
      </div>
    </div>

    <div class="inline-spacing-section" style="${inlineSpacingDisplay}">
      <div class="ctrl-section-label" style="margin-top:6px;">Espacement dans le texte (pt)</div>
      <div class="img-ctrl-row">
        <span class="img-ctrl-label">↑ Avant</span>
        <input type="range" min="0" max="48" step="1" value="${sBefore}"
               oninput="updateImgProp(this.closest('[data-img]').dataset.img,'spaceBefore',+this.value);this.nextElementSibling.textContent=this.value+'pt'">
        <span class="range-val">${sBefore}pt</span>
      </div>
      <div class="img-ctrl-row">
        <span class="img-ctrl-label">↓ Après</span>
        <input type="range" min="0" max="48" step="1" value="${sAfter}"
               oninput="updateImgProp(this.closest('[data-img]').dataset.img,'spaceAfter',+this.value);this.nextElementSibling.textContent=this.value+'pt'">
        <span class="range-val">${sAfter}pt</span>
      </div>
      <div style="font-size:9.5px;color:var(--ink-muted);margin-top:2px;font-style:italic;">
        Contrôle l'espace entre l'image et le titre / le texte adjacent
      </div>
    </div>

  </div>
</div>`;
  }).join('');

  // Restaurer les volets qui étaient ouverts
  openPanels.forEach(name => {
    const card = list.querySelector('[data-img="' + name + '"]');
    if (card) card.querySelector('.img-controls').classList.add('open');
  });
}

