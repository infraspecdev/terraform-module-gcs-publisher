const tsPlugin = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const js = require('@eslint/js')
const globals = require('globals')

/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
module.exports = [
  js.configs.recommended,
  {
    // Apply to all files
    files: ['**/*.ts', '**/*.js'],
    // Define globals that should be available
    languageOptions: {
      globals: {
        ...globals.node, // Node.js globals like process, require, etc.
        ...globals.jest, // Jest globals like describe, test, expect, etc.
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-console': 'off'
    }
  },
  {
    // TypeScript specific configuration
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module'
      }
    },
    rules: {
      // Disable the base rule and use the TypeScript one
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' }
      ],
      // Turn this off to match existing code style
      semi: 'off',
      quotes: ['error', 'single', { avoidEscape: true }],
      // Don't error on imports that might be mocked
      'no-import-assign': 'off',
      ...tsPlugin.configs.recommended.rules
    }
  }
]
