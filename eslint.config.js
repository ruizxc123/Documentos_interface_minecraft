import js from '@eslint/js';

const browserGlobals = {
  document: 'readonly',
  indexedDB: 'readonly',
  localStorage: 'readonly',
  Node: 'readonly',
  NodeFilter: 'readonly',
  requestAnimationFrame: 'readonly',
  ResizeObserver: 'readonly',
  window: 'readonly',
};

export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
  },
  {
    files: ['tests/**/*.js', 'tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
  },
];
