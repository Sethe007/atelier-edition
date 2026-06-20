document.addEventListener('DOMContentLoaded', function _dclSafetyNet() {
  // Ce listener s'exécute EN DERNIER (enregistré après tous les autres).
  // Toutes les fonctions JS sont garanties définies à ce point.

  // 1. loadIaModulesState — peut avoir échoué silencieusement dans le 1er DCL
  //    si _wtProvider ou AI_PROVIDERS n'était pas encore prêt.
  try {
    if (typeof loadIaModulesState === 'function') {
      loadIaModulesState(
        (typeof _wtProvider !== 'undefined' ? _wtProvider : null) || 'claude'
      );
    }
  } catch(e) { console.warn('[safetyNet] loadIaModulesState :', e); }

  // 2. _ANNOT.render — peut avoir échoué si _ANNOT n'était pas encore initialisé
  try {
    if (typeof _ANNOT !== 'undefined' && typeof _ANNOT.render === 'function') {
      _ANNOT.render();
    }
  } catch(e) { console.warn('[safetyNet] _ANNOT.render :', e); }

  // 3. Émettre atelier:ready si ce n'est pas déjà fait
  //    (guard via flag pour éviter double-émission si l'app l'émet elle-même)
  if (!window._atelierReadyFired) {
    window._atelierReadyFired = true;
    document.dispatchEvent(new CustomEvent('atelier:ready'));
  }
});
