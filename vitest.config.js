import { defineConfig } from 'vitest/config';

// Config Vitest isolée : n'embarque PAS les plugins de build Vite (le plugin
// legacy-bundle ne doit pas tourner pendant les tests).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});
