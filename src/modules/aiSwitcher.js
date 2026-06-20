/* ── AI Switcher — panneau déroulant header ── */
const AI_SW_META = {
  claude:      { icon: '✦', label: 'Claude',      short: 'Claude' },
  openai:      { icon: '⬡', label: 'OpenAI GPT',  short: 'GPT' },
  gemini:      { icon: '◈', label: 'Gemini',       short: 'Gemini' },
  groq:        { icon: '⚡', label: 'Groq',         short: 'Groq' },
  openrouter:  { icon: '⇄', label: 'OpenRouter',   short: 'Router' },
};

function _aiSwGetActiveProviders() {
  try {
    const cfg = JSON.parse(localStorage.getItem('ia_config') || '{}');
    const configs = cfg.configs || {};
    // Un provider est "actif" s'il a une clé API enregistrée
    // Exception Groq : gratuit, on l'inclut s'il est présent dans configs ou si c'est le provider actif
    const active = [];
    for (const [prov, provCfg] of Object.entries(configs)) {
      if ((provCfg.key && provCfg.key.trim()) || prov === 'groq') {
        active.push(prov);
      }
    }
    // Toujours ajouter le provider courant (même sans clé)
    const current = cfg.provider || 'claude';
    if (!active.includes(current)) active.unshift(current);
    return { active, current };
  } catch(e) {
    return { active: ['claude'], current: 'claude' };
  }
}

function _aiSwGetModelShort(prov) {
  try {
    const cfg = JSON.parse(localStorage.getItem('ia_config') || '{}');
    const model = cfg.configs?.[prov]?.model || '';
    if (!model) return '';
    // Raccourcir le nom du modèle
    return model.replace(/claude-/i,'').replace(/20\d\d\d\d\d\d/,'').replace(/gpt-/i,'').replace(/-preview.*$/,'').slice(0,22);
  } catch(e) { return ''; }
}

function _aiSwRenderMenu() {
  const list = document.getElementById('ai-sw-list');
  if (!list) return;
  const { active, current } = _aiSwGetActiveProviders();
  if (active.length === 0) {
    list.innerHTML = '<div class="ai-sw-empty">Aucune IA configurée.<br>Ajoutez une clé API dans les paramètres.</div>';
    return;
  }
  list.innerHTML = active.map(prov => {
    const meta = AI_SW_META[prov] || { icon: '●', label: prov, short: prov };
    const model = _aiSwGetModelShort(prov);
    const isActive = prov === current;
    return `<button class="ai-sw-item${isActive ? ' active' : ''}"
      onclick="aiSwSelectProvider('${prov}')">
      <span class="ai-sw-icon">${meta.icon}</span>
      <span class="ai-sw-info">
        <div class="ai-sw-name">${meta.label}</div>
        ${model ? `<div class="ai-sw-model">${model}</div>` : ''}
      </span>
    </button>`;
  }).join('');
}

function _aiSwUpdateBtn() {
  const { current } = _aiSwGetActiveProviders();
  const meta = AI_SW_META[current] || { icon: '✦', short: 'IA' };
  const label = document.getElementById('ai-sw-label');
  if (label) label.textContent = meta.icon + ' ' + meta.short;
}

function toggleAiSwitcher(e) {
  e.stopPropagation();
  const menu = document.getElementById('ai-switcher-menu');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  closeAiSwitcher();
  if (!isOpen) {
    _aiSwRenderMenu();
    menu.classList.add('open');
    // Fermer en cliquant ailleurs
    setTimeout(() => {
      document.addEventListener('click', _aiSwOutsideClick, { once: true });
    }, 10);
  }
}

function _aiSwOutsideClick(e) {
  const wrap = document.getElementById('ai-switcher-wrap');
  if (wrap && !wrap.contains(e.target)) closeAiSwitcher();
}

function closeAiSwitcher() {
  document.getElementById('ai-switcher-menu')?.classList.remove('open');
}

function aiSwSelectProvider(prov) {
  closeAiSwitcher();
  if (typeof setAiProvider === 'function') setAiProvider(prov);
  if (typeof updateSmProviderBtns === 'function') updateSmProviderBtns(prov);
  // Persister le choix
  try {
    const cfg = JSON.parse(localStorage.getItem('ia_config') || '{}');
    cfg.provider = prov;
    localStorage.setItem('ia_config', JSON.stringify(cfg));
  } catch(e) {}
  _aiSwUpdateBtn();
  if (typeof showToast === 'function') {
    const meta = AI_SW_META[prov] || { label: prov };
    showToast('IA active : ' + meta.label, 1800, 'ok');
  }
}

// Init au chargement
document.addEventListener('DOMContentLoaded', () => {
  _aiSwUpdateBtn();
  // Se re-sync après saveProviderConfig
  const orig = window.saveProviderConfig;
  if (typeof orig === 'function') {
    window.saveProviderConfig = function() {
      orig.apply(this, arguments);
      _aiSwUpdateBtn();
    };
  }
});

/* ── Toggle menu export ── */
function toggleExportMenu() {
  const menu = document.getElementById('export-menu');
  if (!menu) return;
  const open = menu.style.display === 'block';
  menu.style.display = open ? 'none' : 'block';
  if (!open) {
    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!document.getElementById('export-dropdown-wrap').contains(e.target)) {
          menu.style.display = 'none';
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 10);
  }
}
