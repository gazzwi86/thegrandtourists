import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import astro from 'eslint-plugin-astro'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'

export default [
  js.configs.recommended,
  // TypeScript files — include Node.js globals for config files (process, __dirname, etc.)
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: globals.node,
    },
  },
  ...astro.configs.recommended,
  // Astro files: use TypeScript parser for script blocks
  {
    files: ['**/*.astro'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
      globals: {
        PagefindUI: 'readonly',
      },
    },
  },
  {
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/anchor-has-content': 'error',
    },
  },
]
