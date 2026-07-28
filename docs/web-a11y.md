# Web Accessibility (a11y) & Angular ESLint

This document describes how the Caregiver Angular application is linted and how we keep the UI accessible.

## Quick commands

```bash
# Lint the web app (TS + HTML templates, including inline templates)
npm run lint --workspace @caregiver/web

# Build the web app and run an automated axe-core a11y audit
npm run build --workspace @caregiver/web
node scripts/audit-a11y.mjs
```

## Angular ESLint setup

The monorepo uses **ESLint 9 flat config**. The web app extends the root config and adds Angular-specific rules.

```bash
# Lint the whole monorepo
npm run lint

# Lint only the Angular web app
npm run lint --workspace @caregiver/web
```

### Root config (`eslint.config.js`)

- Applies `eslint:recommended`.
- Scopes `@typescript-eslint/recommended` rules to `**/*.ts`/`**/*.tsx` so they do not run against Angular HTML templates.
- Enforces `consistent-type-imports`, warns on `no-explicit-any`, and discourages stray `console` usage.

A pre-commit hook also runs [lint-staged](https://github.com/lint-staged/lint-staged) automatically via Husky (see `.husky/pre-commit`). lint-staged only lints and formats the files you are about to commit, making pre-commit checks much faster. The full `npm run lint` still runs in CI.

### Web app config (`apps/web/eslint.config.js`)

- Spreads the root config.
- Adds `@angular-eslint` recommended rules for TypeScript files.
- Enables the `extract-inline-html` processor so inline `template:` strings are linted as HTML.
- Adds `@angular-eslint/template` recommended **and accessibility** rules for `src/**/*.html` files (including the virtual HTML extracted from inline templates).

The enabled template accessibility rules include:

- `alt-text`
- `click-events-have-key-events`
- `elements-content`
- `interactive-supports-focus`
- `label-has-associated-control`
- `mouse-events-have-key-events`
- `no-autofocus`
- `no-distracting-elements`
- `role-has-required-aria`
- `table-scope`
- `valid-aria`

```js
// apps/web/eslint.config.js (simplified)
{
  files: ['src/**/*.html'],
  languageOptions: { parser: angularTemplateParser },
  plugins: { '@angular-eslint/template': angularTemplate },
  rules: {
    ...angularTemplate.configs.recommended.rules,
    ...angularTemplate.configs.accessibility.rules,
  },
}
```

### CI

`.github/workflows/ci.yml` runs both the root lint and the web-specific lint on every pull request:

```yaml
- name: Lint
  run: npm run lint
- name: Lint web app
  run: npm run lint --workspace @caregiver/web
```

## Accessibility conventions

When writing components, prefer native semantics and progressive enhancement.

### Prefer real interactive elements

Use a `<button type="button">` for clickable actions. If you ever find yourself adding `role="button"`, `tabindex="0"`, and keyboard handlers to a `<div>`, convert it to a `<button>` instead.

Example from `fhir-resource-list.component.ts`:

```html
<button
  type="button"
  class="resource-summary"
  [attr.aria-expanded]="expandedId() === resource.id"
  [attr.aria-controls]="expandedId() === resource.id ? 'resource-detail-' + resource.id : null"
  (click)="onToggle(resource.id)"
>
  ...
</button>
```

### Labels and form controls

- Every `<input>`, `<select>`, and `<textarea>` must have an associated `<label>` (via `for`/`id`).
- Do not rely on placeholders alone.
- Error text should be associated with the field using `aria-describedby` if you need to describe the error in detail.

### Expand/collapse widgets

- Use `aria-expanded` to communicate state.
- Use `aria-controls` to point to the controlled panel. Only add the attribute when the panel is in the DOM.
- Ensure the panel has a matching `id`.

```html
<!-- panelId should be unique, e.g. `resource-detail-${resource.id}` -->
<button [attr.aria-expanded]="isOpen()" [attr.aria-controls]="isOpen() ? panelId : null">
  Toggle
</button>

@if (isOpen()) {
<div [id]="panelId">...</div>
}
```

### Keyboard support

- Clickable elements must be focusable and operable with a keyboard.
- The Angular template accessibility rules catch many issues automatically (e.g., `click-events-have-key-events`, `interactive-supports-focus`).
- Use native buttons to avoid writing `keyup.enter`/`keyup.space` handlers.

### Images and media

- Provide meaningful `alt` text for informative images.
- Use empty `alt=""` for decorative images so screen readers skip them.
- Avoid autoplaying media without user control.

### Color and contrast

- Do not rely on color alone to convey meaning (combine with text or icons).
- Use sufficient contrast ratios for text and interactive elements.
- Use focus-visible outlines that are clearly visible.

### Semantic structure

- Use heading levels (`<h1>`–`<h6>`) in order without skipping.
- Prefer semantic elements (`<main>`, `<nav>`, `<section>`, `<article>`) over generic `<div>` containers.
- Ensure landmarks help users navigate the page.

### Avoid native event names for outputs

Angular output names that match DOM events (`submit`, `search`, `toggle`) cause confusion and trigger `@angular-eslint/no-output-native`. Rename outputs when needed:

```ts
readonly submitClaim = output<string>();
readonly toggleResource = output<string>();
readonly searchResources = output<FhirSearchCriteria>();
```

## Automated a11y audit

`scripts/audit-a11y.mjs` is a Playwright + axe-core script that:

1. Builds the web app.
2. Starts a tiny Node static server with SPA fallback.
3. Launches Chromium and runs `AxeBuilder` against `/login`.
4. Prints any violations grouped by impact and exits with code 1 if violations exist.

Current scope:

- Only the **login page** is audited automatically because it is public.
- Protected routes require authentication before auditing.

To add protected routes, log in via the API and reuse the authenticated `browser`/`context` in the script.

## References

- [Angular ESLint](https://github.com/angular-eslint/angular-eslint)
- [axe-core Playwright integration](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
