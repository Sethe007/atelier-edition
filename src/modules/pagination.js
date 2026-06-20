// ── Palette de surlignage ──────────────────────────────────────────────────
const HL_COLORS = {
  jaune:   { bg: 'rgba(253,224,71,0.45)',  border: '#ca8a04', label: '🟡', labelFr: 'Jaune',   labelEn: 'Yellow', labelEs: 'Amarillo' },
  rose:    { bg: 'rgba(249,168,212,0.45)', border: '#be185d', label: '🩷', labelFr: 'Rose',    labelEn: 'Pink',   labelEs: 'Rosa'     },
  vert:    { bg: 'rgba(134,239,172,0.45)', border: '#15803d', label: '🟢', labelFr: 'Vert',    labelEn: 'Green',  labelEs: 'Verde'    },
  bleu:    { bg: 'rgba(147,197,253,0.45)', border: '#1d4ed8', label: '🔵', labelFr: 'Bleu',    labelEn: 'Blue',   labelEs: 'Azul'     },
  orange:  { bg: 'rgba(253,186,116,0.45)', border: '#c2410c', label: '🟠', labelFr: 'Orange',  labelEn: 'Orange', labelEs: 'Naranja'  },
  violet:  { bg: 'rgba(196,181,253,0.45)', border: '#7c3aed', label: '🟣', labelFr: 'Violet',  labelEn: 'Purple', labelEs: 'Morado'   },
  rouge:   { bg: 'rgba(252,165,165,0.45)', border: '#dc2626', label: '🔴', labelFr: 'Rouge',   labelEn: 'Red',    labelEs: 'Rojo'     },
  cyan:    { bg: 'rgba(103,232,249,0.45)', border: '#0e7490', label: '🩵', labelFr: 'Cyan',    labelEn: 'Cyan',   labelEs: 'Cian'     },
};

const TAG_COLORS = {
  perso:  { bg: 'rgba(196,181,253,0.3)', border: '#7c3aed', icon: '👤' },
  lieu:   { bg: 'rgba(134,239,172,0.3)', border: '#15803d', icon: '📍' },
  theme:  { bg: 'rgba(253,186,116,0.3)', border: '#c2410c', icon: '💡' },
  temps:  { bg: 'rgba(147,197,253,0.3)', border: '#1d4ed8', icon: '⏱' },
  action: { bg: 'rgba(252,165,165,0.3)', border: '#dc2626', icon: '⚡' },
};

// Rendu inline markdown : **gras**, *italique*, __souligné__, ~~barré~~, [NOTE:…], [HL:…], [TAG:…]
function renderInlineMarkup(rawText) {
  const parts = rawText.split(/(\[NOTE:[^\]]*\]|\[HL:[^\]]*\]|\[TAG:[^\]]*\]|~~[^~]+~~|__[^_]+__|\*\*[^*]+\*\*|\*[^*]+\*)/);
  return parts.map(p => {
    // ── NOTE classique ──────────────────────────────────────
    if (p.startsWith('[NOTE:') && p.endsWith(']')) {
      const txt = p.slice(6, -1).trim();
      const idx = _renderNoteIdx++;
      const key = typeof _noteKey === 'function' ? escHtml(_noteKey(txt)) : escHtml(txt.slice(0,120));
      const meta = _notesMeta[_noteKey(txt)] || {};
      const prioColor = { high: '#dc2626', mid: '#f59e0b', low: '#22c55e', none: '#94a3b8' }[meta.priority || 'none'];
      return `<span class="author-note-hl note-hl-classic" data-note-idx="${idx}" data-note-key="${key}" data-note-text="${escHtml(txt)}" style="--hl-bg:rgba(253,224,71,0.35);--hl-border:#ca8a04;--prio-color:${prioColor}">💬 ${escHtml(txt)}<span class="note-float-popup" role="tooltip"><span class="nfp-prio" style="background:${prioColor}"></span><span class="nfp-text">${escHtml(txt)}</span></span></span>`;
    }

    // ── SURLIGNAGE [HL:couleur texte | note optionnelle] ────
    if (p.startsWith('[HL:') && p.endsWith(']')) {
      const inner = p.slice(4, -1); // "couleur texte | note"
      const firstSpace = inner.indexOf(' ');
      if (firstSpace < 0) return escHtml(p);
      const colorKey = inner.slice(0, firstSpace).toLowerCase().trim();
      const rest = inner.slice(firstSpace + 1);
      const pipeIdx = rest.lastIndexOf('|');
      const displayText = pipeIdx >= 0 ? rest.slice(0, pipeIdx).trim() : rest.trim();
      const noteText    = pipeIdx >= 0 ? rest.slice(pipeIdx + 1).trim() : '';
      const col = HL_COLORS[colorKey] || HL_COLORS['jaune'];
      const noteHtml = noteText
        ? `<span class="note-float-popup" role="tooltip"><span class="nfp-color-dot" style="background:${col.border}"></span><span class="nfp-text">${escHtml(noteText)}</span></span>`
        : '';
      return `<span class="author-note-hl note-hl-color" data-hl-color="${colorKey}" data-note-text="${escHtml(noteText)}" style="--hl-bg:${col.bg};--hl-border:${col.border}">${escHtml(displayText)}${noteHtml}</span>`;
    }

    // ── TAG [TAG:etiquette texte] ────────────────────────────
    if (p.startsWith('[TAG:') && p.endsWith(']')) {
      const inner = p.slice(5, -1);
      const firstSpace = inner.indexOf(' ');
      if (firstSpace < 0) return escHtml(p);
      const tagKey = inner.slice(0, firstSpace).toLowerCase().trim();
      const text   = inner.slice(firstSpace + 1).trim();
      const tc = TAG_COLORS[tagKey] || { bg: 'rgba(148,163,184,0.2)', border: '#64748b', icon: '🏷' };
      return `<span class="author-note-tag" data-tag="${tagKey}" style="--tag-bg:${tc.bg};--tag-border:${tc.border}" title="${tc.icon} ${tagKey}">${escHtml(text)}<sup class="tag-sup" style="color:${tc.border}">${tc.icon}</sup></span>`;
    }

    if (p.startsWith('~~') && p.endsWith('~~')) return '<s>'      + escHtml(p.slice(2,-2)) + '</s>';
    if (p.startsWith('__') && p.endsWith('__')) return '<u>'      + escHtml(p.slice(2,-2)) + '</u>';
    if (p.startsWith('**') && p.endsWith('**')) return '<strong>' + escHtml(p.slice(2,-2)) + '</strong>';
    if (p.startsWith('*')  && p.endsWith('*'))  return '<em>'     + escHtml(p.slice(1,-1)) + '</em>';
    return escHtml(p);
  }).join('');
}

// Page de garde (4.3)
function buildTitlePageNode(dims) {
  const titre     = getDomVal('pg-titre').trim();
  const auteur    = getDomVal('pg-auteur').trim();
  const soustitre = getDomVal('pg-soustitre').trim();
  const genre     = getDomVal('pg-genre').trim();
  if (!titre && !auteur) return null;

  const page = document.createElement('div');
  page.className = 'book-page' + (dims.cls ? ' ' + dims.cls : '');
  page.dataset.isTitlePage = '1';
  page.style.cssText = 'font-size:' + dims.fs + 'pt;line-height:' + dims.lh + ';position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;';

  if (genre) {
    const g = document.createElement('p');
    g.style.cssText = 'font-family:"Source Serif 4",serif;font-size:10pt;letter-spacing:.15em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:48pt;text-align:center;text-indent:0;';
    g.textContent = genre;
    page.appendChild(g);
  }
  if (titre) {
    const t = document.createElement('h1');
    t.className = 'book-title';
    t.textContent = titre;
    page.appendChild(t);
  }
  if (soustitre) {
    const s = document.createElement('p');
    s.className = 'book-subtitle';
    s.textContent = soustitre;
    page.appendChild(s);
  }
  if (auteur) {
    const a = document.createElement('p');
    a.style.cssText = 'font-family:"Source Serif 4",serif;font-size:13pt;color:var(--ink-soft);margin-top:32pt;text-align:center;letter-spacing:.04em;text-indent:0;';
    a.textContent = auteur;
    page.appendChild(a);
  }
  // Folio absent sur la page de titre (convention éditoriale)
  return page;
}

// ── MOTEUR DE PAGINATION V3 — ARCHITECTURE FRAMES ──────────────────────────
//
// Structure :
//   Page normale    → 1 .frame-body  (hauteur = zone contenu complète)
//   Page chapitre   → .frame-header (hauteur fixe CHAPTER_HEADER_MM)
//                   + .frame-body  (hauteur = zone contenu − CHAPTER_HEADER_MM)
//
// La marge basse est uniforme PAR CONSTRUCTION : les frames ont une hauteur
// fixe CSS avec overflow:hidden. Aucune arithmétique de marge nécessaire.
//
// Reflows : 0 pendant la boucle d'assemblage.
//   Phase 1 : 1 reflow — mesure frame-body vide (hauteur disponible en px)
//   Phase 2 : 1 reflow groupé — mesure de tous les nœuds isolément
//   Phase 3 : 0 reflow — assemblage arithmétique + flush DocumentFragment
// ────────────────────────────────────────────────────────────────────────────

// Dimensions de page centralisées (7.1 — source unique pour aperçu ET export Word)
// PAGE_DIMS supprimé — getPageDims() est la source unique des dimensions

// Hauteur du frame-header (zone titre de chapitre), en mm
// Standard édition : espace généreux au-dessus du titre, ~1/4 de page
const CHAPTER_HEADER_MM = { A4: 55, A5: 60 };
const FOLIO_RESERVE_MM  = 3; // espace réservé au folio (bottom: 3mm dans son CSS)

function mmToPx(mm) {
  // Mesure réelle depuis le DOM pour correspondre exactement à la conversion
  // CSS du navigateur (qui peut différer de 3.7795 selon le zoom/écran).
  if (!mmToPx._ruler) {
    const r = document.createElement('div');
    r.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:100mm;height:100mm;visibility:hidden;pointer-events:none;';
    document.body.appendChild(r);
    mmToPx._ruler = r;
  }
  return mm * (mmToPx._ruler.offsetWidth / 100);
}

function getPageDims() {
  const fmt = getDomVal('page-format');
  const fs  = parseFloat(getDomVal('font-size'));
  const lh  = parseFloat(getDomVal('line-height'));
  const ind = getDomVal('indent-size');

  // ── Formats soumission : A4 double interligne, police imposée ─────────
  if (fmt === 'SUBMIT_AMI') {
    return { fmt:'SUBMIT_AMI', cls:'fmt-submit',
             pageW:210, pageH:297,
             padTop:25, padRight:25, padBot:15, padLeft:30,
             chapterHeaderMm: CHAPTER_HEADER_MM.A4,
             fs: 12, lh: 2.0, ind: '0' };
  }
  if (fmt === 'SUBMIT_STD') {
    return { fmt:'SUBMIT_STD', cls:'fmt-submit',
             pageW:210, pageH:297,
             padTop:25, padRight:25, padBot:15, padLeft:30,
             chapterHeaderMm: CHAPTER_HEADER_MM.A4,
             fs: 12, lh: 2.0, ind: '0' };
  }
  if (fmt === 'ROMAN') {
    return { fmt:'ROMAN', cls:'fmt-roman',
             pageW:135, pageH:215,
             padTop:20, padRight:15, padBot:6, padLeft:18,
             chapterHeaderMm: 65,
             fs, lh, ind };
  }
  if (fmt === 'A5') {
    return { fmt:'A5', cls:'fmt-a5',
             pageW:148, pageH:210,
             padTop:18, padRight:14, padBot:6, padLeft:17,
             chapterHeaderMm: CHAPTER_HEADER_MM.A5,
             fs, lh, ind };
  }
  if (fmt === 'POCHE') {
    return { fmt:'POCHE', cls:'fmt-poche',
             pageW:110, pageH:178,
             padTop:14, padRight:12, padBot:5, padLeft:14,
             chapterHeaderMm: 50,
             fs, lh, ind };
  }
  return { fmt:'A4', cls:'',
           pageW:210, pageH:297,
           padTop:25, padRight:20, padBot:8, padLeft:25,
           chapterHeaderMm: CHAPTER_HEADER_MM.A4,
           fs, lh, ind };
}

function applyNodeStyles(el, dims) {
  if (isSubmitFormat(dims.fmt)) {
    el.style.fontFamily = "'Times New Roman', Georgia, serif";
    el.style.textAlign  = 'left';
    el.style.textIndent = '0';
    el.style.hyphens    = 'none';
    if (el.tagName === 'H2' || el.tagName === 'H3') {
      el.style.fontFamily    = "'Times New Roman', Georgia, serif";
      el.style.fontSize      = '12pt';
      el.style.fontWeight    = 'bold';
      el.style.textAlign     = 'left';
      el.style.fontStyle     = 'normal';
      el.style.textTransform = 'uppercase';
      el.style.letterSpacing = '0.05em';
      el.style.marginTop     = '24pt';
      el.style.marginBottom  = '0';
    }
    return;
  }
  // Correctif : le wrapper .book-image ne doit jamais hériter de text-indent
  if (el.classList && el.classList.contains('book-image')) {
    el.style.textIndent = '0';
    return;
  }
  if (el.tagName === 'P' &&
      !el.classList.contains('no-indent') &&
      !el.classList.contains('scene-break') &&
      !el.classList.contains('caption')) {
    el.style.textIndent = dims.ind;
  }
}

/**
 * Calcule les dimensions des frames en pixels à partir de dims (en mm).
 * Retourne :
 *   frameLeft, frameRight (position absolue depuis bords de page)
 *   contentTop            (top du premier frame = padTop en px)
 *   contentHeight         (hauteur totale dispo = pageH - padTop - padBot - folio)
 *   headerHeight          (hauteur du frame-header, en px)
 *   bodyHeightFull        (frame-body sur page normale = contentHeight)
 *   bodyHeightAfterHeader (frame-body sur page chapitre = contentHeight - headerHeight)
 */
function computeFrameDims(dims) {
  const contentTop    = mmToPx(dims.padTop);
  const contentHeight = mmToPx(dims.pageH - dims.padTop - dims.padBot) - mmToPx(FOLIO_RESERVE_MM);
  const headerHeight  = mmToPx(dims.chapterHeaderMm);
  return {
    frameLeft:             mmToPx(dims.padLeft),
    frameRight:            mmToPx(dims.padRight),
    contentTop,
    contentHeight,
    headerHeight,
    bodyHeightFull:        contentHeight,
    bodyHeightAfterHeader: contentHeight - headerHeight,
  };
}

/**
 * Applique les styles de position/hauteur aux frames d'une page.
 * Appelé UNE SEULE FOIS par page lors de la création — pas de lecture DOM.
 */
function styleFrames(page, fd, hasHeader) {
  const leftPx  = fd.frameLeft  + 'px';
  const rightPx = fd.frameRight + 'px';

  if (hasHeader) {
    const fh = page.querySelector('.frame-header');
    const fb = page.querySelector('.frame-body');
    fh.style.cssText = `top:${fd.contentTop}px;left:${leftPx};right:${rightPx};height:${fd.headerHeight}px;`;
    fb.style.cssText = `top:${fd.contentTop + fd.headerHeight}px;left:${leftPx};right:${rightPx};height:${fd.bodyHeightAfterHeader}px;`;
  } else {
    const fb = page.querySelector('.frame-body');
    fb.style.cssText = `top:${fd.contentTop}px;left:${leftPx};right:${rightPx};height:${fd.bodyHeightFull}px;`;
  }
}

/**
 * Crée une page normale (1 frame-body) ou de chapitre (frame-header + frame-body).
 */
function makePage(dims, fd, pageNum, hasHeader) {
  const page = document.createElement('div');
  page.className = 'book-page' + (dims.cls ? ' ' + dims.cls : '');
  page.style.fontSize   = dims.fs + 'pt';
  page.style.lineHeight = dims.lh;

  const isSubmit = isSubmitFormat(dims.fmt);

  // En-tête courant (format édition seulement) (4.4)
  const headerCourant = getDomVal('header-courant').trim();
  if (headerCourant && !isSubmit) {
    const rh = document.createElement('div');
    rh.className = 'running-header';
    rh.textContent = headerCourant;
    page.appendChild(rh);
  }

  if (hasHeader) {
    const fh = document.createElement('div');
    fh.className = 'frame-header';
    page.appendChild(fh);
  }
  const fb = document.createElement('div');
  fb.className = 'frame-body';
  page.appendChild(fb);

  const folio = document.createElement('div');
  folio.className = 'folio';
  folio.textContent = pageNum;
  page.appendChild(folio);

  styleFrames(page, fd, hasHeader);
  return page;
}

// ── MOTEUR DE PAGINATION V5 — FLUX DANS DES FRAMES (modèle Word / moteur PAO) ───────────────
//
// Modèle mental :
//
//   FLUX DE TEXTE  (source logique — jamais découpée)
//         ↓
//   layout engine natif du navigateur  (kerning, justify, hyphens, ligatures…)
//         ↓  scrollHeight > frameLimit ?
//   overflow → scelle la frame, ouvre la frame suivante, le nœud repart dans le flux
//
// Chaque frame est rendue avec overflow:visible PENDANT le remplissage,
// ce qui permet de lire un scrollHeight exact APRÈS insertion.
// Quand un nœud déborde : on l'ôte, on verrouille la frame (overflow:hidden),
// et le nœud repart au début de la frame suivante.
//
// Aucune estimation, aucun Canvas, aucun probe parallèle.
// Le navigateur fait le vrai layout — on lit juste l'overflow.
// ──────────────────────────────────────────────────────────────────────────────────────────

// Remplaçants stub des fonctions V4 (plus utilisées, conservées pour compatibilité)
const CANVAS_WIDTH_SAFETY = 1;
function buildMeasureCtx(dims) { return { ctx: null, lhPx: 0, fsPx: 0 }; }
function countTextLines()  { return { lineCount: 1 }; }
function measureNodeInLines() { return 1; }
function measureBlockNodePx() { return 0; }
function splitParagraphAtLine(srcNode) { return { fitHTML: srcNode.innerHTML, overflowHTML: '' }; }
function premeasureNodes(nodes) { return nodes.map(() => 0); }

function paginateNodes(nodes, chapters) {
  const container    = document.getElementById('pages-container');
  const _previewPane = document.getElementById('preview-pane');
  const _savedScroll = _previewPane ? _previewPane.scrollTop : 0;

  container.innerHTML = '';

  const dims = getPageDims();
  const fd   = computeFrameDims(dims);

  // ── Cas vide ─────────────────────────────────────────────────────────────
  if (!nodes.length) {
    const titlePage = buildTitlePageNode(dims);
    if (titlePage) {
      const lbl = document.createElement('div');
      lbl.className = 'page-number-label';
      lbl.textContent = 'page de garde';
      container.appendChild(lbl);
      container.appendChild(titlePage);
    } else {
      container.innerHTML =
        '<div style="min-height:400px;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;gap:12px;color:var(--ink-muted);text-align:center;">' +
        '<div style="font-size:48px;opacity:0.3;">📖</div>' +
        '<p style="font-size:14px;max-width:220px;line-height:1.6;">Votre roman mis en page apparaîtra ici.</p></div>';
    }
    updateChapterList(chapters);
    return;
  }

  // ── Page de garde ────────────────────────────────────────────────────────
  const titlePage = buildTitlePageNode(dims);
  if (titlePage) {
    const lbl = document.createElement('div');
    lbl.className = 'page-number-label';
    lbl.textContent = 'page de garde';
    container.appendChild(lbl);
    container.appendChild(titlePage);
  }

  const folioStart = parseInt(document.getElementById('folio-start')?.value) || 1;

  // ════════════════════════════════════════════════════════════════════════
  // MOTEUR TeX-INSPIRED — 3 phases distinctes
  //
  //  Phase 1 : MESURE  — chaque nœud mesuré UNE FOIS dans un probe isolé
  //  Phase 2 : LAYOUT  — page-builder purement arithmétique (zéro DOM)
  //  Phase 3 : FLUSH   — insertion des nœuds dans les frames finales
  //
  // Vocabulaire TeX adapté :
  //   VBox    = nœud de contenu avec height connue
  //   Glue    = espace flexible (margin CSS déjà incluse dans offsetHeight)
  //   Penalty = contrainte de coupure (-∞ force, +∞ interdit)
  // ════════════════════════════════════════════════════════════════════════

  // ── PHASE 1 : Probe de mesure ─────────────────────────────────────────
  //
  // Le probe est en position:fixed, hors écran, avec les mêmes styles
  // typographiques que la frame (font-size, line-height, font-family,
  // largeur identique). On y insère chaque nœud SEUL pour lire offsetHeight.
  // On ne touche pas aux frames réelles pendant cette phase.

  // ── PHASE 1 : Probe de mesure ───────────────────────────────────────────
  //
  // CRITIQUE : le probe doit être une vraie .book-page avec une .frame-body
  // pour que TOUS les sélecteurs CSS s'appliquent :
  //   .book-page p { text-align:justify; hyphens:auto; margin-bottom:0; }
  //   .book-page { font-size:...; line-height:...; }
  // Sans ça, le texte dans le probe n'est pas justifié → wrap différent → hauteur fausse.
  //
  // Architecture du probe :
  //   div[position:fixed, hors-écran, visibility:hidden]   ← wrapper de mesure
  //     └── .book-page[fmt-class, font-size, line-height]  ← cascade CSS identique
  //           └── .frame-body[width exacte, overflow:visible] ← zone de mesure
  //
  // On insère chaque nœud SEUL dans probeFrame, on lit offsetHeight, on retire.

  const probeWrapper = document.createElement('div');
  probeWrapper.style.cssText =
    'position:fixed;top:-99999px;left:-99999px;' +
    'visibility:hidden;pointer-events:none;overflow:visible;';
  document.body.appendChild(probeWrapper);

  const probePage = document.createElement('div');
  probePage.className = 'book-page' + (dims.cls ? ' ' + dims.cls : '');
  probePage.style.fontSize   = dims.fs + 'pt';
  probePage.style.lineHeight = dims.lh;
  // Taille de page réelle pour que les sélecteurs de format s'appliquent
  probePage.style.width    = mmToPx(dims.pageW) + 'px';
  probePage.style.height   = mmToPx(dims.pageH) + 'px';
  probePage.style.overflow = 'visible';
  probeWrapper.appendChild(probePage);

  const probeFrame = document.createElement('div');
  probeFrame.className = 'frame-body';
  // Largeur identique à la vraie frame-body
  probeFrame.style.cssText =
    'position:absolute;overflow:visible;box-sizing:border-box;' +
    'left:' + fd.frameLeft + 'px;' +
    'right:' + fd.frameRight + 'px;' +
    'top:' + fd.contentTop + 'px;' +
    'height:auto;';
  probePage.appendChild(probeFrame);

  // Mesure réelle de bodyHeightFull depuis le DOM :
  // On crée une frame-body temporaire avec la hauteur exacte que styleFrames
  // lui appliquera (fd.bodyHeightFull px), et on lit son offsetHeight.
  // Cela capture les arrondis navigateur et évite toute dérive cumulative.
  const probeBodyMeasure = document.createElement('div');
  probeBodyMeasure.className = 'frame-body';
  probeBodyMeasure.style.cssText =
    'position:absolute;overflow:hidden;box-sizing:border-box;' +
    'left:' + fd.frameLeft + 'px;' +
    'right:' + fd.frameRight + 'px;' +
    'top:' + fd.contentTop + 'px;' +
    'height:' + fd.bodyHeightFull + 'px;';
  probePage.appendChild(probeBodyMeasure);
  const realBodyHeightFull = probeBodyMeasure.offsetHeight;
  probePage.removeChild(probeBodyMeasure);
  // Remplacer fd.bodyHeightFull par la valeur réellement rendue
  fd.bodyHeightFull = realBodyHeightFull;

  const LINE_HEIGHT_PX = mmToPx(dims.fs * 0.352778 * dims.lh); // 1 ligne en px
  const PENALTY_WIDOW  = LINE_HEIGHT_PX * 1.5; // seuil orpheline

  // Limite de saut de page pour les pages normales (sans header de chapitre).
  // On soustrait une constante de confort de 3 lignes pour absorber les arrondis
  // de conversion mm→px entre le moteur de calcul et le rendu navigateur.
  const normalFrameLimit = fd.bodyHeightFull - (LINE_HEIGHT_PX * 3);

  // VBox : { srcNode, el (cloné+stylé), height, isChapter, isFullPage, isWatermark }
  const vboxes = [];

  function resolveMm(val, fallback) {
    const n = parseFloat(val);
    return (val === null || val === undefined || val === '' || isNaN(n)) ? fallback : n;
  }

  for (let ni = 0; ni < nodes.length; ni++) {
    const srcNode     = nodes[ni];
    const isChapter   = !!(srcNode.classList && srcNode.classList.contains('chapter-heading'));
    const isFullPage  = !!(srcNode.dataset && srcNode.dataset.isFullPage === '1');
    const isWatermark = !!(srcNode.dataset && srcNode.dataset.valign === 'watermark');

    // Nœuds plein-page / filigrane : pas de mesure, traitement direct au flush
    if (isFullPage || isWatermark) {
      vboxes.push({ srcNode, el: null, height: 0, isChapter: false, isFullPage, isWatermark });
      continue;
    }

    // Titre de chapitre : pas de mesure nécessaire — la hauteur réservée est fd.headerHeight
    if (isChapter) {
      vboxes.push({ srcNode, el: null, height: 0, isChapter: true, isFullPage: false, isWatermark: false });
      continue;
    }

    // Nœud de flux : mesure dans le probe
    // Le nœud est inséré SEUL dans probeFrame (même cascade CSS que la vraie frame)
    const el = srcNode.cloneNode(true);
    applyNodeStyles(el, dims);

    probeFrame.innerHTML = '';
    probeFrame.appendChild(el);
    const h = probeFrame.offsetHeight;  // hauteur calculée par le vrai layout CSS

    vboxes.push({ srcNode, el, height: h, isChapter: false, isFullPage: false, isWatermark: false });
  }


  // Nettoyer le probe — plus besoin
  document.body.removeChild(probeWrapper);

  // ── PHASE 2 : Page-builder arithmétique ──────────────────────────────
  //
  // On parcourt les vboxes et on construit un plan de pages :
  // plan = tableau de PagePlan { hasHeader, chapterNode, items[] }
  // items = tableau de vboxes à placer dans cette frame
  //
  // Penalties TeX :
  //   chapter-heading → force une nouvelle page (penalty = -∞)
  //   titre en dernière position sur une page → interdit (penalty = +∞)
  //     → on anticipe : si le prochain nœud est un chapitre ET qu'on est
  //       à moins d'une ligne de hauteur de la limite → on coupe avant.

  const pages = []; // PagePlan[]

  function newPage(hasHeader, chapterNode) {
    const p = { hasHeader: hasHeader || false, chapterNode: chapterNode || null, items: [] };
    pages.push(p);
    return p;
  }

  // NE PAS pré-créer de page : la première est créée au premier nœud de flux,
  // ou par le premier chapter-heading. Évite les pages vides en tête.
  let currentPage = null;
  let cursor = 0;
  let frameLimit = normalFrameLimit;

  function ensureNormalPage() {
    if (!currentPage) {
      currentPage = newPage(false, null);
      cursor = 0;
      frameLimit = normalFrameLimit;
    }
  }

  for (let vi = 0; vi < vboxes.length; vi++) {
    const vb = vboxes[vi];

    // ── Chapitre : nouvelle page forcée (penalty -∞) ──────────────────
    if (vb.isChapter) {
      currentPage = newPage(true, vb.srcNode);
      cursor = 0;
      // Exception première page de chapitre :
      // Le frame-header occupe fd.headerHeight px. On soustrait également
      // une constante de confort de 3 lignes pour absorber les arrondis
      // de conversion mm→px et les micro-décalages de rendu CSS.
      frameLimit = fd.bodyHeightFull - fd.headerHeight - (LINE_HEIGHT_PX * 3);
      continue;
    }

    // ── Pleine page / filigrane : page dédiée ou overlay ─────────────
    if (vb.isFullPage) {
      const fpPage = newPage(false, null);
      fpPage.isFullPage = true;
      fpPage.fullPageNode = vb.srcNode;
      currentPage = null;
      cursor = 0;
      frameLimit = normalFrameLimit;
      continue;
    }
    if (vb.isWatermark) {
      ensureNormalPage();
      currentPage.watermarkNode = vb.srcNode;
      continue;
    }

    ensureNormalPage();

    const fits = (cursor + vb.height) <= frameLimit;

    if (!fits) {
      if (currentPage.items.length === 0) {
        currentPage.items.push(vb);
        cursor += vb.height;
      } else {
        // Saut de page normale → normalFrameLimit
        currentPage = newPage(false, null);
        cursor = 0;
        frameLimit = normalFrameLimit;
        currentPage.items.push(vb);
        cursor += vb.height;
      }
    } else {
      currentPage.items.push(vb);
      cursor += vb.height;
    }
  }

  // ── PHASE 3 : Flush DOM ───────────────────────────────────────────────
  //
  // On parcourt le plan et on construit les pages HTML.
  // Aucune mesure ici — tout est déjà connu.

  let pageNum = folioStart;

  for (let pi = 0; pi < pages.length; pi++) {
    const plan = pages[pi];

    // ── Page plein-page image ─────────────────────────────────────────
    if (plan.isFullPage && plan.fullPageNode) {
      const srcNode = plan.fullPageNode;
      const key    = srcNode.dataset.imgKey;
      const imgDat = images[key] || {};
      const valign = srcNode.dataset.valign || 'middle';
      const rot    = imgDat.rotation || 0;
      const rotCSS = rot ? 'rotate(' + rot + 'deg)' : '';

      const mT = mmToPx(resolveMm(imgDat.marginTop,   dims.padTop));
      const mB = mmToPx(resolveMm(imgDat.marginBot,   dims.padBot));
      const mL = mmToPx(resolveMm(imgDat.marginLeft,  dims.padLeft));
      const mR = mmToPx(resolveMm(imgDat.marginRight, dims.padRight));
      const availW = Math.max(1, mmToPx(dims.pageW) - mL - mR);
      const availH = Math.max(1, mmToPx(dims.pageH) - mT - mB);
      const imgW   = availW * (imgDat.width || 100) / 100;

      const dedicatedPage = document.createElement('div');
      dedicatedPage.className = 'book-page' + (dims.cls ? ' ' + dims.cls : '');
      dedicatedPage.style.cssText = 'font-size:' + dims.fs + 'pt;line-height:' + dims.lh + ';position:relative;overflow:visible;';
      dedicatedPage.dataset.isFullPageImg = '1';
      dedicatedPage.dataset.imgKey        = key;
      dedicatedPage.dataset.valign        = valign;
      dedicatedPage.dataset.userWpct      = imgDat.width || 100;
      dedicatedPage.dataset.align         = imgDat.align || 'center';
      dedicatedPage.dataset.rotation      = rot;
      dedicatedPage.dataset.marginTopMm   = resolveMm(imgDat.marginTop,   dims.padTop);
      dedicatedPage.dataset.marginBotMm   = resolveMm(imgDat.marginBot,   dims.padBot);
      dedicatedPage.dataset.marginLeftMm  = resolveMm(imgDat.marginLeft,  dims.padLeft);
      dedicatedPage.dataset.marginRightMm = resolveMm(imgDat.marginRight, dims.padRight);

      const jc = imgDat.align === 'left' ? 'flex-start' : imgDat.align === 'right' ? 'flex-end' : 'center';
      const imgContainer = document.createElement('div');
      imgContainer.style.cssText =
        'position:absolute;left:' + mL + 'px;top:' + mT + 'px;' +
        'width:' + availW + 'px;height:' + availH + 'px;' +
        'display:flex;align-items:' + (valign === 'fill' ? 'stretch' : 'center') + ';' +
        'justify-content:' + jc + ';overflow:visible;';

      const imgEl = document.createElement('img');
      imgEl.src = imgDat.src || '';
      imgEl.alt = imgDat.caption || key;
      imgEl.style.cssText = (valign === 'fill')
        ? 'width:' + imgW + 'px;height:' + availH + 'px;object-fit:cover;display:block;flex-shrink:0;' + (rotCSS ? 'transform:' + rotCSS + ';' : '')
        : 'width:' + imgW + 'px;height:auto;display:block;object-fit:contain;flex-shrink:0;' + (rotCSS ? 'transform:' + rotCSS + ';' : '');
      imgContainer.appendChild(imgEl);

      if (imgDat.caption) {
        const cap = document.createElement('p');
        cap.className = 'caption';
        cap.style.cssText = 'position:absolute;bottom:' + Math.max(4, mB - 16) + 'px;left:' + mL + 'px;right:' + mR + 'px;text-align:center;margin:0;';
        cap.textContent = imgDat.caption;
        dedicatedPage.appendChild(cap);
      }

      const folio = document.createElement('div');
      folio.className = 'folio';
      folio.textContent = pageNum;
      const lbl = document.createElement('div');
      lbl.className = 'page-number-label';
      lbl.textContent = 'page ' + pageNum;

      dedicatedPage.appendChild(imgContainer);
      dedicatedPage.appendChild(folio);
      container.appendChild(lbl);
      container.appendChild(dedicatedPage);
      pageNum++;
      continue;
    }

    // ── Page normale ou de chapitre ───────────────────────────────────
    const lbl = document.createElement('div');
    lbl.className = 'page-number-label';
    lbl.textContent = pi === 0 ? 'page ' + pageNum : 'page ' + pageNum;

    const pg = makePage(dims, fd, pageNum, plan.hasHeader);

    // Remplir le frame-header si page de chapitre
    if (plan.hasHeader && plan.chapterNode) {
      const fh = pg.querySelector('.frame-header');
      const chEl = plan.chapterNode.cloneNode(true);
      applyNodeStyles(chEl, dims);
      fh.appendChild(chEl);
      fh.style.overflow = 'hidden';
    }

    // Remplir le frame-body avec les items du plan
    const fb = pg.querySelector('.frame-body');
    fb.style.overflow = 'hidden'; // toujours hidden — la mesure est déjà faite
    const frag = document.createDocumentFragment();
    for (const vb of plan.items) {
      // Réutiliser l'élément déjà cloné+stylé de la phase 1
      frag.appendChild(vb.el);
    }
    fb.appendChild(frag);

    // Filigrane éventuel
    if (plan.watermarkNode) {
      const wm = plan.watermarkNode.cloneNode(true);
      applyNodeStyles(wm, dims);
      pg.style.position = 'relative';
      pg.style.overflow = 'hidden';
      pg.appendChild(wm);
    }

    container.appendChild(lbl);
    container.appendChild(pg);
    pageNum++;
  }

  updateChapterList(chapters);
  renderImgList();

  if (_previewPane && _savedScroll > 0) {
    requestAnimationFrame(() => { _previewPane.scrollTop = _savedScroll; });
  }
}

