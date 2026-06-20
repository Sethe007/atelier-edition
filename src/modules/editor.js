// ── VUES ───────────────────────────────────────────────
function setView(mode) {
  const ip = document.getElementById('input-pane');
  const pp = document.getElementById('preview-pane');
  ['btn-split','btn-edit','btn-preview'].forEach(id =>
    document.getElementById(id).classList.remove('active'));
  document.getElementById('btn-'+mode).classList.add('active');
  if (mode === 'split') { ip.style.display = ''; pp.style.display = ''; }
  else if (mode === 'edit') { ip.style.display = ''; pp.style.display = 'none'; }
  else { ip.style.display = 'none'; pp.style.display = ''; }
}

// ── INPUT ──────────────────────────────────────────────
function onRawInput() {
  // Réinitialiser la recherche si le texte change
  if (_esMatches && _esMatches.length) {
    _esMatches = []; _esCurrent = -1;
    const count = document.getElementById('es-count');
    const btnP  = document.getElementById('es-prev');
    const btnN  = document.getElementById('es-next');
    const ta    = document.getElementById('raw-input');
    if (count) count.textContent = '';
    if (btnP)  btnP.disabled = true;
    if (btnN)  btnN.disabled = true;
    if (ta)    ta.classList.remove('es-searching');
  }
  markUnsaved();
  // Indicateur visuel "recalcul en cours"
  const container = document.getElementById('pages-container');
  if (container) container.style.opacity = '0.5';
  // OPT #5 FIX : updateStats() inclus dans le debounce pour éviter un recomptage
  // complet à chaque frappe sur de longs textes. L'affichage est légèrement retardé
  // (DEBOUNCE_MS) mais reste cohérent avec la pagination.
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    updateStats();
    formatRoman();
    if (container) container.style.opacity = '1';
    if (typeof _ANNOT !== 'undefined') _ANNOT.render();
  }, DEBOUNCE_MS);
}

function updateStats() {
  const text  = getDomVal('raw-input');
  const clean = cleanForCounting(text);

  const words = clean.trim() ? clean.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
  const chars = text.length;
  const lines = text.split('\n');
  let chapters = 0;
  lines.forEach(line => { if (detectHeadingLevel(line.trim()) === 1) chapters++; });

  const fmt = getDomVal('page-format');
  const wordsPerPage = {
    A4: 250, ROMAN: 220, A5: 170, POCHE: 130, SUBMIT_AMI: 1500, SUBMIT_STD: 250,
  }[fmt] || 250;

  let pageLabel = '~' + Math.ceil(words / wordsPerPage);
  if (isSubmitFormat(fmt)) {
    pageLabel = '~' + Math.ceil(chars / 1500) + ' f.';
  }

  document.getElementById('stat-words').textContent    = words.toLocaleString('fr');
  document.getElementById('stat-chars').textContent    = chars.toLocaleString('fr');
  document.getElementById('stat-chapters').textContent = chapters;
  document.getElementById('stat-pages').textContent    = pageLabel;
  const pageLbl = document.getElementById('stat-pages-lbl');
  if (pageLbl) pageLbl.textContent = isSubmitFormat(fmt) ? 'feuillets' : 'pages est.';
}

// ── DÉTECTION STRUCTURE ────────────────────────────────
function detectHeadingLevel(line) {
  const l = line.trim();

  // Exclusions immédiates : dialogue et ponctuation narrative
  // Tiret cadratin ou dialogue : jamais un titre
  if (/^[—–-]/.test(l)) return 0;
  // Guillemets ouvrants = réplique de dialogue
  if (/^[«“"]/.test(l)) return 0;
  // Ligne qui se termine par ! ou ? et n'est pas un mot-clé de chapitre
  if (/[!?]$/.test(l) && !/^(chapitre|chapter|partie|part|livre|book|prologue|épilogue|epilogue)/i.test(l)) return 0;
  // Contient des guillemets typographiques intérieurs = narration/dialogue
  if (/[«»“”]/.test(l)) return 0;

  // H1 — mots-clés explicites de chapitrage
  if (/^(chapitre|chapter)\s+/i.test(l)) return 1;
  if (/^(partie|part|book|livre)\s+/i.test(l)) return 1;
  if (/^(prologue|épilogue|epilogue|incipit|postface|avant-propos|introduction|conclusion)$/i.test(l)) return 1;

  // H1 — chiffre romain seul ou avec séparateur et titre court
  if (/^[IVXivx]+\.?\s*$/.test(l)) return 1;
  if (/^[IVXivx]+\s*[.\-—]\s*[A-Z\u00C0-\u00DC\w]/.test(l) && l.length < 60 && !/[!?]/.test(l)) return 1;

  // H1 — numéro arabe + titre en majuscule
  if (/^[0-9]+\s*[.\-—]\s*[A-Z\u00C0-\u00DC]/.test(l) && l.length < 60 && !/[!?]/.test(l)) return 1;

  // H1 — ligne entièrement en MAJUSCULES stricte
  // Doit avoir au moins 4 lettres, max 50 chars, sans ponctuation de dialogue ni exclamation
  // BUG #8 FIX : exclure les cris narratifs (ligne contenant des espaces ET
  // ressemblant à une phrase courte sans structure de titre : pas de chiffres,
  // pas de mot-clé de chapitre). On exige au moins 2 mots pour les formes libres.
  const letters = l.replace(/[^A-Za-z\u00C0-\u00FF]/g, '');
  const wordCount = l.trim().split(/\s+/).length;
  if (l === l.toUpperCase()
      && letters.length >= 4
      && l.length <= 50
      && !/[!?:,;.…]/.test(l)
      && !/^[—–\-«»"]/.test(l)
      && (wordCount >= 2 || /^(chapitre|chapter|partie|part|livre|book|prologue|épilogue|epilogue|acte|tome)/i.test(l) || /\d/.test(l))) return 1;

  // H2 — séparateur de scène stylistique (* Titre de scène)
  if (/^\*\s+\S/.test(l)) return 2;

  return 0;
}

function isSceneBreak(line) {
  return /^[\*\-~•·=]{2,}\s*$/.test(line.trim()) || /^\s*(\*\s*){2,}\s*$/.test(line);
}

// ── FORMATAGE PRINCIPAL ────────────────────────────────
function formatRoman() {
  _resetRenderNoteIdx();
  const raw = getDomVal('raw-input');
  if (!raw.trim()) { paginateNodes([], []); return; }

  const lines = raw.split('\n');
  const nodes = [];
  let chapters = [];
  let prevWasHeading = false;
  let prevWasEmpty = false;
  let i = 0;

  function makeEl(tag, cls, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html !== undefined) el.innerHTML = html;
    return el;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      prevWasEmpty = true;
      i++;
      continue;
    }

    // Image placeholder
    const imgMatch = trimmed.match(/^\[IMAGE:([^\]]+)\]$/i);
    if (imgMatch) {
      const key = imgMatch[1].trim().toLowerCase();
      if (images[key]) {
        const img    = images[key];
        const rot    = img.rotation  || 0;
        const w      = img.width     || 100;
        const align  = img.align     || 'center';
        const valign = img.valign    || 'top';

        // Modes pleine-page (page dédiée)
        const isFullPage = (valign === 'middle' || valign === 'fill');
        // Modes flottants (texte enveloppant)
        const isFloat = (valign === 'float-left' || valign === 'float-right');
        // Mode bandeau (pleine largeur dans le flux)
        const isBandeau = (valign === 'bandeau');
        // Mode filigrane (fond de page, position absolue)
        const isWatermark = (valign === 'watermark');

        const wrapAlign = align === 'left'  ? 'margin-right:auto;margin-left:0'
                        : align === 'right' ? 'margin-left:auto;margin-right:0'
                        : 'margin-left:auto;margin-right:auto';

        const wrap = document.createElement('div');

        let wrapClass = 'book-image';
        if (isFullPage)              wrapClass += ' book-image-fullpage';
        else if (valign === 'float-left')  wrapClass += ' img-float-left';
        else if (valign === 'float-right') wrapClass += ' img-float-right';
        else if (isBandeau)          wrapClass += ' img-bandeau';
        else if (isWatermark)        wrapClass += ' img-watermark';

        wrap.className = wrapClass;

        // Espacement avant/après l'image (en pt) — contrôlé par spaceBefore/spaceAfter
        // null = héritage CSS (16pt haut / 10pt bas par défaut)
        const _sBefore = img.spaceBefore != null ? img.spaceBefore + 'pt' : null;
        const _sAfter  = img.spaceAfter  != null ? img.spaceAfter  + 'pt' : null;

        if (isFloat) {
          wrap.style.cssText = 'width:' + w + '%;position:relative;';
          // Marges CSS par défaut img-float-left/right : 4pt haut, 8pt bas — on override si customisé
          if (_sBefore) wrap.style.setProperty('margin-top',    _sBefore, 'important');
          if (_sAfter)  wrap.style.setProperty('margin-bottom', _sAfter,  'important');
        } else if (isBandeau) {
          wrap.style.cssText = 'width:100%;position:relative;';
          if (_sBefore) wrap.style.setProperty('margin-top',    _sBefore, 'important');
          if (_sAfter)  wrap.style.setProperty('margin-bottom', _sAfter,  'important');
        } else if (isWatermark) {
          // Filigrane : opacité contrôlable (défaut 10%), largeur pilotée par CSS
          const opacityVal = (img.opacity != null) ? img.opacity : 0.10;
          wrap.style.cssText = 'width:' + w + '%;position:relative;opacity:' + opacityVal + ';';
        } else {
          // Flux normal : marges inline avec !important pour survivre à la cascade CSS
          const _mt = _sBefore || '16pt';
          const _mb = _sAfter  || '10pt';
          wrap.style.cssText = 'width:' + w + '%;' + wrapAlign + ';text-align:' + align + ';position:relative;';
          wrap.style.setProperty('margin-top',    _mt, 'important');
          wrap.style.setProperty('margin-bottom', _mb, 'important');
        }

        wrap.dataset.imgKey    = key;
        wrap.dataset.valign    = valign;
        wrap.dataset.isFullPage = isFullPage ? '1' : '0';

        // Tooltip de taille
        const tooltip = document.createElement('div');
        tooltip.className = 'img-size-tooltip';
        tooltip.textContent = w + '%';
        wrap.appendChild(tooltip);

        const im = document.createElement('img');
        im.src = img.src;
        im.alt = img.caption || key;
        im.style.cssText = 'transform:rotate(' + rot + 'deg);max-width:100%;display:block;margin:0 auto;';
        wrap.appendChild(im);

        // Poignées (masquées en mode bandeau et watermark pour éviter confusion)
        if (!isBandeau && !isWatermark) {
          const handleR = document.createElement('div');
          handleR.className = 'img-resize-handle';
          handleR.dataset.side = 'right';
          wrap.appendChild(handleR);

          const handleL = document.createElement('div');
          handleL.className = 'img-resize-handle left';
          handleL.dataset.side = 'left';
          wrap.appendChild(handleL);
        }

        nodes.push(wrap);
        if (img.caption) nodes.push(makeEl('p', 'caption', escHtml(img.caption)));

        // BUG #6 FIX : injecter le clear dans le flux pour éviter que le texte
        // suivant coule sous l'image flottante.
        if (isFloat) {
          const clearEl = document.createElement('div');
          clearEl.className = 'img-float-clear';
          nodes.push(clearEl);
        }
      } else {
        nodes.push(makeEl('p', 'caption', '[Image ' + escHtml(imgMatch[1]) + ' non chargée]'));
      }
      i++; prevWasEmpty = false; prevWasHeading = false;
      continue;
    }

    // Saut de scène
    if (isSceneBreak(trimmed)) {
      nodes.push(makeEl('p', 'scene-break', '* * *'));
      i++; prevWasEmpty = true; prevWasHeading = false;
      continue;
    }

    const level = detectHeadingLevel(trimmed);

    if (level === 1) {
      const id = 'ch-' + chapters.length;
      const el = makeEl('h2', 'chapter-heading', `<span class="chapter-ornament">✦</span>${escHtml(trimmed)}`);
      el.id = id;
      nodes.push(el);
      chapters.push({ id, text: trimmed, level: 1 });
      prevWasHeading = true;
      prevWasEmpty = false;
      i++;
      continue;
    }

    if (level === 2) {
      const id = 'sec-' + chapters.length;
      const el = makeEl('h3', 'section-heading', escHtml(trimmed));
      el.id = id;
      nodes.push(el);
      chapters.push({ id, text: trimmed, level: 2 });
      prevWasHeading = true;
      prevWasEmpty = false;
      i++;
      continue;
    }

    // Paragraphe normal
    const noIndent = prevWasHeading || prevWasEmpty;
    const cls = noIndent ? 'no-indent' : '';
    nodes.push(makeEl('p', cls, renderInlineMarkup(trimmed)));
    prevWasHeading = false;
    prevWasEmpty = false;
    i++;
  }

  paginateNodes(nodes, chapters);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Compteur global pour indexer les notes dans la preview
let _renderNoteIdx = 0;
function _resetRenderNoteIdx() { _renderNoteIdx = 0; }

