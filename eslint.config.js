/**
 * eslint.config.js — flat config for the entire Caregiver monorepo.
 *
 * Replaces the legacy .eslintrc.cjs. ESLint 9 requires the flat config format.
 *
 * Key rules (carried over from .eslintrc.cjs):
 *   - @typescript-eslint/recommended as the baseline
 *   - consistent-type-imports with inline type imports (matches TS 5.x `import type`)
 *   - no-unused-vars with _-prefixed exception for intentionally unused params
 *   - no-explicit-any as a warning (FHIR resources occasionally need `any` during migration)
 *   - no-console warns (use pino logger in services, NestJS Logger in API)
 */
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  // ----------------------------------------------------------------------
  // Global ignores — patterns ESLint should never lint.
  // (In flat config, node_modules is NOT ignored by default.)
  // ----------------------------------------------------------------------
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.angular/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.tsbuildinfo',
      // Generated declaration files inside packages.
      '**/dist/**/*.d.ts',
    ],
  },

  // ----------------------------------------------------------------------
  // Base: eslint:recommended for all files.
  // ----------------------------------------------------------------------
  js.configs.recommended,

  // ----------------------------------------------------------------------
  // TypeScript: @typescript-eslint/recommended (flat variant).
  // This array sets up the plugin + parser and applies recommended rules
  // to **/*.ts (and variants). We explicitly scope each block to TS files so
  // that generated Angular template files (e.g. inline HTML) are not linted
  // by TypeScript-specific rules.
  // ----------------------------------------------------------------------
  ...tseslint.configs['flat/recommended'].map((config) => ({
    ...config,
    files: config.files ?? ['**/*.ts', '**/*.tsx'],
  })),

  // ----------------------------------------------------------------------
  // TypeScript-specific language options & custom rules for all TS files.
  // ----------------------------------------------------------------------
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.base.json'],
      },
      globals: {
        // Node + browser + ES2022 globals (replaces legacy `env` setting).
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
      },
    },
    rules: {
      // Allow unused params/args that are prefixed with underscore (intentional).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // `any` is a warning, not an error — FHIR migration may require temporary `any`.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Enforce `import type { Foo }` for type-only imports (TS 5.x verbatimModuleSyntax friendly).
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Discourage console.log in production code — use structured loggers.
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  // ----------------------------------------------------------------------
  // Prettier — disables ESLint rules that conflict with Prettier formatting.
  // Must come last so it overrides earlier rule sets.
  // ----------------------------------------------------------------------
  prettier,
];
