/**
 * apps/web/eslint.config.js
 *
 * Angular ESLint flat config for the web app.
 *
 * Extends the monorepo root ESLint config and adds Angular-specific rules for
 * TypeScript source files and HTML templates (including inline templates inside
 * components metadata).
 */
import rootConfig from '../../eslint.config.js';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import angularTemplateParser from '@angular-eslint/template-parser';

export default [
  ...rootConfig,

  // ----------------------------------------------------------------------
  // Angular TypeScript files.
  // Applies the @angular-eslint recommended rules and enables inline-template
  // extraction so templates defined in `template:` properties are linted too.
  // The extracted virtual HTML files are then matched by the `**/*.html`
  // block below, so only Angular template rules run against them.
  // ----------------------------------------------------------------------
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.app.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@angular-eslint': angular,
    },
    processor: angularTemplate.processors['extract-inline-html'],
    rules: {
      ...angular.configs.recommended.rules,
    },
  },

  // ----------------------------------------------------------------------
  // Angular spec files.
  // Spec files are excluded from tsconfig.app.json, so type-aware linting
  // must use tsconfig.spec.json (which includes jasmine ambient types).
  // ----------------------------------------------------------------------
  {
    files: ['src/**/*.spec.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.spec.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // Jasmine globals available at runtime in Karma (from @types/jasmine).
        describe: 'readonly',
        xdescribe: 'readonly',
        fdescribe: 'readonly',
        it: 'readonly',
        xit: 'readonly',
        fit: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        expect: 'readonly',
        spyOn: 'readonly',
        fail: 'readonly',
        jasmine: 'readonly',
      },
    },
    plugins: {
      '@angular-eslint': angular,
    },
  },

  // ----------------------------------------------------------------------
  // Angular HTML templates files.
  // ----------------------------------------------------------------------
  {
    files: ['src/**/*.html'],
    languageOptions: {
      parser: angularTemplateParser,
    },
    plugins: {
      '@angular-eslint/template': angularTemplate,
    },
    rules: {
      ...angularTemplate.configs.recommended.rules,
      ...angularTemplate.configs.accessibility.rules,
    },
  },
];
