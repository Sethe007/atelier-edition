// ═══════════════════════════════════════════════════════
// MOTEUR MODALE PROPOSITIONS IA
// ═══════════════════════════════════════════════════════

// État interne
const _iaProp = {
  type:       '',      // 'long_sentence' | 'repetition' | 'debut' | 'cliche'
  payload:    null,    // données brutes passées par la vignette
  original:   '',      // texte original à remplacer dans le textarea
  selected:   null,    // proposition choisie (string)
  generated:  false,   // propositions déjà générées ?
  vignette:   null,    // élément DOM de la vignette source (pour la masquer après)
};

// ── Ouvre la modale depuis une vignette ─────────────────
function iaPropOpen(btnEl, type) {
  // Lire le payload depuis data-ia-payload (stocké en JSON dans l'attribut)
  let payload = null;
  const rawAttr = btnEl.dataset.iaPayload || '';
  if (rawAttr) {
    try { payload = JSON.parse(rawAttr); } catch(e) { payload = rawAttr; }
  }

  // Récupérer le texte original à afficher dans l'en-tête
  const card = btnEl.closest('.wt-issue, [data-style-card]');
  let original = '';
  if (type === 'long_sentence') {
    original = typeof payload === 'string' ? payload : (payload?.text || String(payload || ''));
  } else if (type === 'repetition') {
    original = typeof payload === 'object' ? (payload?.ctx || payload?.word || '') : String(payload || '');
  } else if (type === 'debut') {
    original = typeof payload === 'string' ? payload : String(payload || '');
  } else if (type === 'cliche') {
    original = typeof payload === 'string' ? payload : String(payload || '');
  }

  _iaProp.type      = type;
  _iaProp.payload   = payload;
  _iaProp.original  = original;
  _iaProp.selected  = null;
  _iaProp.generated = false;
  _iaProp.vignette  = card;

  // Reset UI
  const list    = document.getElementById('ia-prop-list');
  const err     = document.getElementById('ia-prop-error');
  const loading = document.getElementById('ia-prop-loading');
  const genZone = document.getElementById('ia-prop-generate-zone');
  const genBtn  = document.getElementById('ia-prop-btn-generate');
  const replBtn = document.getElementById('ia-prop-btn-replace');
  const hint    = document.getElementById('ia-prop-hint');
  const confirm = document.getElementById('ia-prop-confirm');

  list.innerHTML    = '';
  err.style.display = 'none';
  loading.style.display = 'none';
  genZone.style.display = 'block';
  genBtn.disabled   = false;
  genBtn.textContent = '✦ Générer les propositions';
  replBtn.disabled  = true;
  hint.textContent  = 'Sélectionnez une proposition pour activer le remplacement.';
  if (confirm) confirm.classList.remove('open'); // garde: l'élément peut être absent du DOM

  // Afficher le texte original
  const labels = {
    long_sentence: 'Phrase longue',
    repetition:    'Répétition',
    debut:         'Début répétitif',
    cliche:        'Cliché littéraire',
  };
  document.getElementById('ia-prop-title').textContent =
    '✦ Propositions — ' + (labels[type] || 'Style');
  document.getElementById('ia-prop-original').textContent =
    '"' + original.slice(0, 180) + (original.length > 180 ? '…' : '') + '"';

  // Vérifier la clé dès l'ouverture — via _loadIaConfig() pour inclure le cache mémoire (file://)
  const _activeProv = _loadIaConfig().provider || _wtProvider || 'claude';
  const _activeCfg = _getProviderConfig(_activeProv);
  const hasKey = !!( (_activeCfg?.key || _wtApiKey || '').trim() || getDomVal('wt-api-key').trim() );
  if (!hasKey) {
    genZone.style.display = 'none';
    err.style.display = 'block';
    err.style.background = '#fee2e2';
    err.style.color = '#dc2626';
    err.textContent = '⚠ Aucune clé API configurée. Ouvrez ⚙ Paramètres → Config IA, entrez votre clé et cliquez 💾 Enregistrer.';
  }

  document.getElementById('ia-prop-overlay').classList.add('open');
  // Fermeture clavier
  document.addEventListener('keydown', _iaPropKeyClose);
}

function _iaPropKeyClose(e) {
  if (e.key === 'Escape') iaPropClose();
}

function iaPropClose() {
  document.getElementById('ia-prop-overlay').classList.remove('open');
  document.removeEventListener('keydown', _iaPropKeyClose);
}

// ── Génération IA ───────────────────────────────────────
async function iaPropGenerate() {
  const genBtn  = document.getElementById('ia-prop-btn-generate');
  const loading = document.getElementById('ia-prop-loading');
  const genZone = document.getElementById('ia-prop-generate-zone');
  const list    = document.getElementById('ia-prop-list');
  const err     = document.getElementById('ia-prop-error');

  genBtn.disabled = true;
  genBtn.textContent = '…';
  genZone.style.display = 'none';
  loading.style.display = 'block';
  list.innerHTML = '';
  err.style.display = 'none';

  const oeuvreCtx = buildOeuvreContext();
  const type      = _iaProp.type;
  const payload   = _iaProp.payload;
  let systemPrompt = '';
  let userMsg      = '';

  if (type === 'long_sentence') {
    const phrase = typeof payload === 'string' ? payload : (payload?.text || String(payload));
    systemPrompt = resolvePrompt('prop_longue');
    userMsg = `Phrase à alléger :\n\n"${phrase.slice(0, 600)}"`;

  } else if (type === 'repetition') {
    const word = payload?.word || payload;
    const ctx  = payload?.ctx  || String(payload);
    systemPrompt = resolvePrompt('prop_repetition').replace(/le mot fourni/g, `le mot « ${word} »`);
    userMsg = `Contexte :\n"${ctx.slice(0, 300)}"\n\nPropose 3 alternatives naturelles au mot « ${word} ».`;

  } else if (type === 'debut') {
    const debut = typeof payload === 'string' ? payload : String(payload);
    systemPrompt = resolvePrompt('prop_debut');
    userMsg = `Évite de commencer par « ${debut} ».\nPropose 3 reformulations d'ouverture.`;

  } else if (type === 'cliche') {
    const cliche = typeof payload === 'string' ? payload : String(payload);
    systemPrompt = resolvePrompt('prop_cliche');
    userMsg = `Cliché à remplacer :\n\n« ${cliche.slice(0, 300)} »`;
  }

  try {
    const result = await callAI(systemPrompt, userMsg, 500);
    if (!result || result.error) throw new Error(result?.error || 'Aucune réponse de l\'IA.');

    const lines = result.trim().split('\n')
      .map(l => l.replace(/^[\d]+[.\)]\s*/, '').trim())
      .filter(l => l.length > 2 && l !== 'CONSERVER');

    loading.style.display = 'none';

    if (!lines.length) throw new Error('L\'IA n\'a pas retourné de propositions valides.');

    // Cas spécial CONSERVER (répétition sur nom propre)
    if (result.trim().toUpperCase().includes('CONSERVER')) {
      err.style.display = 'block';
      err.style.background = '#fef3c7';
      err.style.color = '#92400e';
      err.textContent = '✦ L\'IA recommande de conserver ce mot (nom propre ou terme indispensable).';
      return;
    }

    // Afficher les cartes
    _iaProp.generated = true;
    lines.slice(0, 3).forEach((line, i) => {
      const card = document.createElement('div');
      card.className = 'ia-prop-card';
      card.innerHTML = `<div class="ia-prop-num">Proposition ${i + 1}</div>${escHtml(line)}`;
      card.addEventListener('click', () => {
        document.querySelectorAll('.ia-prop-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        _iaProp.selected = line;
        document.getElementById('ia-prop-btn-replace').disabled = false;
        document.getElementById('ia-prop-hint').textContent = '✓ Proposition sélectionnée — cliquez sur Remplacer.';
      });
      list.appendChild(card);
    });

    // Bouton régénérer
    genZone.style.display = 'block';
    genBtn.disabled = false;
    genBtn.textContent = '↺ Régénérer';

  } catch(e) {
    loading.style.display = 'none';
    genZone.style.display = 'block';
    genBtn.disabled = false;
    genBtn.textContent = '↺ Réessayer';
    err.style.display = 'block';
    err.style.background = '#fee2e2';
    err.style.color = '#dc2626';
    err.textContent = 'Erreur : ' + e.message;
  }
}

// ── Confirmation & remplacement ─────────────────────────
function iaPropAskConfirm() {
  if (!_iaProp.selected) return;
  document.getElementById('ia-prop-confirm').classList.add('open');
}

function iaPropConfirmClose() {
  document.getElementById('ia-prop-confirm').classList.remove('open');
}

function iaPropDoReplace() {
  const repl     = _iaProp.selected;
  const original = _iaProp.original;
  if (!repl || !original) { iaPropConfirmClose(); return; }

  const ta   = getTA();
  const text = ta.value;

  // Chercher la phrase originale dans le texte (fuzzy : on prend les 60 premiers caractères comme ancre)
  const anchor = original.slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx     = new RegExp(anchor);
  const idx    = text.search(rx);

  if (idx >= 0) {
    // Trouver la fin du bloc (jusqu'à la longueur de l'original ou fin de phrase)
    const end = idx + original.length;
    taReplace(ta, idx, Math.min(end, text.length), repl);
    markUnsaved();
    onRawInput();
    showToast('Passage remplacé ✓', 2200, 'ok');
  } else {
    // Fallback : wtReplaceNextOccurrence sur les premiers mots
    const firstWords = original.split(/\s+/).slice(0, 6).join(' ');
    wtReplaceNextOccurrence(firstWords, repl);
  }

  // Masquer la vignette source
  if (_iaProp.vignette) {
    _iaProp.vignette.style.opacity = '0';
    _iaProp.vignette.style.transition = 'opacity .3s';
    setTimeout(() => {
      _iaProp.vignette.style.display = 'none';
      window._wtRecalcStyleScoreAfterDismiss && window._wtRecalcStyleScoreAfterDismiss();
    }, 320);
  }

  iaPropConfirmClose();
  iaPropClose();
}

// ══════════════════════════════════════════════════════════
// ── SYSTÈME DE GESTION DES PROMPTS IA ─────────────────────
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// ── SYSTÈME DE PRÉFÉRENCES ─────────────────────────────────
// ══════════════════════════════════════════════════════════



// ─────────────────────────────────────────────────────────────────────────────
// Les sections suivantes ont été extraites dans des modules dédiés :
//
//   LANGUE_LABELS, buildLangInstruction()  → src/i18n/index.js
//   DEFAULT_PROMPTS, getPrompt(), …        → src/prompts/index.js
//   Catalogues fr/en/es                   → src/i18n/fr.js / en.js / es.js
//   Moteur applyI18n(), _t(), …            → src/i18n/index.js
//
// Ces modules sont chargés avant writingTools.js (voir vite.config.js).
// ─────────────────────────────────────────────────────────────────────────────

