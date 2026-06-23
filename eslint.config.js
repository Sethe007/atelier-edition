import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Config volontairement tolérante : l'app repose massivement sur des fonctions
 * GLOBALES partagées entre fichiers (pattern historique). On désactive donc
 * `no-undef`, et on garde les vrais signaux (variables inutilisées, etc.) en
 * warnings pour ne pas bloquer. À durcir progressivement avec la migration ESM.
 */
export default [
  {
    ignores: [
      'dist/**',
      'public/legacy-bundle.js', // artefact concaténé à la main (source réelle = src/modules/)
      'public/vendor/**',        // libs vendorées (DOMPurify…)
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'warn',
      'no-empty': 'warn',
      'no-constant-condition': ['warn', { checkLoops: false }],
    },
  },
  prettier,
];
