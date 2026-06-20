# Atelier Édition

> Éditeur littéraire professionnel — mise en page, correction IA, export Word/PDF/Markdown.

## Stack technique

- **Vite** — bundler/dev server, zéro config, HMR
- **Vanilla JS** — modules legacy injectés proprement par un plugin Vite
- **CSS** — variables custom, thèmes dynamiques, dark mode
- **docx.js** — génération Word côté navigateur (pas de serveur)

---

## Démarrage rapide

```bash
npm install       # Dépendances
npm run dev       # Dev server → http://localhost:5173
npm run build     # Build de production → /dist
npm run preview   # Prévisualiser le build
```

---

## Architecture

```
atelier-edition/
├── index.html                          # Shell HTML (DOM uniquement)
├── vite.config.js                      # Vite + plugin d'injection legacy
├── vercel.json                         # Cache long-terme + headers sécurité
├── .github/workflows/deploy.yml        # CI/CD GitHub Actions
│
├── public/
│   └── favicon.svg
│
└── src/
    ├── main.js                         # Entrée Vite (CSS uniquement)
    │
    ├── styles/
    │   ├── base.css                    # Tokens, layout, composants (5 474 l.)
    │   ├── v3-redesign.css             # Refonte neumorphique v3 (2 167 l.)
    │   └── darkmode.css                # Surcharges dark mode (964 l.)
    │
    ├── i18n/                           # ── Internationalisation ──
    │   ├── index.js      495 l.        # Moteur : _registerLang, _t, applyI18n
    │   ├── fr.js         630 l.        # Catalogue français  (554 clés)
    │   ├── en.js         661 l.        # Catalogue anglais   (554 clés)
    │   └── es.js         661 l.        # Catalogue espagnol  (554 clés)
    │
    ├── prompts/                        # ── Prompts IA ──
    │   ├── index.js      233 l.        # Registre : _registerPrompt, getPrompt
    │   ├── correcteur.js  39 l.        # Prompt correcteur de manuscrit
    │   ├── style.js       28 l.        # Prompt analyse de style
    │   ├── stats.js       53 l.        # Prompts stats_map + stats_reduce
    │   ├── rapport.js     35 l.        # Prompt rapport éditorial
    │   ├── suggestions.js 63 l.        # Prompts reformulation (4 types)
    │   └── summaries.js   61 l.        # Prompts résumés de chapitres (3 types)
    │
    ├── lib/
    │   └── docx-bundle.js              # Lib docx.js (tierce partie, 20 116 l.)
    │
    └── modules/                        # ── Modules applicatifs ──
        ├── core.js           260 l.    # Constantes, helpers, state
        ├── project.js        137 l.    # Modal projet, onboarding
        ├── storage.js        287 l.    # Sauvegarde / chargement JSON
        ├── editor.js         312 l.    # Vues, input, formatage
        ├── pagination.js     725 l.    # Surlignage, moteur pagination
        ├── sidebar.js        649 l.    # Chapitres, typo params, images
        ├── export.js       1 036 l.    # PDF + DOCX
        ├── characters.js     641 l.    # Fiches personnages / lieux
        ├── editor-ui.js      536 l.    # Tabs, raccourcis, config IA
        ├── ai-engine.js    2 052 l.    # IA unifiée, correcteur, LanguageTool
        ├── i18n-tools.js   1 828 l.    # Style engine, synonymes, éditeur inline
        ├── app-shell.js    1 807 l.    # Autosave, dark mode, focus, notes, goals
        ├── writingTools.js   543 l.    # Correcteur UI, stats, onglets outils
        ├── corkAndPreview.js 4 976 l.  # Liège, aperçu, versions, annotations
        ├── aiSwitcher.js     142 l.    # Sélecteur fournisseur IA (header)
        ├── isolatedMode.js   666 l.    # Mode isolé chapitres (onglets)
        └── safetyNet.js       28 l.    # Filet DOMContentLoaded (chargé en dernier)
```

---

## Ajouter une langue

1. Dupliquer `src/i18n/fr.js` → `src/i18n/de.js`
2. Traduire chaque valeur (ne pas changer les clés)
3. L'enregistrer : changer `_registerLang('fr', {` → `_registerLang('de', {`
4. Ajouter le code dans `LANGUE_LABELS` de `src/i18n/index.js`
5. Référencer `src/i18n/de.js` dans le tableau `LEGACY_MODULES` de `vite.config.js`

## Modifier un prompt IA

Chaque prompt est isolé dans `src/prompts/` :
- Ouvrir le fichier correspondant (ex: `src/prompts/correcteur.js`)
- Modifier la valeur de `text:` dans `_registerPrompt('correcteur', { ... })`
- Le changement est actif au prochain `npm run dev`

---

## Déploiement Vercel

```bash
git init && git add . && git commit -m "Initial release"
git remote add origin https://github.com/TON_USER/atelier-edition.git
git push -u origin main
# → vercel.com : New Project → importer le repo (Vite auto-détecté)
```

---

*Atelier Édition — Forgé pour les écrivains.*
