/**
 * apps/web/karma.webpack.config.cjs
 *
 * Custom webpack config merged into the karma test build by the
 * `@angular-builders/custom-webpack:karma` builder (see angular.json).
 *
 * Why: the Angular CLI's webpack config never sets `resolve.extensionAlias`,
 * so `.js`-suffixed relative imports — which the app source uses everywhere
 * (e.g. `import ... from './auth.service.js'`) — cannot be resolved to their
 * `.ts` sources by the karma webpack build ("Module not found: Can't resolve
 * './foo.js'"). Mapping `.js` requests to `.ts`/`.tsx` first fixes that for
 * the app source AND for the workspace packages (@caregiver/rbac, @caregiver/ui)
 * whose entries re-export with `.js` suffixes.
 */
module.exports = (config) => {
  config.resolve = config.resolve ?? {};
  config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js', '.jsx'] };
  return config;
};
