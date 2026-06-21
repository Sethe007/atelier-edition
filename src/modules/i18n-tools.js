// ══════════════════════════════════════════════════════════════════════════════
// SE — MOTEUR DE RECHERCHE UNIFIÉ (v2)
// Remplace scrollTextareaToIndex, wtScrollToText, wtHighlightAll, wtScrollToIndex
// et toute la barre Rechercher/Remplacer par un seul moteur robuste.
//
// API publique :
//   SE.scrollTo(ta, charIndex)              → scroll centré sur charIndex
//   SE.findOne(query, [startAfter])         → {start,end} | null  (sous-chaîne exacte, insensible casse)
//   SE.findAll(query, [wordBoundary])       → [{start,end}, …]
//   SE.fuzzyFind(phrase, [maxLen])          → {start,end} | null  (phrase longue : cherche sous-chaîne normalisée)
//   SE.goTo(start, end, [flashColor])       → sélectionne + scroll + flash
//   SE.highlightAll(query, [jumpTo])        → active le badge de navigation multi-occurrences
//   SE.clear()                             → efface la navigation courante
// ══════════════════════════════════════════════════════════════════════════════
const SE = (() => {
  // ── Helpers internes ──────────────────────────────────────────────────────

  /** Normalise une chaîne pour la comparaison : minuscules + espaces/newlines collapsés */
  function _norm(s) {
    return s.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  /** Calcule le scrollTop cible pour centrer charIndex dans le textarea */
  function _scrollTarget(ta, charIndex) {
    const cs = window.getComputedStyle(ta);
    const mirror = document.createElement('div');
    ['fontFamily','fontSize','fontWeight','fontStyle','fontVariant',
     'lineHeight','letterSpacing','wordSpacing','textIndent',
     'paddingTop','paddingRight','paddingBottom','paddingLeft',
     'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
     'boxSizing','overflowWrap','whiteSpace','tabSize'
    ].forEach(p => { mirror.style[p] = cs[p]; });
    mirror.style.cssText += ';width:' + ta.clientWidth + 'px;white-space:pre-wrap;word-break:break-word;' +
      'position:absolute;visibility:hidden;top:0;left:0;z-index:-1;';

    const before = document.createElement('span');
    before.textContent = ta.value.slice(0, charIndex);
    const marker = document.createElement('span');
    marker.textContent = '\u200b'; // zero-width space — occupe une position sans décaler le texte

    mirror.appendChild(before);
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const markerTop = marker.offsetTop;
    document.body.removeChild(mirror);

    const lineH    = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 22;
    const taHeight = ta.clientHeight;
    return Math.max(0, markerTop - taHeight / 2 + lineH / 2);
  }

  // ── API publique ──────────────────────────────────────────────────────────

  /** Scroll centré sur charIndex (double-RAF pour tous les navigateurs) */
  function scrollTo(ta, charIndex) {
    if (!ta || charIndex < 0) return;
    const target = _scrollTarget(ta, charIndex);
    requestAnimationFrame(() => {
      ta.scrollTop = target;
      requestAnimationFrame(() => { ta.scrollTop = target; });
    });
  }

  /**
   * Trouve la première occurrence de query dans le textarea à partir de startAfter.
   * Recherche insensible à la casse, sous-chaîne exacte.
   * @returns {start, end} | null
   */
  function findOne(query, startAfter) {
    if (!query) return null;
    const ta = getTA();
    if (!ta) return null;
    const text  = ta.value;
    const lower = text.toLowerCase();
    const q     = query.toLowerCase();
    const from  = (typeof startAfter === 'number') ? startAfter : 0;
    const idx   = lower.indexOf(q, from);
    if (idx < 0) return null;
    return { start: idx, end: idx + query.length };
  }

  /**
   * Trouve TOUTES les occurrences de query.
   * wordBoundary = true → frontière de mot Unicode (pour mots isolés).
   * wordBoundary = false (défaut) → sous-chaîne pure, idéal pour phrases/expressions.
   */
  function findAll(query, wordBoundary) {
    if (!query) return [];
    const ta = getTA();
    if (!ta) return [];
    const text = ta.value;
    const results = [];

    if (wordBoundary) {
      // Regex avec frontière de mot Unicode (français inclus)
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(
        '(?<![\\wàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ])' + escaped +
        '(?![\\wàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ])', 'gi'
      );
      let m;
      while ((m = re.exec(text)) !== null) results.push({ start: m.index, end: m.index + m[0].length });
    } else {
      // Sous-chaîne pure insensible à la casse — fiable pour toute longueur
      const lower = text.toLowerCase();
      const q     = query.toLowerCase();
      let pos = 0;
      while (pos < lower.length) {
        const idx = lower.indexOf(q, pos);
        if (idx < 0) break;
        results.push({ start: idx, end: idx + query.length });
        pos = idx + 1;
      }
    }
    return results;
  }

  /**
   * Recherche floue d'une phrase longue :
   * - Normalise les espaces et sauts de ligne
   * - Utilise les N premiers caractères (maxLen, défaut 80) comme clé de recherche
   * - Retourne la position réelle dans ta.value
   * Robuste face aux phrases extraites par le parser de style (qui peut décaler les espaces).
   */
  function fuzzyFind(phrase, maxLen) {
    if (!phrase) return null;
    const ta = getTA();
    if (!ta) return null;
    const text = ta.value;
    const n    = maxLen || 80;

    // 1. Essai exact (sous-chaîne directe)
    const exact = findOne(phrase.trim());
    if (exact) return exact;

    // 2. Normaliser la phrase et le texte, puis chercher
    const normPhrase = _norm(phrase).slice(0, n);
    const normText   = _norm(text);
    const normIdx    = normText.indexOf(normPhrase);
    if (normIdx < 0) return null;

    // 3. Retrouver la position réelle dans le texte original
    //    en comptant les caractères en ignorant les \r et les espaces multiples
    let realIdx = 0;
    let normCount = 0;
    // Parcourir text jusqu'à accumuler normCount chars qui correspondent à normIdx dans normText
    let ni = 0; // curseur dans normText reconstruit
    for (let i = 0; i < text.length && ni < normIdx; i++) {
      const c = text[i];
      if (c === '\r') continue;
      // Collapsing multiple spaces : si normText n'a qu'un seul espace à cette position, on saute les doublons
      if ((c === ' ' || c === '\t' || c === '\n') && ni > 0 && normText[ni - 1] === ' ') {
        realIdx = i + 1;
        continue;
      }
      ni++;
      realIdx = i + 1;
    }

    // 4. Depuis realIdx, calculer la longueur réelle de la phrase originale
    //    en cherchant à partir de realIdx la longueur la plus courte qui matche normPhrase
    const candidate = text.slice(Math.max(0, realIdx - 2), realIdx + normPhrase.length + 20);
    const normCand  = _norm(candidate);
    const cnIdx     = normCand.indexOf(normPhrase);
    if (cnIdx < 0) return { start: Math.max(0, realIdx - 2), end: Math.min(text.length, realIdx + normPhrase.length + 10) };

    const absStart  = Math.max(0, realIdx - 2) + cnIdx;
    // Longueur de la correspondance dans le texte original
    let rawLen = normPhrase.length;
    let counted = 0, ri = absStart;
    while (ri < text.length && counted < normPhrase.length) {
      const c = text[ri];
      if (c !== '\r') counted++;
      ri++;
      rawLen = ri - absStart;
    }
    return { start: absStart, end: absStart + rawLen };
  }

  /**
   * Sélectionne start..end dans le textarea, scroll, et fait un flash de couleur.
   * flashColor : 'yellow' (défaut) | 'blue'
   */
  function goTo(start, end, flashColor) {
    const ta = getTA();
    if (!ta || start < 0) return;
    const color = flashColor === 'blue' ? '#dbeafe' : '#fffbe6';
    ta.focus();
    ta.setSelectionRange(start, end);
    scrollTo(ta, start);
    ta.style.transition = 'background 0.15s';
    ta.style.background = color;
    setTimeout(() => { ta.style.background = ''; }, 700);
  }

  // ── Navigation multi-occurrences (badge flottant) ─────────────────────────
  let _word  = null;
  let _hits  = [];
  let _cur   = 0;

  function _ensureBadge() {
    let b = document.getElementById('se-nav-badge');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'se-nav-badge';
    b.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'background:var(--ink);color:var(--parchment);font-family:\'DM Sans\',sans-serif;font-size:12px;' +
      'padding:6px 14px;border-radius:20px;display:flex;align-items:center;gap:10px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.35);z-index:9999;user-select:none;white-space:nowrap;';
    b.innerHTML =
      '<span id="se-word-label" style="font-style:italic;opacity:.8;max-width:140px;overflow:hidden;text-overflow:ellipsis;"></span>' +
      '<span id="se-counter" style="font-weight:500;"></span>' +
      '<button id="se-prev" onclick="SE.prev()" title="' + _t('se_prev') + '" ' +
        'style="background:rgba(255,255,255,0.15);border:none;color:inherit;border-radius:50%;' +
        'width:22px;height:22px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;">◀</button>' +
      '<button id="se-next" onclick="SE.next()" title="' + _t('se_next') + '" ' +
        'style="background:rgba(255,255,255,0.15);border:none;color:inherit;border-radius:50%;' +
        'width:22px;height:22px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;">▶</button>' +
      '<button onclick="SE.clear()" title="' + _t('se_close') + '" ' +
        'style="background:rgba(255,255,255,0.12);border:none;color:inherit;border-radius:50%;' +
        'width:22px;height:22px;cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;opacity:.7;">✕</button>';
    document.body.appendChild(b);
    return b;
  }

  function _updateBadge() {
    const total = _hits.length;
    const c = document.getElementById('se-counter');
    if (c) c.textContent = `${_cur + 1} / ${total}`;
    const prev = document.getElementById('se-prev');
    const next = document.getElementById('se-next');
    if (prev) prev.style.opacity = _cur === 0 ? '0.35' : '1';
    if (next) next.style.opacity = _cur === total - 1 ? '0.35' : '1';
  }

  function _jumpTo(i) {
    if (!_hits.length) return;
    const h = _hits[i];
    goTo(h.start, h.end, 'yellow');
    _updateBadge();
  }

  /**
   * Démarre la navigation multi-occurrences sur query.
   * wordBoundary : true = frontière de mot (mots isolés), false = sous-chaîne (défaut).
   * jumpTo : index de départ (défaut 0).
   */
  function highlightAll(query, jumpTo, wordBoundary) {
    if (!query) return;
    const hits = findAll(query, wordBoundary !== false && wordBoundary === true);
    if (!hits.length) {
      // Fallback sous-chaîne pure
      const h = findOne(query);
      if (h) goTo(h.start, h.end, 'yellow');
      else showToast(_t('toast_word_not_found'), 2000, 'error');
      return;
    }
    _word = query;
    _hits = hits;
    _cur  = typeof jumpTo === 'number' ? Math.max(0, Math.min(jumpTo, hits.length - 1)) : 0;

    const badge = _ensureBadge();
    badge.style.display = 'flex';
    const lbl = document.getElementById('se-word-label');
    if (lbl) lbl.textContent = `« ${query.length > 30 ? query.slice(0, 30) + '…' : query} »`;
    _jumpTo(_cur);
  }

  function next() {
    if (!_hits.length) return;
    _cur = (_cur + 1) % _hits.length;
    _jumpTo(_cur);
  }

  function prev() {
    if (!_hits.length) return;
    _cur = (_cur - 1 + _hits.length) % _hits.length;
    _jumpTo(_cur);
  }

  function clear() {
    _word = null; _hits = []; _cur = 0;
    const b = document.getElementById('se-nav-badge');
    if (b) b.style.display = 'none';
  }

  /** Synchronise les hits internes sans déplacer le focus (usage barre de recherche) */
  function _esSync(query, hits) {
    _word = query;
    _hits = hits;
    _cur  = 0;
    // Masquer le badge flottant en mode barre (la barre a son propre compteur)
    const b = document.getElementById('se-nav-badge');
    if (b) b.style.display = 'none';
  }

  return { scrollTo, findOne, findAll, fuzzyFind, goTo, highlightAll, next, prev, clear, _esSync };
})();

// ── Compatibilité : les anciennes fonctions délèguent toutes à SE ─────────────

/** Scroll centré sur charIndex dans le textarea — conservé pour compatibilité */
function scrollTextareaToIndex(ta, idx) { SE.scrollTo(ta, idx); }

/** Localise la première occurrence de raw (sous-chaîne exacte, insensible casse) */
function wtScrollToText(raw) {
  if (!raw) return;
  const h = SE.fuzzyFind(raw) || SE.findOne(raw);
  if (!h) { showToast(_t('toast_word_not_found'), 2000, 'error'); return; }
  SE.goTo(h.start, h.end, 'yellow');
}

/** Met en évidence toutes les occurrences d'un mot et ouvre le badge de navigation */
function wtHighlightAll(word, jumpTo) {
  // Pour les mots simples : frontière de mot. Pour les expressions : sous-chaîne.
  const isMultiWord = word && word.trim().indexOf(' ') >= 0;
  SE.highlightAll(word, jumpTo, !isMultiWord);
}

/** Ferme le badge de navigation */
function wtHighlightClear() { SE.clear(); }

/** Rétrocompat : navigation directe */
function wtHighlightNext() { SE.next(); }
function wtHighlightPrev() { SE.prev(); }

/** Scroll vers un offset absolu sans sélection */
function wtScrollToIndex(offset) {
  const ta = getTA();
  if (!ta || offset < 0) return;
  ta.focus();
  ta.setSelectionRange(offset, offset);
  SE.scrollTo(ta, offset);
}

// ══════════════════════════════════════════════════════════
// BARRE DE RECHERCHE ÉDITEUR
// ══════════════════════════════════════════════════════════
let _esMatches     = [];
let _esCurrent     = -1;
let _esSearchTimer = null;
let _esLastQuery   = '';
let _esActive      = false;  // true = mode recherche actif, frappes redirigées vers es-input

// Quand le mode recherche est actif, toutes les frappes (sauf Entrée/Echap)
// sont redirigées vers la barre de recherche, sans quitter le focus du textarea.
document.addEventListener('keydown', function(e) {
  if (!_esActive) return;
  const bar = document.getElementById('es-input');
  const ta  = document.getElementById('raw-input');
  if (!bar || document.activeElement !== ta) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    esNav(e.shiftKey ? -1 : 1);
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    esClear();
    return;
  }
  // Laisser les raccourcis navigateur (Ctrl/Cmd+…) passer normalement
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Rediriger la frappe : mettre le focus sur la barre, laisser l'event se propager
  bar.focus();
  // Le focus est maintenant sur bar, l'event keydown va y atterrir normalement
}, true); // capture phase pour intercepter avant le textarea

function esSearch() {
  clearTimeout(_esSearchTimer);
  _esSearchTimer = setTimeout(_esSearchNow, 300);
}

function _esSearchNow() {
  const query = document.getElementById('es-input').value;
  const ta    = document.getElementById('raw-input');
  const count = document.getElementById('es-count');
  const btnP  = document.getElementById('es-prev');
  const btnN  = document.getElementById('es-next');
  const bar   = document.getElementById('es-input');

  _esMatches   = [];
  _esCurrent   = -1;
  _esLastQuery = query;
  bar.style.background = '';

  if (!query) {
    count.textContent = '';
    btnP.disabled = btnN.disabled = true;
    ta.classList.remove('es-searching');
    return;
  }

  const text  = ta.value;
  const lower = text.toLowerCase();
  const q     = query.toLowerCase();
  let pos = 0;
  while (true) {
    const idx = lower.indexOf(q, pos);
    if (idx < 0) break;
    _esMatches.push({ start: idx, end: idx + q.length });
    pos = idx + 1;
  }

  count.style.color = _esMatches.length ? '' : '#dc2626';
  btnP.disabled = btnN.disabled = _esMatches.length === 0;

  if (!_esMatches.length) {
    count.textContent = '0/0';
    bar.style.background = '#fee2e2';
    setTimeout(() => { bar.style.background = ''; }, 1000);
    ta.classList.remove('es-searching');
    return;
  }

  _esCurrent = 0;
  count.textContent = `${_esMatches.length} résultat${_esMatches.length > 1 ? 's' : ''}`;
  // Pas de navigation automatique — attendre Entrée
}

function esGoTo(i) {
  if (i < 0 || i >= _esMatches.length) return;
  const ta  = document.getElementById('raw-input');
  const bar = document.getElementById('es-input');
  const m   = _esMatches[i];

  // Activer la couleur de sélection bleue
  ta.classList.add('es-searching');

  // Donner le focus au textarea pour que ::selection soit visible,
  // sélectionner le mot en bleu, scroller vers lui.
  ta.focus();
  ta.setSelectionRange(m.start, m.end);
  scrollTextareaToIndex(ta, m.start);

  // Flash confirmation sur la barre
  bar.style.background = '#dbeafe';
  setTimeout(() => { bar.style.background = ''; }, 400);
}

function esNav(dir) {
  if (!_esMatches.length) return;
  _esCurrent = (_esCurrent + dir + _esMatches.length) % _esMatches.length;
  document.getElementById('es-count').textContent = `${_esCurrent + 1}/${_esMatches.length}`;
  document.getElementById('es-prev').disabled = _esMatches.length <= 1;
  document.getElementById('es-next').disabled = _esMatches.length <= 1;
  esGoTo(_esCurrent);
}

function esKeyNav(e) {
  // Cet handler s'active quand le focus est sur la barre es-input
  if (e.key === 'Enter')  { e.preventDefault(); esNav(e.shiftKey ? -1 : 1); }
  if (e.key === 'Escape') esClear();
}

function esClear() {
  clearTimeout(_esSearchTimer);
  const ta  = document.getElementById('raw-input');
  const bar = document.getElementById('es-input');
  bar.value = '';
  bar.style.background = '';
  _esMatches = []; _esCurrent = -1; _esLastQuery = '';
  _esActive  = false;
  ta.classList.remove('es-searching');
  document.getElementById('es-count').textContent = '';
  document.getElementById('es-prev').disabled = true;
  document.getElementById('es-next').disabled = true;
  bar.blur();
}

// Raccourci Ctrl+F / Cmd+F
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    const esInput = document.getElementById('es-input');
    if (esInput) { e.preventDefault(); esInput.focus(); esInput.select(); }
  }
  // Ctrl+Shift+G → Recherche globale
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
    e.preventDefault();
    if (typeof openGlobalSearch === 'function') openGlobalSearch();
  }
});

function wtApplySuggestion(raw, suggestion, e) {
  e.stopPropagation();
  if (!raw || !suggestion) return;
  const ta = getTA();
  // Utilise SE.fuzzyFind pour une localisation robuste (insensible aux espaces/newlines)
  const h = SE.fuzzyFind(raw) || SE.findOne(raw);
  if (h) {
    taReplace(ta, h.start, h.end, suggestion);
    markUnsaved(); onRawInput();
    showToast(_t('toast_correction_ok'), 2000, 'ok');
  }
}

// ══════════════════════════════════════════════════════════
// ONGLET 2 — ANALYSEUR DE STYLE (100% local, offline)
// ══════════════════════════════════════════════════════════

const MOTS_FAIBLES = ['très','vraiment','bien','beaucoup','assez','plutôt','trop','chose','gens','façon','manière','espèce','genre','truc','sorte'];
const VERBES_CREUX = ['faire','mettre','avoir','être','dire','voir','donner','prendre','aller','venir','passer','rendre'];
// BUG 7 FIX : exclure les adverbes déjà couverts par MOTS_FAIBLES (vraiment, fortement…)
// et les adverbes non-littéraires très courants qui ne sont pas de vraies lourdeurs
const ADVERBES_MENT_EXCLUS = new Set([
  // Adverbes modaux / épistémiques — pas de lourdeur stylistique réelle
  'vraiment','seulement','maintenant','comment','autrement','notamment','également',
  'absolument','tellement','franchement','carrément','simplement','gentiment',
  'poliment','correctement',
  // v42 AJOUTS — adverbes courants non-révélateurs d'un tic stylistique
  'exactement','précisément','naturellement','évidemment','visiblement',
  'apparemment','certainement','probablement','effectivement','particulièrement',
  'entièrement','totalement','uniquement','principalement','généralement',
  'normalement','habituellement','finalement','rapidement','facilement',
  'clairement','directement','personnellement','réellement','sincèrement',
  // NE PAS exclure : lentement, légèrement, doucement, brièvement, profondément
  // — ce sont des adverbes de manière concrets, signaux de tics réels
]);
const ADVERBES_MENT = /\b\w+ment\b/gi;
// BUG 8 FIX : STOP_STYLE étendu avec conjugaisons manquantes
const STOP_STYLE = new Set([
  'dans','avec','pour','mais','donc','comme','aussi','plus','bien','très',
  'cette','leur','leurs','tout','tous','toute','toutes','être','avoir','faire',
  'même','entre','après','avant','sans','sous','vers','chez','lors','dont',
  'lequel','laquelle','lesquels','lesquelles','celui','celle','ceux','celles',
  'quand','alors','ainsi','encore','déjà','jamais','toujours','souvent','parfois',
  // conjugaisons fréquentes (BUG 8)
  'était','avait','allait','venait','faisait','disait','prenait','tenait',
  'voyait','savait','pouvait','voulait','fallait','devait','semblait',
  'furent','étaient','avaient','allaient','venaient','faisaient','disaient',
  'seraient','auraient','feraient','diraient','verraient','viendraient',
  'pouvaient','voulaient','savaient',
  // adverbes/conjonctions courants
  'vraiment','seulement','maintenant','autrement','notamment','également',
  'absolument','tellement','franchement','simplement','cependant','pourtant',
  'néanmoins','toutefois','néanmoins','quelque','quelques','certain','certaine',
  'certains','aucune','aucun','plusieurs','beaucoup','assez','plutôt',
]);

// Suggestions concrètes pour les mots faibles
const SUGGESTIONS_MOTS_FAIBLES = {
  'très': ['extrêmement','particulièrement','remarquablement','intensément','profondément'],
  'vraiment': ['véritablement','assurément','indéniablement','réellement'],
  'bien': ['correctement','parfaitement','admirablement','habilement'],
  'beaucoup': ['abondamment','considérablement','largement','amplement','énormément'],
  'assez': ['suffisamment','raisonnablement','relativement','passablement'],
  'trop': ['excessivement','démesurément','outrageusement'],
  'bon': ['excellent','admirable','remarquable','savoureux','judicieux'],
  'mauvais': ['médiocre','déplorable','exécrable','funeste','néfaste'],
  'chose': ['élément','aspect','détail','point','fait','réalité','matière'],
  'gens': ['personnes','individus','hommes','âmes','figures','silhouettes'],
  'façon': ['manière','style','approche','méthode','procédé','art'],
  'manière': ['façon','style','approche','méthode','procédé','art'],
  'faire': ['accomplir','réaliser','effectuer','exécuter','produire','créer'],
  'mettre': ['placer','poser','disposer','installer','glisser','loger'],
  'dire': ['murmurer','souffler','annoncer','déclarer','confier','lancer'],
  'voir': ['apercevoir','distinguer','observer','contempler','percevoir'],
};

// Débuts de phrases trop répétitifs
// Ne conserve que les tournures vraiment révélatrices d'un tic stylistique
// (il/elle/ils/les/un/une/des/je sont trop universels pour être diagnostiques)
const DEBUT_PHRASES_BANALS = [
  // Tournures impersonnelles répétées = tic stylistique réel
  'il y a','il était','elle était','c\'était','c\'est',
  // Pronoms de groupe — répétition sur 5+ phrases = sur-présence notable
  'nous ','vous ','on ',
  // Constructions détachées — répétition = manque de variété structurelle
  'tout ','toute ','tous ','mais ','donc ','car ','alors ',
  // Introducteurs de temps/lieu répétés
  'soudain ','puis ','ensuite ','enfin ','maintenant ','déjà ',
];

function styleScoreColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function styleScoreLabel(score) {
  if (score >= 90) return 'Style très propre';
  if (score >= 80) return 'Écriture fluide — quelques tics mineurs';
  if (score >= 68) return 'Style solide — adverbes ou rythme à lisser';
  if (score >= 55) return 'Plusieurs points à retravailler';
  return 'Révision stylistique recommandée';
}

// ── Contexte de l'œuvre pour calibrer le score ───────────
function getStyleContext() {
  const registre = getDomVal('oeuvre-registre');
  const genre    = getDomVal('oeuvre-genre');
  const type     = getDomVal('oeuvre-type');
  const temps    = getDomVal('oeuvre-temps');

  const isLitteraire  = registre.includes('Soutenu') || registre.includes('littéraire');
  const isArgotique   = registre.includes('Familier') || registre.includes('Argotique');
  const isSpeculatif  = ['Fantasy','Science-Fiction','Space Opera','Cyberpunk','Steampunk',
    'Post-apocalyptique','Dystopie','Uchronie','Fantastique','Gothique','Horreur'].some(g => genre.includes(g));
  const isClassique   = ['Roman classique','Historique','Épique'].some(g => genre.includes(g));
  const isEpique      = ['Fantasy épique','Héroïc Fantasy','Dark Fantasy','Space Opera','Fantasy classique'].some(g => genre.includes(g));
  const isPresentNarr = temps.includes('Présent');
  const isScenario    = type.includes('Scénario') || type.includes('Théâtre');

  return { isLitteraire, isArgotique, isSpeculatif, isClassique, isEpique, isPresentNarr, isScenario, registre, genre };
}

// ── Suggestion IA pour l'outil Style ─────────────────────
// Appelée en lazy (au clic sur le bouton) pour ne pas bloquer l'analyse initiale.
// wtStyleSuggest et _aiSugBtn → remplacés par iaPropOpen / _aiSugBtn (modale propositions IA)
// Conservé comme alias de compatibilité au cas où
function wtStyleSuggest(btnEl, type, payload) { iaPropOpen(btnEl, type, payload); }

// ══════════════════════════════════════════════════════════════════════════════
// ── LOCALISATION ROBUSTE — utilitaires partagés ───────────────────────────────
// Utilisés par runStyleAnalysis ET runStatsAnalysis pour cibler une phrase ou
// un segment dans le textarea via une ancre alphanumérique pure, immunisée contre
// les tirets cadratins, guillemets, astérisques et autres chars spéciaux.
//
//   buildLocator(phrase)  → {anchor, before, after, len}
//     Extrait la plus longue sous-chaîne de lettres+espaces de la phrase,
//     mémorise les offsets avant/après pour reconstituer la plage réelle.
//
//   locateAndGoTo(loc)    → void
//     Recherche l'ancre dans ta.value, déduit start/end de la phrase entière,
//     et délègue à SE.goTo. Fallback sur SE.highlightAll si l'ancre est absente.
// ══════════════════════════════════════════════════════════════════════════════
function buildLocator(phrase) {
  const tokens = phrase.match(
    /[a-zA-ZàâäéèêëîïôùûüœçÀÂÄÉÈÊËÎÏÔÙÛÜŒÇ][a-zA-ZàâäéèêëîïôùûüœçÀÂÄÉÈÊËÎÏÔÙÛÜŒÇ\s]{6,}/g
  ) || [];
  const anchor = tokens.reduce((best, t) => t.length > best.length ? t : best, '');
  const before = anchor ? phrase.indexOf(anchor) : 0;
  const after  = anchor ? phrase.length - before - anchor.length : 0;
  return { anchor, before, after, len: phrase.length };
}

function locateAndGoTo(loc) {
  if (!loc || !loc.anchor) return;
  const ta    = getTA();
  const txt   = ta.value;
  const aIdx  = txt.toLowerCase().indexOf(loc.anchor.toLowerCase());
  if (aIdx < 0) { SE.highlightAll(loc.anchor, 0, false); return; }
  const start = Math.max(0, aIdx - loc.before);
  const end   = Math.min(txt.length, aIdx + loc.anchor.length + loc.after);
  SE.goTo(start, end, 'yellow');
}

function runStyleAnalysis() {
  const text = getDomVal('raw-input').trim();
  if (!text) { showToast(_t('toast_no_text')); return; }

  const btn = document.getElementById('wt-btn-style');
  btn.disabled = true;
  // Réinitialiser le tableau des offsets de phrases (utilisé par les vignettes "phrase longue")
  window._sePhrasesOffsets = [];

  try {
    const cleanText = text.replace(/\[IMAGE:[^\]]*\]/gi,'').replace(/\[NOTE:[^\]]*\]/gi,'').replace(/\[HL:\w+\s([^\|]*?)(?:\|[^\]]*)?\]/gi,'$1').replace(/\[TAG:\w+\s([^\]]*)\]/gi,'$1');

    // Découpe en phrases avec capture des offsets réels dans cleanText
    // → permet de localiser précisément chaque phrase dans ta.value
    // v50 FIX : normaliser les séparateurs de scène (* * *, lignes vides) en points
    // pour éviter la fusion de phrases distinctes séparées sans ponctuation finale.
    const _cleanForSplit = cleanText
      .replace(/^\s*[\*\·\-]{1,}\s*([\*\·\-]\s*){1,}$/mg, '.')
      .replace(/\n{2,}/g, '.\n');
    const _sentSplitRe = /(?<=[.!?])\s+(?=[A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ—«])|(?<=[.!?])\s*\n+\s*(?=[A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ—«"\-])/g;
    const sentencesWithOffsets = (function() {
      const result = [];
      let lastIdx = 0;
      let m;
      const re = new RegExp(_sentSplitRe.source, 'g');
      while ((m = re.exec(_cleanForSplit)) !== null) {
        const chunk = _cleanForSplit.slice(lastIdx, m.index).trim();
        if (chunk.length > 8) result.push({ text: chunk, start: lastIdx, end: m.index });
        lastIdx = m.index + m[0].length;
      }
      const last = _cleanForSplit.slice(lastIdx).trim();
      if (last.length > 8) result.push({ text: last, start: lastIdx, end: cleanText.length });
      return result;
    })();
    const sentencesRaw = sentencesWithOffsets.map(s => s.text);
    const sentences = sentencesRaw;
    const sentencesForAvg = sentencesRaw.filter(s => s.split(/\s+/).length >= 5);
    const words = cleanText.match(/\b[a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ]{2,}\b/g) || [];

    // ── 1. Statistiques de base ──────────────────────────
    const totalWords    = words.length;
    const totalSentences = sentences.length;
    const totalSentencesForAvg = sentencesForAvg.length;
    const avgWPS        = totalSentencesForAvg ? Math.round(totalWords / totalSentencesForAvg) : 0;
    const dialogLines   = cleanText.split('\n').filter(l => /^[—«""\u201c\u201d]/.test(l.trim()));
    const dialogPct     = totalSentences ? Math.round(dialogLines.length / totalSentences * 100) : 0;

    // ── 2. Phrases longues — seuil contextuel calculé après getStyleContext() ──
    // longSents (seuil fixe 35) conservé pour les suggestions de découpage
    // longSentsCtx (seuil contextuel) utilisé pour le score et les couleurs
    const longSents = sentences.filter(s => s.split(/\s+/).length > 35);

    // ── 3. Phrases trop courtes (< 5 mots, hors dialogues) ──
    const shortSents = sentences.filter(s => {
      const wc = s.split(/\s+/).length;
      return wc < 5 && wc > 1 && !/^[—«]/.test(s);
    });

    // ── 4. Rythme monotone (5 phrases consécutives de longueur similaire) ──
    // v42 FIX : on exclut les fragments stylistiques courts (< 6 mots) —
    // ils sont intentionnels en fiction et ne doivent pas déclencher la pénalité.
    // AUDIT FIX : seuil RELATIF (25% de variation) au lieu d'absolu (±4 mots)
    // Deux phrases de 8 et 12 mots semblent différentes ; de 28 et 32 non.
    // Détection multi-runs : on accumule tous les runs ≥ 5, pas seulement le dernier.
    const sentencesForRhythm = sentences.filter(s => s.split(/\s+/).length >= 6);
    let monotoneCount = 0;
    let monotoneRunFound = false;
    for (let i = 1; i < sentencesForRhythm.length; i++) {
      const prev = sentencesForRhythm[i-1].split(/\s+/).length;
      const curr = sentencesForRhythm[i].split(/\s+/).length;
      const maxLen = Math.max(prev, curr);
      // Variation relative < 25 % → phrases perçues comme similaires
      if (maxLen > 0 && Math.abs(curr - prev) / maxLen < 0.25) {
        if (monotoneCount === 0) monotoneCount = 2;
        else monotoneCount++;
        if (monotoneCount >= 5) monotoneRunFound = true;
      } else {
        monotoneCount = 0;
      }
    }
    const hasMonotoneRhythm = monotoneRunFound;

    // ── 5. Adverbes en -ment ────────────────────────────
    // BUG 7 FIX : filtrer les adverbes déjà couverts par MOTS_FAIBLES ou trop courants
    const allAdverbs = (cleanText.match(ADVERBES_MENT) || [])
      .filter(a => !ADVERBES_MENT_EXCLUS.has(a.toLowerCase()));
    const uniqAdverbs = [...new Set(allAdverbs.map(a => a.toLowerCase()))];
    // Adverbes les plus fréquents avec position
    const adverbFreq = {};
    allAdverbs.forEach(a => { const l = a.toLowerCase(); adverbFreq[l] = (adverbFreq[l]||0)+1; });
    const topAdverbs = Object.entries(adverbFreq).sort((a,b)=>b[1]-a[1]).slice(0,8);

    // ── 6. Mots faibles avec position dans le texte ─────
    const weakFound = {};
    MOTS_FAIBLES.forEach(mot => {
      const rx = new RegExp('\\b' + mot + '\\b', 'gi');
      let m; const positions = [];
      while ((m = rx.exec(cleanText)) !== null) positions.push(m.index);
      if (positions.length >= 3) weakFound[mot] = positions;
    });

    // ── 7. Verbes creux fréquents ───────────────────────
    // Seuil dynamique en ‰ : 3‰ de totalWords (évite les FP sur romans longs)
    const _seuilVerbeCreux = Math.max(4, Math.round(totalWords * 0.003));
    const verbeCreuxFound = {};
    VERBES_CREUX.forEach(v => {
      // Ancres strictes : ne pas capturer les dérivés préfixés (contredire, prédire…)
      // On exige que le verbe soit précédé d'un espace/début ou d'un pronom
      const rx = new RegExp('(?:^|\\s)' + v + '(?:s|nt|ez|ons|ait|aient|é|er|is|it)?(?=\\s|$|[,;:.!?])', 'gi');
      const matches = cleanText.match(rx) || [];
      if (matches.length >= _seuilVerbeCreux) verbeCreuxFound[v] = matches.length;
    });

    // ── 8. Répétitions lexicales proches (fenêtre 80 mots) ──
    // v42 FIX : construire un set de noms propres à exclure
    // 1. Noms issus des Fiches Personnages et Fiches Lieux
    const _styleKnownNames = new Set();
    getPersos().forEach(p => {
      if (p.nom) p.nom.split(/[\s\-]+/).forEach(w => _styleKnownNames.add(w.toLowerCase()));
      if (p.variantes) p.variantes.split(/[,;]+/).map(v => v.trim()).forEach(v =>
        v.split(/[\s\-]+/).forEach(w => _styleKnownNames.add(w.toLowerCase()))
      );
    });
    getLieux().forEach(l => {
      if (l.nom) l.nom.split(/[\s\-]+/).forEach(w => _styleKnownNames.add(w.toLowerCase()));
      if (l.variantes) l.variantes.split(/[,;]+/).map(v => v.trim()).forEach(v =>
        v.split(/[\s\-]+/).forEach(w => _styleKnownNames.add(w.toLowerCase()))
      );
      if (l.peuples) l.peuples.split(/[,;]+/).map(v => v.trim()).forEach(v =>
        v.split(/[\s\-]+/).forEach(w => _styleKnownNames.add(w.toLowerCase()))
      );
    });
    // 2. Détection automatique : tout mot qui apparaît ≥3× avec une majuscule
    //    initiale dans le texte (hors début de phrase) est probablement un nom propre
    const _midWordCaps = {};
    const _lines = cleanText.split('\n');
    _lines.forEach(line => {
      const _wds = line.match(/\b[A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ][a-záàâéèêëîïôùûüœç]{3,}\b/g) || [];
      _wds.forEach(w => { _midWordCaps[w.toLowerCase()] = (_midWordCaps[w.toLowerCase()]||0)+1; });
    });
    Object.entries(_midWordCaps).forEach(([w, c]) => { if (c >= 3) _styleKnownNames.add(w); });

    const closeRepetitions = [];
    const seenAt = {};
    // AUDIT FIX : fenêtre 80→120 mots + seenAt ne glisse que hors-fenêtre
    // Avant : A(10) B(95) C(160) → B-C=65 mots alertait ; maintenant seul A-C=150 compte
    const REPET_WINDOW = 120;
    words.forEach((w, i) => {
      const lw = w.toLowerCase();
      if (lw.length < 5 || STOP_STYLE.has(lw)) return;
      // v42 FIX : exclure les noms propres connus (fiches + détection auto)
      if (_styleKnownNames.has(lw)) return;
      if (seenAt[lw] !== undefined) {
        const gap = i - seenAt[lw];
        if (gap < REPET_WINDOW) {
          if (!closeRepetitions.find(r => r.word === lw))
            closeRepetitions.push({ word: lw, gap });
          // Ne pas faire glisser la référence — on garde la première occurrence
        } else {
          // Hors fenêtre : réinitialiser la référence
          seenAt[lw] = i;
        }
      } else {
        seenAt[lw] = i;
      }
    });

    // ── 9. Débuts de phrases répétitifs ─────────────────
    const debutCount = {};
    sentences.forEach(s => {
      const sl = s.toLowerCase();
      const debut = DEBUT_PHRASES_BANALS.find(d => sl.startsWith(d));
      if (debut) debutCount[debut] = (debutCount[debut]||0)+1;
    });
    const debutsRepetitifs = Object.entries(debutCount).filter(([,c]) => c >= 5).sort((a,b)=>b[1]-a[1]);

    // ── 10. Voix passive simple ─────────────────────────
    const passiveMatches = [...cleanText.matchAll(/\b(?:est|sont|était|étaient|fut|furent|sera|seront)\s+\w+é[es]?\b/gi)];

    // ── 11. Top mots répétés (hors stop) ────────────────
    const freq = {};
    words.forEach(w => {
      const lw = w.toLowerCase();
      if (lw.length > 4 && !STOP_STYLE.has(lw)) freq[lw] = (freq[lw]||0)+1;
    });
    const topWords = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,12);

    // ── Score global contextuel (0-100) ──────────────────
    // Chaque pénalité est calibrée selon le genre/registre déclaré dans la Fiche Œuvre.
    // Un roman littéraire n'est pas jugé comme un article de presse.
    const ctx = getStyleContext();

    // Seuils adaptés au contexte
    const seuilPhraseLongue = ctx.isLitteraire || ctx.isClassique ? 50 : ctx.isEpique ? 45 : ctx.isSpeculatif ? 42 : 35;

    // v42 FIX — seuils adverbes en ‰ (pour 1000 mots) au lieu de valeurs absolues.
    // Un roman de 87k mots ne doit pas être pénalisé comme une nouvelle de 5k mots.
    const ratioAdverbes     = totalWords > 0 ? (allAdverbs.length / totalWords * 1000) : 0;
    const seuilAdverbesWarn = ctx.isLitteraire ? 12 : ctx.isEpique ? 10 : ctx.isSpeculatif ? 9 : 7;   // ‰
    const seuilAdverbesBad  = ctx.isLitteraire ? 20 : ctx.isEpique ? 16 : ctx.isSpeculatif ? 14 : 11;  // ‰

    // Seuils moy. phrase et passif — épique toléré
    const seuilMoyPhrase    = ctx.isLitteraire || ctx.isClassique ? 35 : ctx.isEpique ? 38 : 28;
    const seuilPassive      = ctx.isLitteraire || ctx.isClassique ? 10 : ctx.isEpique ? 12 : 6;

    // v42 FIX — répétitions et mots faibles également normalisés par densité (‰)
    const ratioRepetitions  = totalWords > 0 ? (closeRepetitions.length / totalWords * 1000) : 0;
    const ratioWeakHeavy    = totalWords > 0 ? (Object.entries(weakFound).filter(([, p]) => p.length >= 3).length / totalWords * 1000) : 0;

    let penalty = 0;
    const penaltyLog = []; // pour débogage / transparence future

    // Phrases trop longues — pondération douce : plafond à 20 pts
    // On ne punit que les phrases *vraiment* longues (selon seuil contextuel)
    const longSentsCtx = sentencesWithOffsets.filter(s => s.text.split(/\s+/).length > seuilPhraseLongue);
    if (longSentsCtx.length > 0) {
      const p = Math.min(20, longSentsCtx.length * 4);
      penalty += p;
      penaltyLog.push(`Phrases longues (>${seuilPhraseLongue} mots) : -${p}`);
    }

    // Adverbes en -ment — v42 : seuil en ‰ (ratio sur totalWords), plafond à 15 pts
    if (ratioAdverbes > seuilAdverbesBad) {
      const excess = ratioAdverbes - seuilAdverbesBad;
      const p = Math.min(15, Math.round(excess * 1.2) + 8);
      penalty += p;
      penaltyLog.push(`Adverbes excessifs (${ratioAdverbes.toFixed(1)}‰ > seuil ${seuilAdverbesBad}‰) : -${p}`);
    } else if (ratioAdverbes > seuilAdverbesWarn) {
      const excess = ratioAdverbes - seuilAdverbesWarn;
      const p = Math.min(7, Math.round(excess * 0.8));
      penalty += p;
      penaltyLog.push(`Adverbes nombreux (${ratioAdverbes.toFixed(1)}‰) : -${p}`);
    }

    // Mots faibles — v42 : normalisé en ‰ pour ne pas pénaliser les textes longs
    // Seuil : >1.5‰ de mots faibles fréquents = signal réel
    const weakHeavy = Object.entries(weakFound).filter(([, positions]) => positions.length >= 3);
    if (ratioWeakHeavy > 1.5) {
      const p = Math.min(12, Math.round(ratioWeakHeavy * 3));
      penalty += p;
      penaltyLog.push(`Mots faibles fréquents (${ratioWeakHeavy.toFixed(2)}‰) : -${p}`);
    } else if (weakHeavy.length >= 2) {
      const p = Math.min(6, weakHeavy.length);
      penalty += p;
      penaltyLog.push(`Mots faibles présents : -${p}`);
    }

    // Répétitions proches — v42 : normalisé en ‰, plafond 8 pts
    // Seuil >2‰ = réel problème de répétition
    if (ratioRepetitions > 2) {
      const p = Math.min(8, Math.round(ratioRepetitions * 1.5));
      penalty += p;
      penaltyLog.push(`Répétitions proches (${ratioRepetitions.toFixed(2)}‰) : -${p}`);
    } else if (closeRepetitions.length > 0) {
      const p = Math.min(4, closeRepetitions.length);
      penalty += p;
      penaltyLog.push(`Répétitions proches (faibles) : -${p}`);
    }

    // Rythme monotone — pénalité fixe, mais ignorée si texte court (<30 phrases)
    if (hasMonotoneRhythm && sentences.length >= 30) {
      penalty += 6;
      penaltyLog.push('Rythme monotone : -6');
    }

    // Débuts de phrases répétitifs — plafond 8 pts
    if (debutsRepetitifs.length > 0) {
      const p = Math.min(8, debutsRepetitifs.length * 3);
      penalty += p;
      penaltyLog.push(`Débuts répétitifs : -${p}`);
    }

    // Voix passive — tolérée en littéraire/classique, seuil élevé
    if (passiveMatches.length > seuilPassive) {
      const p = Math.min(5, Math.round((passiveMatches.length - seuilPassive) * 0.5));
      penalty += p;
      penaltyLog.push(`Voix passive : -${p}`);
    }

    // Longueur moyenne des phrases — avertissement doux seulement
    if (avgWPS > seuilMoyPhrase) {
      const p = Math.min(8, Math.round((avgWPS - seuilMoyPhrase) * 0.8));
      penalty += p;
      penaltyLog.push(`Phrases trop longues en moyenne : -${p}`);
    }

    const score = Math.max(0, 100 - penalty);

    // ── Rendu ────────────────────────────────────────────
    const awpsColor = avgWPS > seuilMoyPhrase ? 'bad' : avgWPS > seuilMoyPhrase * 0.8 ? 'warn' : '';
    const adverbColor = ratioAdverbes > seuilAdverbesBad ? 'bad' : ratioAdverbes > seuilAdverbesWarn ? 'warn' : '';
    const longColor = longSentsCtx.length > 5 ? 'bad' : longSentsCtx.length > 2 ? 'warn' : '';
    const scoreColor = styleScoreColor(score);

    // Étiquette de contexte appliqué
    const ctxLabel = ctx.isLitteraire ? 'littéraire' : ctx.isClassique ? 'classique' : ctx.isSpeculatif ? 'spéculatif' : ctx.isArgotique ? 'familier' : 'standard';
    const ctxNote = (ctx.registre || ctx.genre)
      ? `<div style="font-size:9.5px;color:var(--ink-muted);margin-top:2px;font-style:italic;">Calibré pour registre ${ctxLabel}${ctx.genre ? ' · ' + ctx.genre.split(',')[0] : ''}</div>`
      : `<div style="font-size:9.5px;color:var(--ink-muted);margin-top:2px;font-style:italic;">Renseignez la Fiche Œuvre pour calibrer l'analyse à votre genre.</div>`;

    let html = `
      <!-- Score global -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:10px 12px;background:var(--paper);border-radius:8px;border:1px solid var(--cream);">
        <div style="width:44px;height:44px;border-radius:50%;border:3px solid ${scoreColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span class="wt-score-circle" style="font-size:13px;font-weight:600;color:${scoreColor};">${score}</span>
        </div>
        <div>
          <div class="wt-score-label" style="font-size:12px;font-weight:600;color:${scoreColor};">${styleScoreLabel(score)}</div>
          <div style="font-size:10.5px;color:var(--ink-muted);margin-top:1px;">${totalWords} mots · ${totalSentences} phrases · ${dialogPct}% dialogue</div>
          ${ctxNote}
        </div>
      </div>

      <!-- Stats -->
      <div class="wt-stat-grid">
        <div class="wt-stat">
          <span class="wt-stat-val ${awpsColor}">${avgWPS}</span>
          <span class="wt-stat-lbl">mots/phrase</span>
        </div>
        <div class="wt-stat">
          <span class="wt-stat-val ${longColor}" data-stat="long">${longSentsCtx.length}</span>
          <span class="wt-stat-lbl">phrases longues</span>
        </div>
        <div class="wt-stat">
          <span class="wt-stat-val ${adverbColor}">${allAdverbs.length}</span>
          <span class="wt-stat-lbl">adverbes -ment</span>
        </div>
        <div class="wt-stat">
          <span class="wt-stat-val ${passiveMatches.length > seuilPassive ? 'warn' : ''}">${passiveMatches.length}</span>
          <span class="wt-stat-lbl">voix passive</span>
        </div>
      </div>`;

    // ── PROBLÈMES DÉTECTÉS ───────────────────────────────

    // Phrases longues → suggestion de découpage (seuil contextuel)
    if (longSentsCtx.length) {
      html += `<div class="wt-section-title">✂ Phrases à découper (${longSentsCtx.length} · seuil ${seuilPhraseLongue} mots)</div>`;
      longSentsCtx.slice(0, 3).forEach(sObj => {
        const s       = sObj.text;
        const preview = s.trim().slice(0, 110);
        const cutMatch = s.match(/,\s+(?:et|mais|car|donc|or|or|puis|alors|qui|que)\s+/i);
        const cutSuggestion = cutMatch
          ? `Couper après « …${s.slice(Math.max(0, s.indexOf(cutMatch[0])-10), s.indexOf(cutMatch[0])+5).trim()}… »`
          : 'Chercher une virgule ou conjonction pour couper';
        const payloadJson = JSON.stringify(s.trim().slice(0, 400));

        // ── Localisation robuste — délègue à buildLocator (utilitaire centralisé) ──
        const _loc = buildLocator(s);
        const _idx = (window._sePhrasesOffsets = window._sePhrasesOffsets || []).length;
        window._sePhrasesOffsets.push(_loc);

        html += `<div class="wt-issue style" data-style-card="1" data-type="long"
          data-raw-text="${escHtml(s.slice(0, 120))}"
          style="cursor:pointer;position:relative;"
          onclick="locateAndGoTo(window._sePhrasesOffsets && window._sePhrasesOffsets[${_idx}])">
          <div class="wt-issue-text">Phrase de ${s.split(/\s+/).length} mots</div>
          <button class="wt-dismiss-btn" onclick="(function(e){e.stopPropagation();var el=this.closest('.wt-issue');if(!el)return;var t=el.dataset.type||'long';var r=el.dataset.rawText||'';if(r)window._addIgnored(window._alertId(t,r));el.classList.add('dismissed');var res=document.getElementById('wt-correct-results');if(res){res._dismissedCount=(res._dismissedCount||0)+1;}window._wtRecalcStyleScoreAfterDismiss();}.bind(this))(event)" title="${_t('wt_dismiss')}">✕</button>
          <div class="wt-issue-msg" style="font-style:italic;color:var(--ink-muted);">"${escHtml(preview)}…"</div>
          <div style="font-size:10.5px;margin-top:4px;color:var(--accent);">💡 ${escHtml(cutSuggestion)}</div>
          ${_aiSugBtn('long_sentence', payloadJson)}
        </div>`;
      });
    }

    // Rythme monotone
    if (hasMonotoneRhythm) {
      html += `<div class="wt-section-title">〜 Rythme monotone</div>
        <div class="wt-issue warning">
          <div class="wt-issue-text">Phrases de longueur trop similaire</div>
          <div class="wt-issue-msg">Plusieurs phrases consécutives ont la même longueur. Variez : alternez courte / longue, affirmative / interrogative, simple / complexe.</div>
          <div style="font-size:10.5px;margin-top:4px;color:var(--accent);">💡 Insérez une phrase très courte (3-6 mots) ou une exclamative.</div>
        </div>`;
    }

    // Adverbes en -ment
    if (topAdverbs.length > 3) {
      html += `<div class="wt-section-title">🔤 Adverbes à alléger (${allAdverbs.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
          ${topAdverbs.map(([a,c])=>`<span class="wt-syn-chip" style="cursor:pointer;" onclick="wtHighlightAll('${escHtml(a)}')">${escHtml(a)} <span style="opacity:.6;font-size:9px;">${c}×</span></span>`).join('')}
        </div>
        <div style="font-size:10.5px;color:var(--ink-muted);margin-bottom:10px;">💡 Remplacez l'adverbe par un verbe fort : <em>« il courut rapidement »</em> → <em>« il fila »</em></div>`;
    }

    // Mots faibles avec suggestions
    if (Object.keys(weakFound).length) {
      html += `<div class="wt-section-title">💪 Mots à renforcer</div>`;
      Object.entries(weakFound).slice(0, 8).forEach(([mot, positions]) => {
        const suggestions = SUGGESTIONS_MOTS_FAIBLES[mot] || [];
        html += `<div class="wt-issue style" data-type="weak" data-raw-text="${escHtml(mot)}" style="cursor:pointer;position:relative;" onclick="wtHighlightAll('${escHtml(mot)}')">
          <button class="wt-dismiss-btn" onclick="(function(e){e.stopPropagation();var el=this.closest('.wt-issue');if(!el)return;var t=el.dataset.type||'weak';var r=el.dataset.rawText||'';if(r)window._addIgnored(window._alertId(t,r));el.classList.add('dismissed');window._wtRecalcStyleScoreAfterDismiss();}.bind(this))(event)" title="${_t('wt_dismiss')}">✕</button>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span class="wt-issue-text">"${escHtml(mot)}" — ${positions.length}× dans le texte</span>
          </div>
          ${suggestions.length ? `<div class="wt-issue-suggest" style="margin-top:5px;">
            ${suggestions.slice(0,4).map(s=>`<button class="wt-suggest-chip" onclick="event.stopPropagation();wtReplaceNextOccurrence('${escHtml(mot)}','${escHtml(s)}')">${escHtml(s)}</button>`).join('')}
          </div>` : ''}
        </div>`;
      });
    }

    // Verbes creux
    if (Object.keys(verbeCreuxFound).length) {
      html += `<div class="wt-section-title">⚡ Verbes à préciser</div>`;
      Object.entries(verbeCreuxFound).forEach(([v, cnt]) => {
        const sug = SUGGESTIONS_MOTS_FAIBLES[v] || [];
        html += `<div class="wt-issue style" style="cursor:pointer;" onclick="wtHighlightAll('${escHtml(v)}')">
          <span class="wt-issue-text">"${escHtml(v)}" — ${cnt}× (verbe passe-partout)</span>
          ${sug.length ? `<div class="wt-issue-suggest" style="margin-top:5px;">${sug.slice(0,4).map(s=>`<button class="wt-suggest-chip" onclick="event.stopPropagation();wtReplaceNextOccurrence('${escHtml(v)}','${escHtml(s)}')">${escHtml(s)}</button>`).join('')}</div>` : ''}
        </div>`;
      });
    }

    // Répétitions proches
    if (closeRepetitions.length) {
      html += `<div class="wt-section-title">🔁 Répétitions proches (${closeRepetitions.length})</div>`;
      closeRepetitions.slice(0, 8).forEach(r => {
        const rx = new RegExp('\\b' + r.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b', 'i');
        const mi = cleanText.search(rx);
        const ctx = mi >= 0 ? cleanText.slice(Math.max(0, mi-30), mi + r.word.length + 50).trim() : r.word;
        const payloadJson = JSON.stringify({ word: r.word, ctx: ctx.slice(0, 150) });
        html += `<div class="wt-issue style" data-type="repetition" data-raw-text="${escHtml(r.word)}" data-style-card="1" style="cursor:pointer;position:relative;" onclick="wtHighlightAll('${escHtml(r.word)}')">
          <button class="wt-dismiss-btn" onclick="(function(e){e.stopPropagation();var el=this.closest('.wt-issue');if(!el)return;var t=el.dataset.type||'repetition';var r=el.dataset.rawText||'';if(r)window._addIgnored(window._alertId(t,r));el.classList.add('dismissed');window._wtRecalcStyleScoreAfterDismiss();}.bind(this))(event)" title="${_t('wt_dismiss')}">✕</button>          <div class="wt-issue-text">« ${escHtml(r.word)} » — répété à proximité</div>
          <div style="font-size:10.5px;font-style:italic;color:var(--ink-muted);margin-top:2px;padding:3px 7px;background:var(--paper);border-radius:3px;border-left:2px solid var(--cream);">${escHtml(ctx.slice(0,90))}…</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap;">
            <button class="wt-syn-chip" style="font-size:10px;"
              onclick="event.stopPropagation();switchSidebarToolTab('syn');document.getElementById('wonef-search-input').value='${escHtml(r.word)}';_runSynonymsForWord('${escHtml(r.word)}');">
              📖 Synonymes
            </button>
            ${_aiSugBtn('repetition', payloadJson)}
          </div>
        </div>`;
      });
    }

    // Débuts de phrases
    if (debutsRepetitifs.length) {
      html += `<div class="wt-section-title">📎 Débuts de phrases répétitifs</div>`;
      debutsRepetitifs.slice(0, 4).forEach(([debut, cnt]) => {
        const payloadJson = JSON.stringify(debut.trim());
        html += `<div class="wt-issue warning" data-type="debut" data-raw-text="${escHtml(debut.trim())}" data-style-card="1" style="cursor:pointer;position:relative;" onclick="wtHighlightAll('${escHtml(debut.trim())}')">
          <button class="wt-dismiss-btn" onclick="(function(e){e.stopPropagation();var el=this.closest('.wt-issue');if(!el)return;var t=el.dataset.type||'debut';var r=el.dataset.rawText||'';if(r)window._addIgnored(window._alertId(t,r));el.classList.add('dismissed');window._wtRecalcStyleScoreAfterDismiss();}.bind(this))(event)" title="${_t('wt_dismiss')}">✕</button>
          <span class="wt-issue-text">« ${escHtml(debut.trim())} » commence ${cnt} phrases</span>
          <div style="font-size:10.5px;color:var(--ink-muted);margin-top:3px;">💡 Inversion sujet/verbe, complément en tête, subordonnée…</div>
          ${_aiSugBtn('debut', payloadJson)}
        </div>`;
      });
    }

    // Voix passive
    if (passiveMatches.length > 3) {
      html += `<div class="wt-section-title">🔄 Voix passive (${passiveMatches.length} cas)</div>
        <div class="wt-issue warning">
          <div class="wt-issue-msg">Usage fréquent de la voix passive. La voix active est plus dynamique.</div>
          <div style="font-size:10.5px;margin-top:4px;color:var(--accent);">💡 <em>"La porte fut ouverte par Marc"</em> → <em>"Marc ouvrit la porte"</em></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
          ${passiveMatches.slice(0,5).map(m=>`<span class="wt-syn-chip" style="cursor:pointer;font-size:10px;" onclick="wtHighlightAll('${escHtml(m[0])}')">${escHtml(m[0])}</span>`).join('')}
        </div>`;
    }

    // Top mots répétés (cliquables → surligner + synonymes)
    if (topWords.length) {
      html += `<div class="wt-section-title">📊 Mots les plus utilisés</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;">
          ${topWords.map(([mot, cnt]) => `
            <span style="display:inline-flex;align-items:center;gap:0;background:var(--paper);border:1px solid var(--cream);border-radius:12px;overflow:hidden;font-size:10.5px;">
              <button title="${_t('wt_locate')}" onclick="wtHighlightAll('${escHtml(mot)}')"
                style="font-family:'DM Sans',sans-serif;font-size:10.5px;background:transparent;border:none;padding:3px 8px;cursor:pointer;color:var(--ink-soft);">
                ${escHtml(mot)} <span style="opacity:.55;font-size:9px;">${cnt}×</span>
              </button>
              <button title="${_t('wt_find_synonyms')}" onclick="switchSidebarToolTab('syn');document.getElementById('wonef-search-input').value='${escHtml(mot)}';_runSynonymsForWord('${escHtml(mot)}');"
                style="font-family:'DM Sans',sans-serif;font-size:10px;background:transparent;border:none;border-left:1px solid var(--cream);padding:3px 6px;cursor:pointer;color:var(--ink-muted);">📖</button>
            </span>`).join('')}
        </div>
        <div style="font-size:10px;color:var(--ink-muted);margin-bottom:8px;font-style:italic;">Cliquer → localiser · 📖 → synonymes</div>`;
    }

    if (score >= 80 && longSentsCtx.length === 0 && allAdverbs.length <= seuilAdverbesWarn) {
      html += `<div class="wt-empty" style="color:#10b981;margin-top:8px;">✅ Style fluide et varié — calibré pour registre ${ctxLabel}.</div>`;
    }

    // Sauvegarder les données brutes pour permettre le recalcul après dismiss
    window._wtLastStyleData = {
      longSentsCtx, closeRepetitions, debutsRepetitifs, weakFound, verbeCreuxFound,
      ratioAdverbes, seuilAdverbesWarn, seuilAdverbesBad, seuilMoyPhrase, seuilPassive,
      avgWPS, totalWords, totalSentences, hasMonotoneRhythm: hasMonotoneRhythm,
      passiveCount: passiveMatches.length,
      // Adverbes individuels pour recalcul après filtre
      adverbFreq, totalAdverbCount: allAdverbs.length,
    };

    document.getElementById('wt-style-results').innerHTML = html;
  } finally {
    btn.disabled = false;
  }
}

// Remplacer la prochaine occurrence d'un mot (depuis le curseur ou depuis le début)
function wtReplaceNextOccurrence(original, replacement) {
  const ta = getTA();
  const cursor = ta.selectionStart || 0;
  const text = ta.value;
  const rx = new RegExp('\\b' + original.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b', 'i');

  // Chercher après le curseur, puis depuis le début
  let idx = text.slice(cursor).search(rx);
  if (idx >= 0) idx += cursor;
  else idx = text.search(rx);

  if (idx >= 0) {
    const match = text.slice(idx).match(rx);
    taReplace(ta, idx, idx + match[0].length, replacement);
    ta.focus();
    ta.setSelectionRange(idx, idx + replacement.length);
    markUnsaved(); onRawInput();
    showToast(_t('toast_replaced_one').replace('{a}', original).replace('{b}', replacement), 2000, 'ok');
  } else {
    showToast(_t('toast_not_found').replace('{a}', original), 2500, 'error');
  }
}

// ══════════════════════════════════════════════════════════
// ONGLET 3 — THÉSAURUS via Wiktionnaire FR
// API MediaWiki publique, CORS ouvert, sans clé
// ══════════════════════════════════════════════════════════

// ── Sections du wikitext qui nous intéressent ─────────────
// ═══════════════════════════════════════════════════════════════════════
// MODULE SYNONYMES — FULL IA (multilingue, registres de langue)
// Remplace l'ancien moteur Wiktionnaire/CNRTL (fr-only, règles manuelles).
// Architecture :
//   runSynonyms()          → point d'entrée (bouton + Entrée)
//   _runSynonymsForWord()  → entrée directe (double-clic éditeur)
//   _synAICall()           → appel IA unique, parsing JSON
//   _synRender()           → rendu HTML des résultats
// ═══════════════════════════════════════════════════════════════════════

// ── Prompt système ────────────────────────────────────────────────────
const _SYN_SYSTEM = `Tu es un assistant lexical expert pour auteurs, maîtrisant toutes les langues.
Quand on te soumet un mot (quelle que soit sa forme : pluriel, conjugué, féminin, abrégé…),
tu identifies sa forme canonique et retournes une analyse lexicale structurée.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaire, sans texte autour.
Format exact :
{
  "forme": "forme canonique du mot",
  "langue": "code ISO 639-1 détecté (fr, en, es, ar, de, ru…)",
  "synonymes": [
    { "mot": "…", "registre": "courant|soutenu|familier|technique|littéraire|vieilli|argot" },
    …
  ],
  "quasi_synonymes": [
    { "mot": "…", "registre": "…" }
  ],
  "antonymes": [
    { "mot": "…", "registre": "…" }
  ],
  "note": "remarque courte et utile pour un auteur (contexte d'usage, nuance, piège), ou null"
}
Limites : max 8 entrées par liste. Qualité littéraire. Pas de doublons. Registres précis.
Si une liste est vide, retourne [].`;

// ── Couleurs par registre ─────────────────────────────────────────────
const _SYN_REGISTRE_COLORS = {
  'courant':    { bg: 'rgba(var(--accent-rgb,154,79,30),.08)',  border: 'rgba(var(--accent-rgb,154,79,30),.25)', text: '' },
  'soutenu':    { bg: 'rgba(74,158,202,.1)',   border: 'rgba(74,158,202,.3)',   text: '#2d6e8e' },
  'littéraire': { bg: 'rgba(111,88,165,.1)',   border: 'rgba(111,88,165,.3)',   text: '#5a3e9b' },
  'technique':  { bg: 'rgba(20,184,166,.08)',  border: 'rgba(20,184,166,.3)',   text: '#0d7a6a' },
  'familier':   { bg: 'rgba(245,158,11,.1)',   border: 'rgba(245,158,11,.3)',   text: '#92590a' },
  'argot':      { bg: 'rgba(239,68,68,.08)',   border: 'rgba(239,68,68,.25)',   text: '#9b1c1c' },
  'vieilli':    { bg: 'rgba(107,114,128,.08)', border: 'rgba(107,114,128,.3)',  text: '#4b5563' },
};

// ── Rendu HTML ────────────────────────────────────────────────────────
function _synRender(word, data, res) {
  if (!res) return;

  if (!data || data.error) {
    const noKeyMsg = data?.noKey
      ? `<div style="text-align:center;padding:14px 8px;">
           <div style="font-size:20px;margin-bottom:8px;">🔑</div>
           <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--ink);">Clé API requise</div>
           <div style="font-size:11px;color:var(--ink-muted);line-height:1.55;margin-bottom:10px;">
             Le module Synonymes utilise l'IA pour une analyse multilingue avec registres de langue.<br>
             Configurez votre clé dans <strong>Paramètres → IA</strong>.
           </div>
           <button onclick="toggleApiSection()" class="wt-run-btn" style="margin:0;font-size:11px;padding:5px 12px;">⚙ Configurer la clé IA</button>
         </div>`
      : `<div class="wt-empty"><strong>Erreur</strong><br><br>${escHtml(data?.msg || 'Erreur inconnue.')}</div>`;
    res.innerHTML = noKeyMsg;
    return;
  }

  const { forme, langue, synonymes = [], quasi_synonymes = [], antonymes = [], note } = data;
  const displayWord = forme || word;

  let html = `<div class="wt-syn-word">« ${escHtml(displayWord)} »`;
  if (langue && langue !== 'fr') {
    html += ` <span style="font-size:9px;font-weight:600;color:var(--ink-muted);letter-spacing:.05em;text-transform:uppercase;opacity:.7;">${escHtml(langue)}</span>`;
  }
  if (forme && forme.toLowerCase() !== word.toLowerCase()) {
    html += `<div style="font-size:10px;color:var(--ink-muted);font-weight:400;margin-top:2px;font-style:italic;">forme de base de « ${escHtml(word)} »</div>`;
  }
  html += `</div>`;

  // Sections
  const sections = [
    { key: 'synonymes',      label: 'Synonymes',       items: synonymes,      titleColor: '' },
    { key: 'quasi_synonymes',label: 'Quasi-synonymes', items: quasi_synonymes, titleColor: 'var(--ink-muted)' },
    { key: 'antonymes',      label: 'Antonymes',       items: antonymes,      titleColor: '#b91c1c' },
  ];

  let hasContent = false;
  for (const { label, items, titleColor } of sections) {
    if (!items || !items.length) continue;
    hasContent = true;
    html += `<div class="wt-syn-group">
      <div class="wt-syn-group-label"${titleColor ? ` style="color:${titleColor};"` : ''}>${escHtml(label)}</div>
      <div class="wt-syn-chips">`;
    for (const item of items) {
      const mot = typeof item === 'string' ? item : item.mot;
      const reg = (typeof item === 'object' && item.registre) ? item.registre.toLowerCase().trim() : 'courant';
      const cfg = _SYN_REGISTRE_COLORS[reg] || _SYN_REGISTRE_COLORS['courant'];
      html += `<button class="wt-syn-chip"
        style="background:${cfg.bg};border-color:${cfg.border};${cfg.text ? `color:${cfg.text};` : ''}"
        title="${escHtml(reg.charAt(0).toUpperCase()+reg.slice(1))} — Remplacer par « ${escHtml(mot)} »"
        onclick="wtReplaceWord(${JSON.stringify(word)},${JSON.stringify(mot)})"
      >${escHtml(mot)}<span class="wt-syn-reg" style="font-size:8px;opacity:.65;margin-left:4px;font-style:italic;">${escHtml(reg)}</span></button>`;
    }
    html += `</div></div>`;
  }

  if (!hasContent) {
    html += `<div class="wt-empty" style="margin-top:8px;">Aucun synonyme trouvé pour « ${escHtml(displayWord)} ».</div>`;
  }

  // Note auteur
  if (note) {
    html += `<div style="margin-top:10px;padding:8px 10px;background:var(--paper);border-left:2px solid var(--accent);border-radius:0 4px 4px 0;font-size:10.5px;color:var(--ink-muted);line-height:1.5;font-style:italic;">
      💡 ${escHtml(note)}
    </div>`;
  }

  res.innerHTML = html;
}

// ── Appel IA ─────────────────────────────────────────────────────────
async function _synAICall(word) {
  const _lsCfg     = (function(){ try { return JSON.parse(localStorage.getItem('ia_config') || '{}'); } catch(e){ return {}; } })();
  const activeProv = (_lsCfg.provider && AI_PROVIDERS?.[_lsCfg.provider]) ? _lsCfg.provider : (_wtProvider || 'claude');
  const provCfg    = _getProviderConfig(activeProv);
  const activeKey  = (provCfg.key || _wtApiKey || '').trim();

  if (!activeKey) return { error: true, noKey: true };

  const raw = await callAI(_SYN_SYSTEM, `Mot : ${word}`, 600);

  if (!raw || typeof raw !== 'string') return { error: true, msg: 'Réponse IA vide.' };
  if (raw.startsWith('__ERROR__')) {
    // Pas de clé valide ou provider injoignable
    return { error: true, msg: raw.replace('__ERROR__','').trim() || 'Erreur provider IA.' };
  }

  try {
    const clean = raw.replace(/```json|```/g,'').trim();
    return JSON.parse(clean);
  } catch(e) {
    return { error: true, msg: 'Réponse IA non parsable. Réessayez.' };
  }
}

// ── Entrée directe (double-clic éditeur) ─────────────────────────────
async function _runSynonymsForWord(word) {
  if (!word || word.length < 2) return;
  const res  = document.getElementById('wt-syn-results');
  const btn  = document.getElementById('wt-btn-syn');
  const hint = document.getElementById('wt-syn-hint');
  const inp  = document.getElementById('wonef-search-input');

  if (inp)  inp.value         = word;
  if (btn)  btn.disabled      = true;
  if (hint) hint.style.display = 'none';
  if (res)  res.innerHTML     = spinnerHtml('Synonymes…');

  try {
    const data = await _synAICall(word);
    _synRender(word, data, res);
  } catch(e) {
    if (res) res.innerHTML = `<span style="color:#dc2626;font-size:10.5px;">Erreur : ${e.message}</span>`;
  } finally {
    if (btn) btn.disabled = false;
    _synUpdateDot();
  }
}

// ── Point d'entrée (bouton / touche Entrée) ───────────────────────────
async function runSynonyms() {
  const ta       = document.getElementById('raw-input');
  const searchEl = document.getElementById('wonef-search-input');
  const res      = document.getElementById('wt-syn-results');
  const btn      = document.getElementById('wt-btn-syn');
  const hint     = document.getElementById('wt-syn-hint');

  // Mot : sélection éditeur > champ de recherche
  const sel  = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd).trim() : '';
  let word   = sel.split(/\s+/)[0].replace(/[^\p{L}\p{M}'\u2019\-]/gu, '');
  if (!word) word = (searchEl?.value || '').trim().split(/\s+/)[0].replace(/[^\p{L}\p{M}'\u2019\-]/gu, '');
  if (!word) { showToast('Sélectionnez un mot ou tapez-le dans le champ.', 3000, 'error'); return; }

  if (searchEl) searchEl.value = word;
  if (btn)  btn.disabled       = true;
  if (hint) hint.style.display = 'none';
  if (res)  res.innerHTML      = spinnerHtml('Synonymes…');

  try {
    const data = await _synAICall(word);
    _synRender(word, data, res);
  } catch(e) {
    if (res) res.innerHTML = `<span style="color:#dc2626;font-size:10.5px;">Erreur : ${e.message}</span>`;
  } finally {
    if (btn) btn.disabled = false;
    _synUpdateDot();
  }
}

// ── Mise à jour du dot indicateur ────────────────────────────────────
function _synUpdateDot() {
  const dot   = document.getElementById('wt-syn-dot');
  const label = document.getElementById('wt-syn-source-label');
  const _lsCfg = (function(){ try { return JSON.parse(localStorage.getItem('ia_config') || '{}'); } catch(e){ return {}; } })();
  const activeProv = (_lsCfg.provider && AI_PROVIDERS?.[_lsCfg.provider]) ? _lsCfg.provider : (_wtProvider || 'claude');
  const provCfg    = _getProviderConfig(activeProv);
  const hasKey     = !!((provCfg.key || _wtApiKey || '').trim());
  if (dot)   dot.style.background   = hasKey ? '#10b981' : '#6b7280';
  if (label) label.textContent      = hasKey ? `Synonymes IA · ${activeProv}` : 'Synonymes IA · Clé API requise';
}

function wtReplaceWord(original, replacement) {
  const ta = getTA();
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.slice(start, end);
  // Remplacer seulement dans la sélection courante (premier mot)
  const idx = sel.toLowerCase().indexOf(original.toLowerCase());
  if (idx >= 0) {
    const newSel = sel.slice(0, idx) + replacement + sel.slice(idx + original.length);
    taReplace(ta, start, end, newSel);
    ta.setSelectionRange(start, start + newSel.length);
  } else {
    // Fallback : chercher dans tout le texte via SE (robuste)
    const _h = SE.fuzzyFind(original) || SE.findOne(original);
    if (_h) {
      taReplace(ta, _h.start, _h.end, replacement);
      ta.setSelectionRange(_h.start, _h.start + replacement.length);
    }
  }
  markUnsaved();
  onRawInput();
  showToast(_t('toast_replaced_one').replace('{a}', original).replace('{b}', replacement), 2000, 'ok');
}


// ── Analyse IA — Onglet Style ──────────────────────────────
async function runStyleAI() {
  if (!_requireTextAndKey()) return;
  const text = getDomVal('raw-input').trim();
  if (!text) { showToast(_t('toast_no_text'), 2500, 'error'); return; }

  const btn = document.getElementById('wt-btn-style-ai');
  const box = document.getElementById('wt-style-ai-box');
  if (!box) { showToast('Élément d\'affichage introuvable.', 2500, 'error'); return; }

  box.style.display = '';
  box.innerHTML = '<span style="color:var(--ink-muted);font-style:italic;">✦ L\'IA analyse votre style…</span>';
  if (btn) { btn.disabled = true; btn.textContent = '✦ Analyse en cours…'; }

  try {
    let systemPrompt;
    try { systemPrompt = resolvePrompt('style'); }
    catch(e) { systemPrompt = DEFAULT_PROMPTS.style.text.replace('{contexte_oeuvre}', ''); }

    const result = await callAI(systemPrompt, `Voici un extrait du texte à analyser :\n\n"${text.slice(0, 3000)}"`, 400);
    if (!result || result.error) throw new Error(result?.error || 'Aucune réponse');
    box.innerHTML = renderAiLines(result.trim().split('\n')) + _aiCloseBtn('wt-style-ai-box');
  } catch(e) {
    box.innerHTML = `<span style="color:#dc2626;font-size:10.5px;">⚠ Erreur : ${escHtml(e.message)}</span>${_aiCloseBtn('wt-style-ai-box')}`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↺ Relancer IA'; }
  }
}

// ── Analyse IA — Onglet Stats ──────────────────────────────
async function runStatsAI() {
  if (!_requireTextAndKey()) return;

  const text    = getDomVal('raw-input').trim();
  if (!text) { showToast(_t('toast_no_text'), 2500, 'error'); return; }

  const btn = document.getElementById('wt-btn-stats-ai');
  const box = document.getElementById('wt-stats-ai-box');
  if (!box) { showToast('Élément d\'affichage introuvable.', 2500, 'error'); return; }

  const statsEl  = document.getElementById('wt-stats-results');
  const statsText = statsEl ? statsEl.innerText.slice(0, 2500) : '';

  box.style.display = '';
  if (btn) { btn.disabled = true; btn.textContent = '✦ Analyse…'; }

  // ── Découpe en blocs ──────────────────────────────────────────────────────
  function splitIntoBlocks(rawText) {
    const lines  = rawText.split('\n');
    const blocks = [];
    let current  = [];
    let title    = 'Bloc 1';
    let blockNum = 1;
    for (const line of lines) {
      const lvl = (typeof headingLevel === 'function') ? headingLevel(line) : 0;
      if (lvl === 1 && current.join('\n').trim().length > 80) {
        blocks.push({ title, text: current.join('\n').trim() });
        blockNum++;
        title   = line.trim() || `Bloc ${blockNum}`;
        current = [];
      } else {
        current.push(line);
      }
    }
    if (current.join('\n').trim().length > 80)
      blocks.push({ title, text: current.join('\n').trim() });
    if (blocks.length <= 1) {
      const words = rawText.split(/\s+/).filter(Boolean);
      const size  = 1200;
      const result = [];
      for (let i = 0; i < words.length; i += size)
        result.push({ title: `Bloc ${result.length + 1}`, text: words.slice(i, i + size).join(' ') });
      return result.length ? result : [{ title: 'Texte complet', text: rawText.trim() }];
    }
    return blocks;
  }

  const blocks     = splitIntoBlocks(text);
  const totalWords = text.split(/\s+/).filter(Boolean).length;
  const volumeInfo = `Roman de ${totalWords.toLocaleString('fr-FR')} mots — ${blocks.length} bloc(s) / chapitre(s) détecté(s).`;

  const MAX_BLOCS        = 18;
  const blocsToAnalyse   = blocks.slice(0, MAX_BLOCS);
  const delayMs          = { gemini: 8000, groq: 1000, openrouter: 2000, claude: 500, openai: 1000 };
  const interCallDelay   = delayMs[_wtProvider] || 2000;

  try {
    // ── Résolution des prompts — une seule fois avant la boucle ──────────
    let sysMap;
    try { sysMap = resolvePrompt('stats_map'); }
    catch(e) { sysMap = DEFAULT_PROMPTS.stats_map.text.replace('{contexte_oeuvre}', ''); }

    // ── Boucle map par bloc ───────────────────────────────────────────────
    const analyses = [];
    for (let i = 0; i < blocsToAnalyse.length; i++) {
      const bloc    = blocsToAnalyse[i];
      const waitSec = interCallDelay > 1000 ? ` (pause ${interCallDelay/1000}s)` : '';
      box.innerHTML = `<span style="color:var(--ink-muted);font-style:italic;">✦ Analyse en chaîne : ${i + 1} / ${blocsToAnalyse.length} blocs… (${escHtml(bloc.title)})${escHtml(waitSec)}</span>`;

      if (i > 0) await new Promise(r => setTimeout(r, interCallDelay));

      try {
        const res = await callAI(sysMap, `Chapitre/Bloc : "${bloc.title}"\n\n${bloc.text.slice(0, 2200)}`, 300);
        if (res && typeof res === 'string' && res.trim()) {
          analyses.push(`### ${bloc.title}\n${res.trim()}`);
        } else if (res && res.error) {
          analyses.push(`### ${bloc.title}\n[Analyse échouée : ${res.error}]`);
          // Si erreur de clé ou provider, sortir immédiatement
          if (res.error.includes('clé') || res.error.includes('API') || res.error.includes('Provider')) {
            box.innerHTML = `<span style="color:#dc2626;font-size:11px;">⚠ ${escHtml(res.error)}</span>`;
            return;
          }
        } else {
          analyses.push(`### ${bloc.title}\n[Aucune réponse]`);
        }
      } catch(e) {
        analyses.push(`### ${bloc.title}\n[Erreur : ${e.message}]`);
      }
    }

    // ── Synthèse globale ─────────────────────────────────────────────────
    box.innerHTML = `<span style="color:var(--ink-muted);font-style:italic;">✦ Synthèse globale en cours…</span>`;

    let sysReduce;
    try {
      sysReduce = resolvePrompt('stats_reduce')
        .replace('{blocks_count}', blocks.length)
        .replace('{total_words}', totalWords.toLocaleString('fr-FR'));
    } catch(e) {
      sysReduce = DEFAULT_PROMPTS.stats_reduce.text
        .replace('{contexte_oeuvre}', '')
        .replace('{blocks_count}', blocks.length)
        .replace('{total_words}', totalWords.toLocaleString('fr-FR'));
    }

    const analysesDump = analyses.join('\n\n');
    const reduceRes = await callAI(
      sysReduce,
      `${volumeInfo}\n\nSTATISTIQUES GLOBALES :\n${statsText}\n\nANALYSES PAR CHAPITRE :\n${analysesDump}`,
      1000
    );

    if (!reduceRes || reduceRes.error) {
      // Afficher les analyses individuelles même si la synthèse a échoué
      const errMsg = reduceRes?.error || 'Aucune réponse du modèle';
      const detailOnly = analyses.map(a => {
        const aLines = a.split('\n');
        const titre  = aLines[0].replace(/^###\s*/, '');
        const corps  = aLines.slice(1).join('\n');
        return `<details style="margin-bottom:6px;border:1px solid var(--cream);border-radius:5px;overflow:hidden;">
          <summary style="padding:6px 10px;font-size:10.5px;font-weight:600;cursor:pointer;background:var(--paper);color:var(--ink-soft);">📄 ${titre}</summary>
          <div style="padding:8px 10px;font-size:10.5px;line-height:1.6;color:var(--ink-soft);">${corps.replace(/\n/g,'<br>')}</div>
        </details>`;
      }).join('');
      box.innerHTML =
        `<div style="color:#dc2626;font-size:10.5px;margin-bottom:10px;">⚠ Synthèse échouée : ${escHtml(errMsg)}</div>` +
        `<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted);margin-bottom:6px;">Détail par chapitre / bloc</div>` +
        detailOnly +
        _aiCloseBtn('wt-stats-ai-box');
      return;
    }

    // ── Rendu final ───────────────────────────────────────────────────────
    const synthHtml  = renderAiLines(reduceRes.trim().split('\n'));
    const detailHtml = analyses.map(a => {
      const aLines = a.split('\n');
      const titre  = aLines[0].replace(/^###\s*/, '');
      const corps  = aLines.slice(1).join('\n');
      return `<details style="margin-bottom:6px;border:1px solid var(--cream);border-radius:5px;overflow:hidden;">
        <summary style="padding:6px 10px;font-size:10.5px;font-weight:600;cursor:pointer;background:var(--paper);color:var(--ink-soft);">📄 ${titre}</summary>
        <div style="padding:8px 10px;font-size:10.5px;line-height:1.6;color:var(--ink-soft);">${corps.replace(/\n/g,'<br>')}</div>
      </details>`;
    }).join('');

    box.innerHTML =
      synthHtml +
      `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--cream);">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted);margin-bottom:6px;">Détail par chapitre / bloc</div>
        ${detailHtml}
      </div>` +
      _aiCloseBtn('wt-stats-ai-box');

  } catch(e) {
    box.innerHTML = `<span style="color:#dc2626;font-size:10.5px;">⚠ Erreur inattendue : ${escHtml(e.message)}</span>${_aiCloseBtn('wt-stats-ai-box')}`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↺ Relancer IA'; }
  }
}


async function runRapportEditorial() {
  if (!_requireTextAndKey()) return;
  const text = getDomVal('raw-input').trim();
  const btn  = document.getElementById('wt-btn-rapport');
  const res  = document.getElementById('wt-rapport-results');
  btn.disabled = true;
  btn.textContent = '⏳ Analyse en cours…';
  try {
  res.innerHTML = `
    <div style="padding:16px 0;color:var(--ink-muted);font-size:11.5px;font-style:italic;line-height:2;">
      <div id="rp-step-lt"  style="opacity:.4;">🛡 LanguageTool — vérification grammaire…</div>
      <div id="rp-step-sty" style="opacity:.4;">📊 Analyse de style locale…</div>
      <div id="rp-step-sta" style="opacity:.4;">📈 Calcul des statistiques…</div>
      <div id="rp-step-ai"  style="opacity:.4;">✦ IA — rédaction du rapport…</div>
    </div>`;

  const setStep = (id, done) => {
    const el = document.getElementById(id);
    if (el) { el.style.opacity = done ? '1' : '.4'; el.style.color = done ? 'var(--accent)' : ''; }
  };

  const cleanText = text.replace(/\[IMAGE:[^\]]*\]/gi, '').replace(/\[NOTE:[^\]]*\]/gi, '').replace(/\[HL:\w+\s([^\|]*?)(?:\|[^\]]*)?\]/gi, '$1').replace(/\[TAG:\w+\s([^\]]*)\]/gi, '$1');

  // ── Étape 1 : LanguageTool ────────────────────────────
  setStep('rp-step-lt', true);
  let ltSummary = '';
  try {
    // Tentative 1, puis retry après 1.5s si erreur réseau
    let ltResult = await callLanguageTool(cleanText.slice(0, 18000));
    if (ltResult.error) {
      await new Promise(r => setTimeout(r, 1500));
      ltResult = await callLanguageTool(cleanText.slice(0, 18000));
    }
    if (!ltResult.error && ltResult.matches) {
      const issues = ltPostFilter(ltMatchesToIssues(ltResult.matches, cleanText));
      const errors   = issues.filter(i => i.type === 'error');
      const typos    = issues.filter(i => i.type === 'typo');
      const warnings = issues.filter(i => i.type === 'warning' || i.type === 'style');
      ltSummary = `LanguageTool a détecté : ${errors.length} erreur(s) grammaticale(s), ${typos.length} faute(s) d'orthographe, ${warnings.length} avertissement(s) de style.`;
      if (errors.length > 0) {
        ltSummary += '\nExemples d\'erreurs grammaticales : ' +
          errors.slice(0,3).map(i => `"${i.raw || i.ctx}" — ${i.text}`).join(' | ');
      }
      if (typos.length > 0) {
        ltSummary += '\nExemples de fautes d\'orthographe : ' +
          typos.slice(0,3).map(i => `"${i.raw || i.ctx}" — suggestion : ${i.suggest?.[0] || '?'}`).join(' | ');
      }
      if (warnings.length > 0) {
        ltSummary += '\nExemples de style : ' +
          warnings.slice(0,3).map(i => `"${i.raw || i.ctx}" — ${i.text}`).join(' | ');
      }
      if (errors.length === 0 && typos.length === 0 && warnings.length === 0) {
        ltSummary = 'LanguageTool : aucune faute d\'orthographe ni erreur grammaticale détectée — texte propre sur ce plan.';
      }
    } else {
      // LT inaccessible après retry — on analyse directement l'extrait avec les règles locales
      ltSummary = '(LanguageTool temporairement inaccessible — analyse orthographique basée sur le moteur local uniquement.)';
    }
  } catch(e) {
    ltSummary = '(LanguageTool temporairement inaccessible — analyse orthographique basée sur le moteur local uniquement.)';
  }

  // ── Étape 2 : Style local (extraction directe) ────────
  setStep('rp-step-sty', true);
  let styleSummary = '';
  try {
    const words = cleanText.match(/\b[a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ]{2,}\b/g) || [];
    const sentencesRaw = cleanText
      .split(/(?<=[.!?])\s+(?=[A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ—«])|(?<=[.!?])\s*\n+\s*(?=[A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ—«"\-])/)
      .map(s => s.trim()).filter(s => s.length > 8);
    const sentencesForAvg = sentencesRaw.filter(s => s.split(/\s+/).length >= 5);
    const totalWords = words.length;
    const avgWPS = sentencesForAvg.length ? Math.round(totalWords / sentencesForAvg.length) : 0;
    const longSents = sentencesRaw.filter(s => s.split(/\s+/).length > 35);
    const shortSents = sentencesRaw.filter(s => { const wc = s.split(/\s+/).length; return wc < 5 && wc > 1 && !/^[—«]/.test(s); });

    const allAdverbs = (cleanText.match(/\b\w{4,}ment\b/gi) || [])
      .filter(a => !['vraiment','simplement','seulement','comment','moment','également','notamment','surtout','autrement','souvent'].includes(a.toLowerCase()));
    const uniqAdverbs = [...new Set(allAdverbs.map(a => a.toLowerCase()))];

    const weakFound = {};
    (MOTS_FAIBLES || []).forEach(mot => {
      const rx = new RegExp('\\b' + mot + '\\b', 'gi');
      const m = cleanText.match(rx) || [];
      if (m.length >= 2) weakFound[mot] = m.length;
    });

    const seenAt = {}; const closeReps = [];
    words.forEach((w, i) => {
      const lw = w.toLowerCase();
      if (lw.length < 5 || (typeof STOP_STYLE !== 'undefined' && STOP_STYLE.has(lw))) return;
      if (seenAt[lw] !== undefined && i - seenAt[lw] < 80 && !closeReps.find(r => r.word === lw))
        closeReps.push({ word: lw, gap: i - seenAt[lw] });
      seenAt[lw] = i;
    });

    const topWeak = Object.entries(weakFound).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([w,c])=>`"${w}" (×${c})`).join(', ');
    const topReps = closeReps.slice(0,6).map(r=>`"${r.word}"`).join(', ');

    styleSummary = `Longueur moyenne des phrases : ${avgWPS} mots. Phrases longues (>35 mots) : ${longSents.length}. Phrases très courtes (<5 mots) : ${shortSents.length}.`;
    if (uniqAdverbs.length > 0) styleSummary += `\nAdverbes en -ment détectés (${uniqAdverbs.length}) : ${uniqAdverbs.slice(0,8).join(', ')}.`;
    if (topWeak) styleSummary += `\nMots faibles fréquents : ${topWeak}.`;
    if (topReps) styleSummary += `\nRépétitions proches (fenêtre 80 mots) : ${topReps}.`;
    if (longSents.length > 0) styleSummary += `\nExemple de phrase longue : "${longSents[0].slice(0,120)}…"`;
  } catch(e) {
    styleSummary = `Analyse de style non disponible (${e.message}).`;
  }

  // ── Étape 3 : Stats locales ───────────────────────────
  setStep('rp-step-sta', true);
  let statsSummary = '';
  try {
    const words2 = cleanText.match(/\b[a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ]{2,}\b/g) || [];
    const totalWords2 = words2.length;
    const uniqueWords = new Set(words2.map(w => w.toLowerCase())).size;
    const ttr = totalWords2 > 0 ? (uniqueWords / totalWords2 * 100).toFixed(1) : 0;
    const paras = cleanText.split(/\n{2,}/).filter(p => p.trim().length > 0).length;
    const dialogLines = cleanText.split('\n').filter(l => /^[—«""\u201c\u201d]/.test(l.trim())).length;
    const sentCount = cleanText.split(/(?<=[.!?])\s+(?=[A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ])/).length;
    const dialogPct = sentCount > 0 ? Math.round(dialogLines / sentCount * 100) : 0;

    const PS_EXCLUD = /\b(?:nuit|bruit|fruit|gratuit|produit|conduit|circuit|saint|point|joint|grain|train|plein|fin|certain|terrain|humain|demain|main|bain|pain|vain|chemin|matin|latin|cousin|voisin)\b/gi;
    const pSimpleRaw = (cleanText.match(/\b[a-záàâéèêëîïôùûüœç]{3,}(?:ai|as|a(?!it\b)|âmes|âtes|èrent|it|irent|ut|urent|ût|ussent|int(?!érieur)|inrent|vint|vinrent)\b/g)||[]);
    const pSimple = pSimpleRaw.filter(w => !PS_EXCLUD.test(w)).length;
    const pImparfait = (cleanText.match(/\b[a-záàâéèêëîïôùûüœç]{3,}(?:ais|ait|ions|iez|aient)\b/g)||[]).length;
    const present = (cleanText.match(/\b[a-záàâéèêëîïôùûüœç]{4,}(?:e|es|ons|ez|ent)\b/g)||[]).length;
    const totalVerbes = pSimple + pImparfait + present || 1;
    const psRatio = Math.round(pSimple / totalVerbes * 100);
    const impRatio = Math.round(pImparfait / totalVerbes * 100);
    const presRatio = Math.round(present / totalVerbes * 100);

    statsSummary = `Mots total : ${totalWords2}. Richesse lexicale (TTR) : ${ttr}%. Paragraphes : ${paras}. Dialogue estimé : ${dialogPct}%.`;
    statsSummary += `\nTemps verbaux estimés — passé simple : ${psRatio}%, imparfait : ${impRatio}%, présent : ${presRatio}%.`;
    if (ttr < 40) statsSummary += '\n⚠ Richesse lexicale faible : le vocabulaire paraît répétitif.';
    if (dialogPct > 60) statsSummary += '\n⚠ Forte proportion de dialogue : la narration est peu développée.';
    if (dialogPct < 5 && totalWords2 > 500) statsSummary += '\n⚠ Très peu de dialogue : le texte peut paraître monolithique.';
  } catch(e) {
    statsSummary = `Calcul des statistiques non disponible (${e.message}).`;
  }

  // ── Étape 4 : IA compile le rapport ──────────────────
  setStep('rp-step-ai', true);

  const oeuvreCtx = buildOeuvreContext();
  const excerpt = cleanText.slice(0, 2500);

  const systemPrompt = resolvePrompt('rapport');

  const userMsg = `Voici les données d'analyse :\n\n=== GRAMMAIRE (LanguageTool) ===\n${ltSummary}\n\n=== STYLE (moteur local) ===\n${styleSummary}\n\n=== STATISTIQUES (moteur local) ===\n${statsSummary}\n\n=== EXTRAIT DU TEXTE ===\n"${excerpt}"`;

  let rapportHTML = '';
  try {
    const result = await callAI(systemPrompt, userMsg, 650);
    if (!result) throw new Error('Clé API manquante ou provider non configuré.');
    if (result.error) throw new Error(result.error);

    // Rendu du rapport
    const SECTION_COLORS = {
      '🔴': '#dc2626', '🟠': '#f97316', '🟡': '#f59e0b', '🟢': '#16a34a'
    };
    const lines = result.trim().split('\n').filter(l => l.trim());
    let html = '<div style="font-size:11.5px;line-height:1.75;color:var(--ink-soft);">';

    lines.forEach(l => {
      const clean = l.trim()
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      // Titres de section (—  🔴/🟠/🟡/🟢 + bold)
      const sectionMatch = clean.match(/^[—\-]\s*(🔴|🟠|🟡|🟢)\s*<strong>([^<]+)<\/strong>/);
      if (sectionMatch) {
        const emoji = sectionMatch[1];
        const color = SECTION_COLORS[emoji] || 'var(--accent)';
        html += `<div style="margin-top:13px;margin-bottom:5px;padding:6px 10px;background:var(--paper);border-left:3px solid ${color};border-radius:0 4px 4px 0;font-size:11px;font-weight:600;color:${color};">${emoji} ${sectionMatch[2]}</div>`;
      } else if (clean.startsWith('—') || clean.startsWith('-')) {
        html += `<div style="margin-bottom:5px;padding-left:10px;">${clean.replace(/^[—\-]\s*/, '')}</div>`;
      } else {
        html += `<div style="margin-bottom:4px;">${clean}</div>`;
      }
    });
    html += '</div>';

    // Boutons d'action
    html += `<div style="display:flex;gap:6px;margin-top:14px;padding-top:10px;border-top:1px solid var(--cream);">
      <button onclick="copyRapportToClipboard()" style="flex:1;font-family:'DM Sans',sans-serif;font-size:10.5px;padding:6px 10px;border:1px solid var(--cream);background:var(--paper);border-radius:4px;cursor:pointer;color:var(--ink-soft);" title="${_t('rapport_copy')}">📋 Copier</button>
      <button onclick="runRapportEditorial()" style="flex:1;font-family:'DM Sans',sans-serif;font-size:10.5px;padding:6px 10px;border:1px solid var(--accent-light);background:transparent;border-radius:4px;cursor:pointer;color:var(--accent);">↺ Relancer</button>
    </div>`;

    // Stocker le texte brut pour copie
    window._lastRapportText = `RAPPORT ÉDITORIAL\n${'═'.repeat(40)}\n\n${result}`;

    rapportHTML = html;
  } catch(e) {
    rapportHTML = `<div style="color:#dc2626;font-size:10.5px;padding:8px;">Erreur IA : ${escHtml(e.message)}</div>`;
  }

  res.innerHTML = rapportHTML;
  } finally {
    btn.disabled = false;
    btn.textContent = '📋 Générer le rapport éditorial';
  }
}

function copyRapportToClipboard() {
  const txt = window._lastRapportText || '';
  if (!txt) return;
  navigator.clipboard.writeText(txt)
    .then(() => showToast('Rapport copié dans le presse-papiers.', 2500))
    .catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Rapport copié.', 2500);
    });
}

// ── Drag & drop fichier texte dans l'éditeur ─────────────
document.addEventListener('DOMContentLoaded', () => {
  const ta = getTA();
  if (!ta) return;
  ta.addEventListener('dragover', e => e.preventDefault());
  ta.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = ev => {
        // taWrite() préserve l'historique Ctrl+Z — ta.value = ... ne le fait pas
        taWrite(ta, ev.target.result);
        onRawInput();
      };
      reader.readAsText(file);
    }
  });
});

