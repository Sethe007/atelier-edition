# Guide i18n — ajouter / compléter une langue

## Système
- Catalogues : `src/i18n/<lang>.js` appellent `_registerLang('<lang>', { clé: 'valeur', … })`.
- Moteur : `src/i18n/index.js` (`_t`, `_nt`, `applyI18n`).
- **Repli automatique** : si une clé manque dans la langue courante → **anglais** → **français** → la clé brute.
  Donc une langue partiellement traduite reste utilisable (le reste s'affiche en anglais).
- Dans le HTML : `data-i18n="clé"` (texte), `data-i18n-title`, `data-i18n-placeholder`,
  `data-i18n-label`, `data-i18n-aria-label`. Dans le JS : `_t('clé')`.

## Ajouter une nouvelle langue (ex. russe `ru`)
1. `node scripts/i18n-tools.mjs --stubs` → génère `i18n-stubs/ru.js` avec **toutes** les
   clés, valeurs pré-remplies en anglais (base de travail).
2. Traduire la partie droite de chaque ligne dans `i18n-stubs/ru.js`.
3. Déposer le fichier dans `src/i18n/ru.js` et l'ajouter à l'ordre de chargement
   (voir `vite.config.js` / le bundle).
4. Ajouter l'option dans le sélecteur de langue (`index.html`, `<select id="ui-lang">`
   et la variante `sm-…`) : `<option value="ru">Русский</option>`.
5. `node scripts/i18n-tools.mjs` pour vérifier la couverture.

> Tant qu'une langue n'est pas traduite, **ne pas** l'ajouter au sélecteur en prod
> (elle s'afficherait en anglais). Les squelettes vivent dans `i18n-stubs/` en attendant.

## Vérifier la couverture
`node scripts/i18n-tools.mjs` liste, par langue, le nombre de clés couvertes / manquantes.
