// ── REGISTRE & MOTEUR DES PROMPTS IA — ATELIER ÉDITION ───────────────────────
//
// Architecture :
//   src/prompts/index.js    ← ce fichier — registre + CRUD + UI pane
//   src/prompts/correcteur.js
//   src/prompts/style.js
//   src/prompts/stats.js
//   src/prompts/rapport.js
//   src/prompts/suggestions.js
//   src/prompts/summaries.js
//
// Chaque fichier prompt appelle _registerPrompt(key, def) pour s'enregistrer.
// Cela reconstruit dynamiquement DEFAULT_PROMPTS sans tout centraliser ici.
//
// API publique :
//   getPrompt(key)          → texte courant (custom ou défaut)
//   resolvePrompt(key)      → texte avec {contexte_oeuvre} injecté
//   savePrompts()           → persiste dans localStorage
//   loadCustomPrompts()     → charge depuis localStorage
//   collectPrompts()        → snapshot objet {key: text} pour export projet
//   applyProjectPrompts(d)  → restaure les prompts d'un projet chargé
// ─────────────────────────────────────────────────────────────────────────────

const PROMPTS_STORAGE_KEY = 'atelier_custom_prompts';

/**
 * Catalogue des prompts — reconstruit dynamiquement par les fichiers
 * correcteur.js / style.js / stats.js / rapport.js / suggestions.js / summaries.js
 * via _registerPrompt(). Ne pas modifier directement.
 */
const DEFAULT_PROMPTS = {};

/**
 * Enregistre un prompt dans DEFAULT_PROMPTS.
 * Appelé par chaque fichier src/prompts/*.js.
 *
 * @param {string} key   Identifiant unique du prompt (ex: 'correcteur')
 * @param {Object} def   { label, icon, desc, text }
 */
function _registerPrompt(key, def) {
  DEFAULT_PROMPTS[key] = def;
}

// ── Cache mémoire des prompts courants ─────────────────────
let _customPrompts = null;

/** Charge les prompts depuis localStorage, fusionne avec les défauts */
function loadCustomPrompts() {
  if (_customPrompts) return _customPrompts;
  try {
    const raw = localStorage.getItem(PROMPTS_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    _customPrompts = {};
    Object.keys(DEFAULT_PROMPTS).forEach(key => {
      _customPrompts[key] = (saved[key] !== undefined) ? saved[key] : DEFAULT_PROMPTS[key].text;
    });
  } catch(e) {
    _customPrompts = {};
    Object.keys(DEFAULT_PROMPTS).forEach(key => { _customPrompts[key] = DEFAULT_PROMPTS[key].text; });
  }
  return _customPrompts;
}

/** Retourne le prompt actif pour une clé donnée */
function getPrompt(key) {
  const prompts = loadCustomPrompts();
  return prompts[key] || DEFAULT_PROMPTS[key]?.text || '';
}

/** Injecte le contexte œuvre dans un prompt (remplace {contexte_oeuvre} ou l'ajoute en 2e ligne) */
function resolvePrompt(key) {
  let text = getPrompt(key);
  const ctx = buildOeuvreContext();
  if (text.includes('{contexte_oeuvre}')) {
    text = text.replace('{contexte_oeuvre}', ctx);
  } else if (ctx) {
    // N'injecter que si le contexte n'est pas vide — sinon on insère une ligne blanche parasite
    const lines = text.split('\n');
    lines.splice(1, 0, ctx);
    text = lines.join('\n');
  }
  return text;
}

/** Sauvegarde les prompts dans localStorage et dans le projet courant */
function savePrompts() {
  const prompts = {};
  Object.keys(DEFAULT_PROMPTS).forEach(key => {
    const ta = document.getElementById('prompt-ta-' + key);
    if (ta) prompts[key] = ta.value;
    else prompts[key] = getPrompt(key);
  });
  _customPrompts = prompts;
  try { localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts)); } catch(e) {}
  // Mettre à jour les badges
  _refreshPromptBadges();
  showToast('Prompts enregistrés ✓', 2200, 'ok');
}

/** Réinitialise un prompt unique à sa valeur par défaut */
function resetPromptToDefault(key) {
  const ta = document.getElementById('prompt-ta-' + key);
  if (ta) {
    ta.value = DEFAULT_PROMPTS[key].text;
    _updatePromptCharCount(key);
    _updatePromptBadge(key, false);
  }
}

/** Réinitialise TOUS les prompts */
function resetAllPromptsToDefault() {
  if (!confirm('Remettre tous les prompts aux valeurs par défaut ?')) return;
  Object.keys(DEFAULT_PROMPTS).forEach(key => resetPromptToDefault(key));
  showToast('Tous les prompts réinitialisés ✓', 2200, 'ok');
}

/** Construit l'accordéon des prompts dans le pane */
function buildPromptsPane() {
  const container = document.getElementById('prompts-accordion');
  if (!container) return;
  container.innerHTML = '';
  const prompts = loadCustomPrompts();

  Object.entries(DEFAULT_PROMPTS).forEach(([key, def]) => {
    const current = prompts[key] ?? def.text;
    const isModified = current.trim() !== def.text.trim();

    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.id = 'prompt-card-' + key;
    card.innerHTML = `
      <div class="prompt-card-header" onclick="togglePromptCard('${key}')">
        <div class="prompt-card-header-left">
          <span class="prompt-card-icon">${def.icon}</span>
          <span class="prompt-card-title">${def.label}</span>
          <span class="prompt-card-badge${isModified ? ' modified' : ''}" id="prompt-badge-${key}">${isModified ? '✎ modifié' : 'défaut'}</span>
        </div>
        <span class="prompt-card-chevron">▶</span>
      </div>
      <div class="prompt-card-body">
        <div class="prompt-card-desc">${def.desc}</div>
        <textarea class="prompt-textarea" id="prompt-ta-${key}" rows="8" spellcheck="false"
          oninput="_updatePromptCharCount('${key}');_markPromptModified('${key}')"
        >${escHtml(current)}</textarea>
        <div class="prompt-card-actions">
          <button class="prompt-reset-btn" onclick="resetPromptToDefault('${key}')">↺ Défaut</button>
          <span class="prompt-charcount" id="prompt-cc-${key}">${current.length} car.</span>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

function togglePromptCard(key) {
  const card = document.getElementById('prompt-card-' + key);
  if (card) card.classList.toggle('open');
}

function _updatePromptCharCount(key) {
  const ta = document.getElementById('prompt-ta-' + key);
  const cc = document.getElementById('prompt-cc-' + key);
  if (ta && cc) cc.textContent = ta.value.length + ' car.';
}

function _markPromptModified(key) {
  const ta = document.getElementById('prompt-ta-' + key);
  if (!ta) return;
  const isModified = ta.value.trim() !== DEFAULT_PROMPTS[key]?.text.trim();
  _updatePromptBadge(key, isModified);
}

function _updatePromptBadge(key, isModified) {
  const badge = document.getElementById('prompt-badge-' + key);
  if (!badge) return;
  badge.textContent = isModified ? '✎ modifié' : 'défaut';
  badge.className = 'prompt-card-badge' + (isModified ? ' modified' : '');
}

function _refreshPromptBadges() {
  Object.keys(DEFAULT_PROMPTS).forEach(key => {
    const ta = document.getElementById('prompt-ta-' + key);
    if (!ta) return;
    _updatePromptBadge(key, ta.value.trim() !== DEFAULT_PROMPTS[key].text.trim());
  });
}

/** Charge les prompts depuis un objet projet (appelé dans applyProjectData) */
function applyProjectPrompts(promptsData) {
  if (!promptsData || typeof promptsData !== 'object') return;
  _customPrompts = {};
  Object.keys(DEFAULT_PROMPTS).forEach(key => {
    _customPrompts[key] = (promptsData[key] !== undefined) ? promptsData[key] : DEFAULT_PROMPTS[key].text;
  });
  try { localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(_customPrompts)); } catch(e) {}
}

/** Exporte les prompts pour la sauvegarde projet */
function collectPrompts() {
  const prompts = loadCustomPrompts();
  // Sauvegarder uniquement les prompts modifiés (les défauts seront rechargés automatiquement)
  const out = {};
  Object.keys(DEFAULT_PROMPTS).forEach(key => {
    out[key] = prompts[key] ?? DEFAULT_PROMPTS[key].text;
  });
  return out;
}

// ── Remplace _aiSugBtn et wtStyleSuggest par le nouveau flux ─
function _aiSugBtn(type, payloadJson) {
  // Stocker le payload en data-attribute (évite les guillemets qui cassent onclick)
  const safePayload = payloadJson.replace(/"/g, '&quot;');
  const lang = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
  const label = (typeof _i18n !== 'undefined' && _i18n[lang]?.ai_sub_btn) ? _i18n[lang].ai_sub_btn : '✦ Proposition de substitution';
  return `<button
    data-style-ai="${type}"
    data-ia-payload="${safePayload}"
    onclick="event.stopPropagation();iaPropOpen(this,'${type}')"
    style="margin-top:7px;font-size:11px;font-family:'DM Sans',sans-serif;padding:4px 13px;
      border-radius:10px;border:1px solid var(--accent-light);background:transparent;
      color:var(--accent);cursor:pointer;transition:all .12s;display:inline-block;"
    onmouseover="this.style.background='var(--accent)';this.style.color='#fff'"
    onmouseout="this.style.background='transparent';this.style.color='var(--accent)'"
  >${label}</button>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// Langues supportées : fr (Français), en (English), es (Español)
// Chaque clé correspond à un attribut data-i18n dans le HTML.
// data-i18n        → textContent
// data-i18n-title  → title attribute
// data-i18n-placeholder → placeholder attribute

