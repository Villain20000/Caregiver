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
      '@angular-eslint/template': angularTemplate,
    },
    processor: angularTemplate.processors['extract-inline-html'],
    rules: {
      ...angular.configs.recommended.rules,
      ...angularTemplate.configs['process-inline-templates'].rules,
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
    },
  },
];
