// ── ACCORDÉONS SIDEBAR ─────────────────────────────────
function toggleAccordion(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.toggle('open');
  // Sync aria-expanded sur le bouton header
  const btn = el.querySelector('.sb-accordion-header');
  if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

// ══════════════════════════════════════════════════════════
// ── FICHE ŒUVRE & PERSONNAGES — Gestion et injection prompt
// ══════════════════════════════════════════════════════════

// ── Fiches personnages ────────────────────────────────────
let _persoCount = 0;

// ── Helpers partagés pour les fiches personnage ──────────
// _persoField est un alias de _cardField (helper partagé avec addLieu)
const _persoField = _cardField;

function _persoSection(icon, title, color, content, openByDefault = false) {
  const uid = 'ps-' + Math.random().toString(36).slice(2,8);
  return `
  <div style="border:1px solid var(--cream);border-radius:5px;margin-bottom:5px;overflow:hidden;">
    <div onclick="(function(el){
        const body = el.nextElementSibling;
        const arrow = el.querySelector('.ps-arrow');
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        arrow.style.transform = open ? '' : 'rotate(180deg)';
      })(this)"
      style="display:flex;align-items:center;gap:5px;padding:5px 8px;
        background:var(--parchment);cursor:pointer;user-select:none;
        border-bottom:1px solid ${openByDefault ? 'var(--cream)' : 'transparent'};
        transition:border-color .12s;"
      onmouseover="this.style.background='var(--paper)'"
      onmouseout="this.style.background='var(--parchment)'">
      <span style="font-size:11px;">${icon}</span>
      <span style="font-size:9px;font-weight:600;text-transform:uppercase;
        letter-spacing:.07em;color:${color};flex:1;">${title}</span>
      <span class="ps-arrow" style="font-size:8px;color:var(--ink-muted);
        transition:transform .18s;${openByDefault ? 'transform:rotate(180deg);' : ''}">▼</span>
    </div>
    <div style="padding:8px 8px 3px;display:${openByDefault ? 'block' : 'none'};">
      ${content}
    </div>
  </div>`;
}

function addPerso(data = {}) {
  _persoCount++;
  const id = 'perso-' + _persoCount;
  const list = document.getElementById('perso-list');
  if (!list) return;

  const card = document.createElement('div');
  card.id = id;
  card.style.cssText = `background:var(--paper);border:1px solid var(--cream);
    border-radius:6px;padding:8px 10px 6px;position:relative;`;

  // ── En-tête : nom + bouton supprimer ──────────────────
  const header = `
    <button onclick="removePerso('${id}')" title="${_t('btn_delete')}"
      style="position:absolute;top:5px;right:6px;background:none;border:none;cursor:pointer;
        font-size:13px;color:var(--ink-muted);line-height:1;padding:0;"
      onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='var(--ink-muted)'">✕</button>

    <div style="margin-bottom:7px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;
        color:var(--accent);font-weight:600;margin-bottom:3px;">${_t('perso_nom_label')}</div>
      <input type="text" placeholder="${_t('perso_nom_placeholder')}" data-field="nom"
        value="${escHtml(data.nom||'')}" oninput="markUnsaved()"
        style="width:100%;font-size:12.5px;font-family:'DM Sans',sans-serif;font-weight:600;
          border:1px solid var(--cream);border-radius:4px;background:var(--parchment);
          color:var(--ink);outline:none;padding:4px 8px;transition:border-color .12s;box-sizing:border-box;"
        onfocus="this.style.borderColor='var(--accent-light)'"
        onblur="this.style.borderColor='var(--cream)'">
    </div>`;

  // ── Section 1 : Identité ──────────────────────────────
  const s1 = _persoSection('🪪', _t('perso_s1_title'), 'var(--accent)',
    _persoField(_t('perso_role'), 'role_narratif', _t('perso_role_ph'), data.role_narratif || data.role || '') +
    _persoField(_t('perso_age'), 'age', _t('perso_age_ph'), data.age || '') +
    _persoField(_t('perso_origine'), 'origine', _t('perso_origine_ph'), data.origine || '') +
    _persoField(_t('perso_variantes'), 'variantes', _t('perso_variantes_ph'), data.variantes || '') +
    _persoField(_t('perso_physique'), 'physique', _t('perso_physique_ph'), data.physique || ''),
    true  // ouverte par défaut
  );

  // ── Section 2 : Parcours ─────────────────────────────
  const s2 = _persoSection('🧭', _t('perso_s2_title'), '#7c3aed',
    _persoField(_t('perso_blessure'), 'blessure', _t('perso_blessure_ph'), data.blessure || '', true) +
    _persoField(_t('perso_motivation'), 'motivation', _t('perso_motivation_ph'), data.motivation || '', true) +
    _persoField(_t('perso_reve'), 'reve', _t('perso_reve_ph'), data.reve || '', true)
  );

  // ── Section 3 : Psychologie ──────────────────────────
  const s3 = _persoSection('🧠', _t('perso_s3_title'), '#0369a1',
    _persoField(_t('perso_peurs'), 'peurs', _t('perso_peurs_ph'), data.peurs || '', true) +
    _persoField(_t('perso_obsessions'), 'obsessions', _t('perso_obsessions_ph'), data.obsessions || '', true) +
    _persoField(_t('perso_tabous'), 'tabous', _t('perso_tabous_ph'), data.tabous || '', true)
  );

  // ── Section 4 : Rôle dans l'intrigue ─────────────────
  const s4 = _persoSection('📖', _t('perso_s4_title'), '#065f46',
    _persoField(_t('perso_fonction'), 'fonction', _t('perso_fonction_ph'), data.fonction || '', true) +
    _persoField(_t('perso_arc'), 'arc', _t('perso_arc_ph'), data.arc || '', true) +
    _persoField(_t('perso_impact'), 'impact', _t('perso_impact_ph'), data.impact || '', true)
  );

  // ── Section 5 : Relations aux autres ─────────────────
  const s5 = _persoSection('🕸', _t('perso_s5_title'), '#92400e',
    _persoField(_t('perso_alliances'), 'alliances', _t('perso_alliances_ph'), data.alliances || '', true) +
    _persoField(_t('perso_tensions'), 'tensions', _t('perso_tensions_ph'), data.tensions || '', true) +
    _persoField(_t('perso_rapport_autorite'), 'rapport_autorite', _t('perso_rapport_autorite_ph'), data.rapport_autorite || '', true)
  );

  // ── Section 6 : Détails singuliers ───────────────────
  const s6 = _persoSection('✦', _t('perso_s6_title'), 'var(--gold)',
    _persoField(_t('perso_langage'), 'langage', _t('perso_langage_ph'), data.langage || '', true) +
    _persoField(_t('perso_souvenir'), 'souvenir', _t('perso_souvenir_ph'), data.souvenir || '', true) +
    _persoField(_t('perso_detail_sensoriel'), 'detail_sensoriel', _t('perso_detail_sensoriel_ph'), data.detail_sensoriel || '', true)
  );

  card.innerHTML = header + s1 + s2 + s3 + s4 + s5 + s6;
  list.appendChild(card);
  markUnsaved();
}

function removePerso(id) {
  const el = document.getElementById(id);
  if (el) { el.remove(); markUnsaved(); }
}

function getPersos() {
  const cards = document.querySelectorAll('#perso-list > div[id^="perso-"]');
  return [...cards].map(card => ({
    nom:              card.querySelector('[data-field="nom"]')?.value?.trim()              || '',
    variantes:        card.querySelector('[data-field="variantes"]')?.value?.trim()        || '',
    role_narratif:    card.querySelector('[data-field="role_narratif"]')?.value?.trim()    || '',
    age:              card.querySelector('[data-field="age"]')?.value?.trim()              || '',
    origine:          card.querySelector('[data-field="origine"]')?.value?.trim()          || '',
    physique:         card.querySelector('[data-field="physique"]')?.value?.trim()         || '',
    blessure:         card.querySelector('[data-field="blessure"]')?.value?.trim()         || '',
    motivation:       card.querySelector('[data-field="motivation"]')?.value?.trim()       || '',
    reve:             card.querySelector('[data-field="reve"]')?.value?.trim()             || '',
    peurs:            card.querySelector('[data-field="peurs"]')?.value?.trim()            || '',
    obsessions:       card.querySelector('[data-field="obsessions"]')?.value?.trim()       || '',
    tabous:           card.querySelector('[data-field="tabous"]')?.value?.trim()           || '',
    fonction:         card.querySelector('[data-field="fonction"]')?.value?.trim()         || '',
    arc:              card.querySelector('[data-field="arc"]')?.value?.trim()              || '',
    impact:           card.querySelector('[data-field="impact"]')?.value?.trim()           || '',
    alliances:        card.querySelector('[data-field="alliances"]')?.value?.trim()        || '',
    tensions:         card.querySelector('[data-field="tensions"]')?.value?.trim()         || '',
    rapport_autorite: card.querySelector('[data-field="rapport_autorite"]')?.value?.trim() || '',
    langage:          card.querySelector('[data-field="langage"]')?.value?.trim()          || '',
    souvenir:         card.querySelector('[data-field="souvenir"]')?.value?.trim()         || '',
    detail_sensoriel: card.querySelector('[data-field="detail_sensoriel"]')?.value?.trim() || '',
  })).filter(p => p.nom);
}

// ── Fiches Lieux ──────────────────────────────────────────
let _lieuCount = 0;

function addLieu(data = {}) {
  _lieuCount++;
  const id   = 'lieu-' + _lieuCount;
  const list = document.getElementById('lieu-list');
  if (!list) return;

  const TYPES = [
    { v: 'Continent',        l: '🌍 Continent' },
    { v: 'Pays / Royaume',   l: '⚜️ Pays / Royaume' },
    { v: 'Région',           l: '🗺 Région' },
    { v: 'Ville',            l: '🏙 Ville' },
    { v: 'Village',          l: '🏘 Village' },
    { v: 'Quartier',         l: '🏛 Quartier' },
    { v: 'Bâtiment',         l: '🏰 Bâtiment' },
    { v: 'Lieu naturel',     l: '🌲 Lieu naturel' },
    { v: 'Dimension / Plan', l: '✨ Dimension / Plan' },
    { v: 'Autre',            l: '📍 Autre' },
  ];
  const typeOptions = TYPES.map(t =>
    `<option value="${t.v}" ${data.type === t.v ? 'selected' : ''}>${t.l}</option>`
  ).join('');

  const fieldStyle = `width:100%;font-size:11px;font-family:'DM Sans',sans-serif;border:1px solid var(--cream);border-radius:3px;background:var(--parchment);color:var(--ink);padding:2px 4px;`;
  const lbl = (txt) => `<div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-muted);margin-bottom:2px;">${txt}</div>`;

  const card = document.createElement('div');
  card.id = id;
  card.style.cssText = 'background:var(--paper);border:1px solid var(--cream);border-radius:6px;padding:8px 10px;position:relative;';
  card.innerHTML = `
    <button onclick="removeLieu('${id}')" title="${_t('btn_delete')}"
      style="position:absolute;top:5px;right:6px;background:none;border:none;cursor:pointer;font-size:13px;color:var(--ink-muted);line-height:1;padding:0;"
      onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='var(--ink-muted)'">✕</button>

    <div style="margin-bottom:7px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--accent);font-weight:600;margin-bottom:3px;">${_t('lieu_nom_label')}</div>
      <input type="text" placeholder="${_t('lieu_nom_placeholder')}" data-field="nom"
        value="${escHtml(data.nom||'')}" oninput="markUnsaved()"
        style="width:100%;font-size:12.5px;font-family:'DM Sans',sans-serif;font-weight:600;border:1px solid var(--cream);border-radius:4px;background:var(--parchment);color:var(--ink);outline:none;padding:4px 8px;transition:border-color .12s;"
        onfocus="this.style.borderColor='var(--accent-light)'" onblur="this.style.borderColor='var(--cream)'">
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px;">
      <div>${lbl(_t('lieu_type_label'))}<select data-field="type" onchange="markUnsaved()" style="${fieldStyle}">${typeOptions}</select></div>
      <div>${_cardField(_t('lieu_parent_label'), 'parent', _t('lieu_parent_ph'), data.parent||'')}</div>
    </div>

    ${_cardField(_t('lieu_variantes_label'), 'variantes', _t('lieu_variantes_ph'), data.variantes||'')}
    ${_cardField(_t('lieu_peuples_label'), 'peuples', _t('lieu_peuples_ph'), data.peuples||'')}
    ${_cardField(_t('lieu_gouvernance_label'), 'gouvernance', _t('lieu_gouvernance_ph'), data.gouvernance||'')}
    ${_cardField(_t('lieu_notes_label'), 'notes', _t('lieu_notes_ph'), data.notes||'', true)}
  `;

  list.appendChild(card);
  markUnsaved();
}

function removeLieu(id) {
  const el = document.getElementById(id);
  if (el) { el.remove(); markUnsaved(); }
}

function getLieux() {
  const cards = document.querySelectorAll('#lieu-list > div[id^="lieu-"]');
  return [...cards].map(card => ({
    nom:         card.querySelector('[data-field="nom"]')?.value?.trim()         || '',
    type:        card.querySelector('[data-field="type"]')?.value?.trim()        || '',
    parent:      card.querySelector('[data-field="parent"]')?.value?.trim()      || '',
    variantes:   card.querySelector('[data-field="variantes"]')?.value?.trim()   || '',
    peuples:     card.querySelector('[data-field="peuples"]')?.value?.trim()     || '',
    gouvernance: card.querySelector('[data-field="gouvernance"]')?.value?.trim() || '',
    notes:       card.querySelector('[data-field="notes"]')?.value?.trim()       || '',
  })).filter(l => l.nom);
}

// ── Construction du contexte œuvre injecté dans le prompt ─
function buildOeuvreContext() {
  const type      = getDomVal('oeuvre-type');
  const genre     = getDomVal('oeuvre-genre');
  const epoque    = getDomVal('oeuvre-epoque');
  const monde     = getDomVal('oeuvre-monde');
  const narration = getDomVal('oeuvre-narration');
  const temps     = getDomVal('oeuvre-temps');
  const registre  = getDomVal('oeuvre-registre');
  const notes     = getDomVal('oeuvre-notes').trim();
  const persos    = getPersos();
  const lieux     = getLieux();

  const hasInfo = type || genre || epoque || monde || narration || temps || registre || notes || persos.length || lieux.length;
  if (!hasInfo) return '';

  let ctx = `\n\n═══ CONTEXTE DE L'ŒUVRE (à prendre en compte pour toute analyse) ═══\n`;

  if (type)      ctx += `• Type : ${type}\n`;
  if (genre)     ctx += `• Genre : ${genre}\n`;
  if (epoque)    ctx += `• Époque / Cadre temporel : ${epoque}\n`;
  if (monde)     ctx += `• Monde / Univers : ${monde}\n`;
  if (narration) ctx += `• Point de vue narratif : ${narration}\n`;
  if (temps)     ctx += `• Temps verbal principal : ${temps}\n`;
  if (registre)  ctx += `• Registre stylistique : ${registre}\n`;
  if (notes)     ctx += `• Notes de l'auteur : ${notes}\n`;

  if (persos.length) {
    ctx += `\nPersonnages (leurs noms et variantes ne sont JAMAIS des fautes — ne les signale JAMAIS) :\n`;
    persos.forEach(p => {
      if (!p.nom) return;
      let line = `  – ${p.nom}`;
      if (p.role_narratif || p.role) line += ` [${p.role_narratif || p.role}]`;
      if (p.age)            line += `, ${p.age}`;
      if (p.origine)        line += `, origine : ${p.origine}`;
      if (p.variantes)      line += ` — aussi appelé : ${p.variantes}`;
      if (p.langage)        line += ` — langage : ${p.langage}`;
      if (p.motivation)     line += ` — motivation : ${p.motivation}`;
      if (p.blessure)       line += ` — blessure : ${p.blessure}`;
      if (p.arc)            line += ` — arc : ${p.arc}`;
      ctx += line + '\n';
    });
  }

  if (lieux.length) {
    ctx += `\nLieux (leurs noms et variantes ne sont JAMAIS des fautes — ne les signale JAMAIS) :\n`;
    lieux.forEach(l => {
      if (!l.nom) return;
      let line = `  – ${l.nom}`;
      if (l.type)        line += ` [${l.type}]`;
      if (l.parent)      line += ` — dans : ${l.parent}`;
      if (l.variantes)   line += ` — aussi appelé : ${l.variantes}`;
      if (l.peuples)     line += ` — habitants : ${l.peuples}`;
      if (l.gouvernance) line += ` — gouvernance : ${l.gouvernance}`;
      ctx += line + '\n';
    });
  }

  ctx += `═══════════════════════════════════════════════════════\n`;
  return ctx;
}



// ── ZOOM APERÇU (4.2) ──────────────────────────────────
function setPreviewZoom(scale) {
  const container = document.getElementById('pages-container');
  if (!container) return;
  container.style.transform = 'scale(' + scale + ')';
  container.style.transformOrigin = 'top center';
  container.style.marginBottom = (scale < 1)
    ? '-' + Math.round(container.scrollHeight * (1 - scale)) + 'px'
    : '0';
}

// ── BOUTONS EXPORT DÉSACTIVÉS PENDANT GÉNÉRATION (4.6) ─
function setExportBusy(busy) {
  const btnWord = document.querySelector('button[onclick*="exportWord"]');
  const btnPDF  = document.querySelector('button[onclick*="printPDF"]');
  [btnWord, btnPDF].forEach(btn => {
    if (!btn) return;
    btn.disabled = busy;
    btn.style.opacity = busy ? '0.5' : '1';
    btn.style.cursor  = busy ? 'wait' : '';
  });
}

// ── INITIALISATION ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Appliquer le thème sauvegardé immédiatement
  applyTheme(getPref('ui_theme') || 'ardoise', false);
  updateStats();
  updateSubmitInfoBox();
  syncSidebarToFormat();
  renderImgList();

  loadApiKey();
  setTimeout(_initApiSection, 50); // init zone API rétractable après loadApiKey
  // Forcer la mise à jour des boutons IA après chargement complet de la config
  setTimeout(() => {
    loadIaModulesState(_wtProvider || 'claude');
    _updateApiDot();
    updateWtApiCompactLabel();
  }, 150);

  // 1.1 — Avertissement avant rechargement accidentel
  window.addEventListener('beforeunload', (e) => {
    if (_hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // 4.5 — Drag and drop d'images dans la sidebar
  const dropZone = document.querySelector('.img-drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const fakeEvent = { target: { files: [file], value: '' } };
        handleImageUpload(fakeEvent);
      }
    });
  }

  // Vérification du verrou de chapitre au clic/frappe dans le textarea
  const _taLock = document.getElementById('raw-input');
  if (_taLock) {
    _taLock.addEventListener('click', _updateEditorLockState);
    _taLock.addEventListener('keydown', (ev) => {
      _updateEditorLockState();
      if (_taLock.readOnly && !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
          'Home','End','PageUp','PageDown','Escape','c','a'].includes(ev.key) && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        showToast(_t('toast_chapter_locked'), 2500, 'error');
      }
    });
  }

  // Double-clic éditeur → recherche synonyme automatique
  // BUG FIX v3.1 :
  //   1. Appel switchSidebarToolTab('syn') au lieu de switchWtTab seul
  //      → ouvre le volet Outils ET bascule sur l'onglet Synonymes
  //   2. La sélection est capturée AVANT le setTimeout
  //      → évite la perte du selectionStart/End lors du changement de focus
  //   3. On appelle _runSynonymsForWord(word) avec le mot pré-capturé
  //      → runSynonyms() ne relit plus selectionStart (qui vaudrait 0 après focus change)
  //   4. Fallback setTimeout si _taLock était null à l'init
  let _dblClickTimer = null;
  const _attachDblClick = (el) => {
    el.addEventListener('dblclick', () => {
      // ① Capturer immédiatement, avant tout changement de focus
      const start = el.selectionStart;
      const end   = el.selectionEnd;
      if (end <= start) return;
      const word = el.value.slice(start, end).trim()
        .replace(/[^a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ''\u2019\-]/g, '');
      if (!word || word.length < 3) return;
      clearTimeout(_dblClickTimer);
      _dblClickTimer = setTimeout(() => {
        // ② Ouvrir le volet Outils ET activer l'onglet Synonymes
        switchSidebarToolTab('syn');
        // ③ Remplir le champ de recherche
        const searchEl = document.getElementById('wonef-search-input');
        if (searchEl) searchEl.value = word;
        // ④ Lancer la recherche avec le mot déjà capturé
        _runSynonymsForWord(word);
      }, 150);
    });
  };
  if (_taLock) _attachDblClick(_taLock);
  else {
    // Fallback si _taLock était null lors de l'init du bloc DOMContentLoaded
    setTimeout(() => {
      const ta = document.getElementById('raw-input');
      if (ta) _attachDblClick(ta);
    }, 800);
  }

  // Ouvrir la modale projet au démarrage
  openProjectModal();
});

// ── TAB → INDENTATION (2 espaces) ─────────────────────
// ── CTRL+B / CTRL+I → GRAS / ITALIQUE ────────────────
// ── BARRE DE STATUT ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const ta = getTA();
  if (!ta) return;

  // Tab → 2 espaces au lieu de changer le focus
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, end = ta.selectionEnd;
      if (e.shiftKey) {
        const sel        = ta.value.slice(s, end);
        const deindented = sel.replace(/^  /gm, '');
        taReplace(ta, s, end, deindented);
        ta.setSelectionRange(s, s + deindented.length);
      } else {
        taReplace(ta, s, end, '  ');
        ta.setSelectionRange(s + 2, s + 2);
      }
      onRawInput();
    }
  });

  // Mise à jour de la barre de statut au clic / frappe / sélection
  const updateStatusBar = () => {
    const val  = ta.value;
    const pos  = ta.selectionStart;
    const selLen = ta.selectionEnd - ta.selectionStart;
    const lines  = val.slice(0, pos).split('\n');
    const ln     = lines.length;
    const col    = lines[lines.length - 1].length + 1;

    document.getElementById('sb-line').textContent = ln;
    document.getElementById('sb-col').textContent  = col;

    const selWrap = document.getElementById('sb-sel-wrap');
    const selSep  = document.getElementById('sb-sel-sep');
    const selEl   = document.getElementById('sb-sel');
    if (selLen > 0) {
      // Compter les mots dans la sélection
      const selText = val.slice(ta.selectionStart, ta.selectionEnd);
      const wCount  = selText.trim() ? selText.trim().split(/\s+/).length : 0;
      const wLabel  = wCount > 1 ? _t('sb_words_plural') : _t('sb_words');
      selEl.textContent = wCount + ' ' + wLabel;
      // Masquer le label séparé (il est maintenant dans selEl)
      const selLabelEl = document.getElementById('sb-sel-label');
      if (selLabelEl) selLabelEl.style.display = 'none';
      selWrap.style.display = '';
      selSep.style.display  = '';
    } else {
      selWrap.style.display = 'none';
      selSep.style.display  = 'none';
    }
  };

  ta.addEventListener('keyup',   updateStatusBar);
  ta.addEventListener('click',   updateStatusBar);
  ta.addEventListener('mouseup', updateStatusBar);
  ta.addEventListener('select',  updateStatusBar);
});

// Fermer le badge de navigation surlignage si l'utilisateur clique manuellement dans l'éditeur
let _wthOccurrences = [];
document.addEventListener('DOMContentLoaded', () => {
  const ta = getTA();
  if (ta) ta.addEventListener('click', () => { if (_wthOccurrences && _wthOccurrences.length) wtHighlightClear(); });
});


// ── Helper : écriture dans le textarea compatible Ctrl+Z ─────────────────────
// BUG #1 FIX : setRangeText() + InputEvent en remplacement d'execCommand('insertText')
// qui est déprécié (MDN). setRangeText modifie la valeur de façon synchrone.
// L'InputEvent avec inputType:'insertText' est le signal standard pour déclencher
// l'historique undo natif (Chrome ≥ 94, Firefox ≥ 89, Safari ≥ 16.4).
// IMPORTANT : on ne dispatch PAS l'event sur le textarea pour éviter de
// déclencher oninput / onRawInput — les appelants s'en chargent eux-mêmes
// quand c'est nécessaire, exactement comme avec l'ancienne execCommand.
function taWrite(ta, newValue, selStart, selEnd) {
  ta.focus();
  try {
    ta.setRangeText(newValue, 0, ta.value.length, 'end');
    // Signal undo pour le navigateur — pas de bubbles pour ne pas déclencher oninput
    ta.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: newValue, bubbles: false }));
  } catch(e) {
    // Fallback ultime : affectation directe (Ctrl+Z indisponible dans ce cas)
    ta.value = newValue;
  }
  // Repositionner le curseur si demandé
  if (selStart !== undefined) {
    ta.setSelectionRange(selStart, selEnd !== undefined ? selEnd : selStart);
  }
}

// Version partielle : remplace uniquement la sélection [from, to] par text
function taReplace(ta, from, to, text) {
  ta.focus();
  try {
    ta.setRangeText(text, from, to, 'end');
    ta.setSelectionRange(from + text.length, from + text.length);
    // Signal undo pour le navigateur — pas de bubbles pour ne pas déclencher oninput
    ta.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: false }));
  } catch(e) {
    // Fallback ultime : reconstruction manuelle de la valeur
    ta.value = ta.value.slice(0, from) + text + ta.value.slice(to);
    ta.setSelectionRange(from + text.length, from + text.length);
  }
}
// ── WRAP SÉLECTION : gras / italique ─────────────────
function edWrap(before, after) {
  const ta = getTA();
  const s  = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e);
  // Toggle : si déjà wrappé, enlever les marqueurs
  if (sel.startsWith(before) && sel.endsWith(after) && sel.length > before.length + after.length) {
    const inner = sel.slice(before.length, sel.length - after.length);
    taReplace(ta, s, e, inner);
    ta.setSelectionRange(s, s + inner.length);
  } else {
    const wrapped = before + sel + after;
    taReplace(ta, s, e, wrapped);
    if (sel.length === 0) ta.setSelectionRange(s + before.length, s + before.length);
    else ta.setSelectionRange(s, s + wrapped.length);
  }
  onRawInput();
}

// ── RECHERCHER & REMPLACER ────────────────────────────
function esToggleReplace() {
  const row = document.getElementById('es-replace-row');
  const inp = document.getElementById('es-repl-input');
  row.classList.toggle('visible');
  if (row.classList.contains('visible')) {
    setTimeout(() => inp.focus(), 180);
  }
}

function esReplKeyNav(e) {
  if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? esReplaceAll() : esReplaceOne(); }
  if (e.key === 'Escape') { document.getElementById('es-replace-row').classList.remove('visible'); }
}

function esReplaceOne() {
  if (!_esMatches.length || _esCurrent < 0) return;
  const ta    = document.getElementById('raw-input');
  const repl  = document.getElementById('es-repl-input').value;
  const m     = _esMatches[_esCurrent];
  // Utiliser taReplace pour préserver l'historique Ctrl+Z
  taReplace(ta, m.start, m.end, repl);
  onRawInput();
  // Relancer la recherche et rester sur la même position
  setTimeout(() => {
    _esSearchNow();
    if (_esMatches.length) {
      const next = Math.min(_esCurrent, _esMatches.length - 1);
      _esCurrent = next;
      document.getElementById('es-count').textContent = `${_esCurrent + 1}/${_esMatches.length}`;
      esGoTo(_esCurrent);
    }
  }, 50);
}

function esReplaceAll() {
  const ta   = document.getElementById('raw-input');
  const q    = document.getElementById('es-input').value;
  const repl = document.getElementById('es-repl-input').value;
  if (!q) return;
  // BUG #4 FIX : la recherche _esSearchNow est insensible à la casse (toLowerCase).
  // On aligne esReplaceAll sur ce comportement en utilisant le flag 'gi'.
  // Si une future option case-sensitive est ajoutée, retirer le flag 'i' conditionnellement.
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = 'gi';
  const count = (ta.value.match(new RegExp(escaped, flags)) || []).length;
  if (!count) { showToast(_t('toast_no_occurrence'), 2000, 'error'); return; }
  const newVal = ta.value.replace(new RegExp(escaped, flags), repl);
  // Utiliser taWrite pour préserver l'historique Ctrl+Z
  taWrite(ta, newVal);
  onRawInput();
  esClear();
  const s = count > 1 ? 's' : '';
  showToast(_t('toast_replacements_done').replace('{n}', count).replace(/\{s\}/g, s), 2500, 'ok');
}

// Raccourci clavier Ctrl+S / Cmd+S pour sauvegarder
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    if (document.activeElement === document.getElementById('raw-input')) {
      e.preventDefault(); edWrap('**', '**');
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    if (document.activeElement === document.getElementById('raw-input')) {
      e.preventDefault(); edWrap('*', '*');
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
    if (document.activeElement === document.getElementById('raw-input')) {
      e.preventDefault(); edWrap('__', '__');
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'x') {
    if (document.activeElement === document.getElementById('raw-input')) {
      e.preventDefault(); edWrap('~~', '~~');
    }
  }
});

// ── OUTILS D'ÉCRITURE ──────────────────────────────────
