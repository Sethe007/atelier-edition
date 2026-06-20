// ── MODAL PROJET ───────────────────────────────────────
function openProjectModal() {
  // Reset état de la modale
  _projectPendingAction = null;
  document.getElementById('project-name-area').classList.remove('visible');
  document.getElementById('project-confirm-btn').style.display = 'none';
  document.getElementById('project-skip-btn').style.display = 'inline-block';
  document.getElementById('project-name-input').value = '';
  const _pm_o = document.getElementById('project-modal');
  _pm_o.classList.add('open');
  _pm_o.removeAttribute('inert');
}

function skipProjectModal() {
  const _pm_c = document.getElementById('project-modal');
  _pm_c.classList.remove('open');
  _pm_c.setAttribute('inert', '');
}

function chooseNew() {
  _projectPendingAction = 'new';
  document.getElementById('project-name-area').classList.add('visible');
  document.getElementById('project-confirm-btn').style.display = 'inline-block';
  document.getElementById('project-confirm-btn').textContent = 'Créer le projet';
  document.getElementById('project-skip-btn').style.display = 'inline-block';
  document.getElementById('project-name-input').focus();
}

function chooseLoad() {
  document.getElementById('project-load-input').click();
}

function confirmProjectChoice() {
  if (_projectPendingAction === 'new') {
    // Lire le nom saisi — était indéfini (ReferenceError) avant ce correctif
    const nom = (document.getElementById('project-name-input')?.value || '').trim() || 'Sans titre';
    // Réinitialiser le projet
    setDomVal('raw-input', '');
    Object.keys(images).forEach(k => delete images[k]);
    // Réinitialiser les paramètres par défaut
    setDomVal('font-size', '12');
    setDomVal('line-height', '1.75');
    setDomVal('indent-size', '1.5em');
    setDomVal('page-format', 'A4');
    setDomVal('folio-start', '1');
    // Vider la page de garde et le header courant
    ['pg-titre','pg-auteur','pg-soustitre','pg-genre','header-courant'].forEach(id => setDomVal(id, ''));
    // Vider la fiche œuvre
    ['oeuvre-type','oeuvre-genre','oeuvre-epoque','oeuvre-monde','oeuvre-narration','oeuvre-temps','oeuvre-registre','oeuvre-notes'].forEach(id => setDomVal(id, ''));
    // Vider les fiches personnages et lieux
    const persoList = document.getElementById('perso-list');
    if (persoList) persoList.innerHTML = '';
    _persoCount = 0;
    const lieuList = document.getElementById('lieu-list');
    if (lieuList) lieuList.innerHTML = '';
    _lieuCount = 0;
    // Réinitialiser les métadonnées chapitre
    _chapterMeta = {};
    paginateNodes([], []);
    updateStats();
    updateSubmitInfoBox();
    renderImgList();
    currentProject = { nom, dateCreation: new Date().toISOString(), derniereSauvegarde: null };
    updateProjectBadge();
    document.getElementById('save-dot').classList.remove('saved','unsaved');
    document.getElementById('save-label').textContent = 'Nouveau projet';
    const _pm_c = document.getElementById('project-modal');
  _pm_c.classList.remove('open');
  _pm_c.setAttribute('inert', '');
    showToast(_t('toast_project_created').replace('{nom}', nom));
    _hasUnsavedChanges = false;
    _wgStartWords = 0;
    _lastGoalPct  = 0;
    updateWordGoal();
    updateDailyWordGoal();
    // ── Redirection vers la fiche auteur/œuvre ──────────────────────────
    // On ouvre les paramètres sur l'onglet Œuvre pour inviter l'auteur
    // à renseigner sa fiche. Un bouton "Passer" est affiché temporairement.
    setTimeout(() => {
      _onboardingMode = true;
      openSettingsModal('oeuvre');
      _showOnboardingSkip();
    }, 350);
  } else {
    // Aucune action sélectionnée — guider l'utilisateur
    document.getElementById('project-name-input')?.focus();
  }
}

// ── ONBOARDING NOUVEAU PROJET ──────────────────────────
let _onboardingMode = false;

function _showOnboardingSkip() {
  // Injecter une bannière d'invitation en haut de la modal paramètres
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  if (modal.querySelector('#onboarding-banner')) return; // déjà présent
  const banner = document.createElement('div');
  banner.id = 'onboarding-banner';
  banner.style.cssText = [
    'position:sticky;top:0;z-index:10;',
    'display:flex;align-items:center;justify-content:space-between;gap:12px;',
    'background:var(--accent);color:#fff;',
    'padding:10px 20px;font-family:\'DM Sans\',sans-serif;font-size:13px;',
    'border-bottom:1px solid rgba(0,0,0,0.15);',
  ].join('');
  banner.innerHTML = `
    <span style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:16px;">✍️</span>
      <span>Prenez un moment pour renseigner votre fiche auteur et œuvre — cela enrichit l'IA et personalise votre export.</span>
    </span>
    <button onclick="_skipOnboarding()" style="
      flex-shrink:0;padding:5px 14px;border-radius:5px;border:1px solid rgba(255,255,255,0.5);
      background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;font-size:12px;
      font-family:'DM Sans',sans-serif;transition:background 0.12s;white-space:nowrap;
    " onmouseover="this.style.background='rgba(255,255,255,0.28)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
      Passer pour l'instant →
    </button>`;
  // Insérer avant le premier enfant de la modal
  const box = modal.querySelector('.settings-modal-box') || modal.firstElementChild;
  if (box) box.insertBefore(banner, box.firstChild);
}

function _skipOnboarding() {
  _onboardingMode = false;
  const banner = document.getElementById('onboarding-banner');
  if (banner) banner.remove();
  closeSettingsModal();
  showToast('Vous pourrez renseigner la fiche à tout moment via ⚙ Paramètres.', 2800, 'info');
}

function _hideOnboardingSkip() {
  _onboardingMode = false;
  const banner = document.getElementById('onboarding-banner');
  if (banner) banner.remove();
}

