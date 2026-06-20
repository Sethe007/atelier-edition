// ── CONSTANTES APPLICATIVES ────────────────────────────
const APP_VERSION       = 'Atelier Édition v52';
const DEBOUNCE_MS       = 650;

// ══════════════════════════════════════════════════════════
// ── HELPERS CENTRALISÉS ───────────────────────────────────
// ══════════════════════════════════════════════════════════

/** Récupère la valeur d'un élément par id (chaîne vide si absent). */
function getDomVal(id) {
  return document.getElementById(id)?.value || '';
}

/** Définit la valeur d'un élément par id si l'élément existe. */
function setDomVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

/** Indique si le format actif est un format soumission. */
function isSubmitFormat(fmt) {
  fmt = fmt || getDomVal('page-format');
  return fmt === 'SUBMIT_AMI' || fmt === 'SUBMIT_STD';
}

/** Nettoie le texte pour les analyses (retire balises image/note, normalise ponctuation). */
function cleanForCounting(text) {
  return text
    .replace(/\[NOTE:[^\]]*\]/gi, '')
    .replace(/\[HL:\w+\s([^\|]*?)(?:\|[^\]]*)?\]/gi, '$1')
    .replace(/\[TAG:\w+\s([^\]]*)\]/gi, '$1')
    .replace(/\[IMAGE:[^\]]*\]/gi, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/—|–/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""«»]/g, '"');
}

/** Compte les mots d'un texte (retire balises image/note avant comptage). */
function countWords(txt) {
  const clean = txt
    .replace(/\[NOTE:[^\]]*\]/gi, '')
    .replace(/\[HL:\w+\s([^\|]*?)(?:\|[^\]]*)?\]/gi, '$1')
    .replace(/\[TAG:\w+\s([^\]]*)\]/gi, '$1')
    .replace(/\[IMAGE:[^\]]*\]/gi, '');
  return (clean.match(/\S+/g) || []).length;
}

/** Sauvegarde/restaure une préférence simple dans localStorage. */
function lsPref(action, key, inputId) {
  try {
    if (action === 'save') {
      const v = getDomVal(inputId);
      localStorage.setItem(key, v);  // Enregistre même si vide (efface la valeur)
    } else {
      const v = localStorage.getItem(key);
      if (v !== null) setDomVal(inputId, v);
    }
  } catch(e) {}
}

/** Retourne la date du jour au format YYYY-MM-DD. */
function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Extrait tous les mots (en minuscules, longueur > 1) depuis les noms,
 * variantes, et champs optionnels des fiches personnages et lieux.
 * Utilisé par buildLtParams, ltPostFilter et le moteur de style local.
 */
function getKnownProperWords() {
  const words = new Set();
  const addWords = str => {
    if (!str) return;
    str.split(/[\s\-\/]+/).forEach(w => {
      const clean = w.replace(/[^a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ]/g, '');
      if (clean.length > 1) words.add(clean.toLowerCase());
    });
  };
  const addVariants = str => {
    if (!str) return;
    str.split(/[,;]+/).map(v => v.trim()).filter(Boolean).forEach(v => addWords(v));
  };
  getPersos().forEach(p => {
    addWords(p.nom);
    addVariants(p.variantes);
    addWords(p.origine);   // ex: "Eindonnien", "noblesse du Nord"
    addVariants(p.langage); // ex: "parle en argot", noms de dialectes
  });
  getLieux().forEach(l => {
    addWords(l.nom);
    addVariants(l.variantes);
    addVariants(l.peuples);     // ex: "Elfes des Cendres, Nains du Fer"
    addWords(l.parent);         // ex: "Empire d'Astral"
    addWords(l.gouvernance);    // ex: "Roi Aldren III"
  });
  return words;
}

/** Retourne l'élément textarea principal (raw-input). */
function getTA() { return document.getElementById('raw-input'); }

/** Génère le HTML d'un spinner de chargement pour les panneaux outils. */
function spinnerHtml(msg) {
  return `<div class="wt-spinner"><div class="wt-spinner-ring"></div>${msg}</div>`;
}

/**
 * Désactive un bouton pendant une opération async, le réactive après.
 */
async function withBtnBusy(btn, labelDuring, labelAfter, asyncFn) {
  if (!btn) { await asyncFn(); return; }
  btn.disabled = true;
  btn.textContent = labelDuring;
  try { await asyncFn(); } finally {
    btn.disabled = false;
    btn.textContent = labelAfter;
  }
}

/**
 * Vérifie la présence d'un texte et d'une clé IA. Retourne true si ok.
 */
function _requireTextAndKey() {
  if (!getDomVal('raw-input').trim()) {
    showToast(_t('toast_no_text'), 2500, 'error'); return false;
  }
  const provCfg = _getProviderConfig(_wtProvider);
  const key = (provCfg.key || _wtApiKey || '').trim();
  if (!key) {
    const provNames = { claude: 'Claude', openai: 'OpenAI', gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
    const pName = provNames[_wtProvider] || _wtProvider || '?';
    showToast(_t('toast_no_api_key').replace('{provider}', pName), 5000, 'error');
    return false;
  }
  return true;
}

/**
 * Rend des lignes IA (format "— **Titre**") en blocs HTML bordés.
 */
function renderAiLines(lines) {
  return lines
    .filter(l => l.trim())
    .map(l => {
      const clean = l.trim().replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      if (clean.startsWith('—') || clean.startsWith('-')) {
        return `<div style="margin-bottom:7px;padding-left:8px;border-left:2px solid var(--accent-light);">${clean.replace(/^[—\-]\s*/, '')}</div>`;
      }
      return `<div style="margin-bottom:4px;">${clean}</div>`;
    })
    .join('');
}

/** Bouton Fermer sous un bloc IA inline. */
function _aiCloseBtn(boxId) {
  return `<div style="text-align:right;margin-top:8px;">
    <button onclick="document.getElementById('${boxId}').style.display='none'"
      style="font-size:9.5px;background:none;border:none;cursor:pointer;color:var(--ink-muted);">✕ Fermer</button>
  </div>`;
}

/**
 * Branche API OpenAI-compatible partagée entre OpenAI et Groq.
 */
async function _callOpenAIcompat(url, key, system, user, model, tokens, label) {
  const isOpenRouter = url.includes('openrouter.ai');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + key,
  };
  if (isOpenRouter) {
    headers['HTTP-Referer'] = 'https://atelier-edition.local';
    headers['X-Title'] = 'Atelier Edition';
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model, max_tokens: tokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur API ${label} ` + res.status);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  // Modèles reasoning (DeepSeek, Qwen, GLM, Tencent…) : le raisonnement interne
  // peut apparaître dans content entre <think>…</think>, ou dans reasoning_content.
  // On préfère content s'il existe, mais on purge les balises <think>.
  let text = msg?.content
    || msg?.reasoning_content
    || msg?.reasoning
    || data.choices?.[0]?.text
    || null;
  if (text) {
    // Supprimer les blocs <think>…</think> (raisonnement interne visible)
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // Si après nettoyage le texte est vide, retomber sur reasoning_content
    if (!text) text = msg?.reasoning_content || msg?.reasoning || null;
    // Nettoyer les espaces en tête/queue résiduels
    if (text) text = text.trim();
  }
  if (!text) {
    const detail = JSON.stringify(data).slice(0, 300);
    throw new Error(`Réponse vide de ${label} — ${detail}`);
  }
  return text;
}

/**
 * Helper partagé addPerso / addLieu — génère un champ de saisie (input ou textarea).
 */
function _cardField(label, field, placeholder, value, multiline = false) {
  const baseStyle = `width:100%;font-size:11px;font-family:'DM Sans',sans-serif;border:1px solid var(--cream);border-radius:3px;background:var(--parchment);color:var(--ink);padding:3px 6px;outline:none;box-sizing:border-box;transition:border-color .12s;`;
  const focus = `onfocus="this.style.borderColor='var(--accent-light)'" onblur="this.style.borderColor='var(--cream)'"`;
  const el = multiline
    ? `<textarea data-field="${field}" rows="2" placeholder="${placeholder}" oninput="markUnsaved()" style="${baseStyle}resize:vertical;" ${focus}>${escHtml(value||'')}</textarea>`
    : `<input type="text" data-field="${field}" placeholder="${placeholder}" value="${escHtml(value||'')}" oninput="markUnsaved()" style="${baseStyle}height:26px;" ${focus}>`;
  return `<div style="margin-bottom:5px;"><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-muted);font-weight:600;margin-bottom:2px;">${label}</div>${el}</div>`;
}


// ── STATE ──────────────────────────────────────────────
const images = {};       // { name: { src, caption } }
let debounceTimer = null;

// ── ÉTAT PROJET ────────────────────────────────────────
let currentProject = {
  nom: '',
  dateCreation: '',
  derniereSauvegarde: null,
};
let _projectPendingAction = null; // 'new' | 'load'
let _hasUnsavedChanges = false;

function markUnsaved() {
  _hasUnsavedChanges = true;
  const dot = document.getElementById('save-dot');
  const lbl = document.getElementById('save-label');
  if (dot) { dot.classList.remove('saved'); dot.classList.add('unsaved'); }
  if (lbl && currentProject.nom) lbl.textContent = 'Non sauvegardé';
}

function markSaved() {
  _hasUnsavedChanges = false;
  const dot = document.getElementById('save-dot');
  const lbl = document.getElementById('save-label');
  if (dot) { dot.classList.remove('unsaved'); dot.classList.add('saved'); }
  if (lbl) lbl.textContent = 'Sauvegardé ' + new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}

function updateProjectBadge() {
  const badge = document.getElementById('project-badge');
  if (badge) badge.textContent = currentProject.nom ? 'Projet : ' + currentProject.nom : '';
}

