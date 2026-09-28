import { fileURLToPath } from 'node:url';

import type { Linter } from 'eslint';
import { defineConfig } from 'eslint/config';
import { angular, angularTemplate, playwright, rxjs } from 'lint-suite/eslint';

import baseConfig from '../../eslint.config.ts';

// Absolute, because the rule resolves `globalStyles` against the lint cwd (repo root for `pnpm lint`, the app for `nx lint`).
const GLOBAL_STYLES = fileURLToPath(new URL('src/styles.scss', import.meta.url));

/** Playwright specs that route the API are `*.test.ts`; lint-suite gives Playwright rules to `*.e2e.ts` only. */
const ROUTED_E2E_SPECS = ['e2e/**/*.test.ts'];

const forRoutedSpecs = (config: Linter.Config): Linter.Config => {
  const routedConfig: Linter.Config = { ...config, files: ROUTED_E2E_SPECS };

  return routedConfig;
};

const routedSpecPlaywright = playwright.map(forRoutedSpecs);

export default defineConfig([
  ...baseConfig,
  ...angular,
  ...angularTemplate,
  ...rxjs,
  ...routedSpecPlaywright,
  {
    files: ['**/*.html'],
    rules: {
      'lint-suite-angular-template/no-unstyled-classes': ['error', { globalStyles: [GLOBAL_STYLES] }]
    }
  },
  {
    // e2e assertions live in `expect*` page helpers, each called from a spec's `THEN` or `AND` step.
    files: ['e2e/**/*.e2e.ts', 'e2e/**/*.test.ts'],
    rules: {
      'playwright/expect-expect': ['warn', { assertFunctionPatterns: ['^expect'] }]
    }
  },
  {
    // The `angular` preset turns the project service back on; config files are typed by the root tools tsconfig.
    files: ['*.config.ts'],
    languageOptions: { parserOptions: { projectService: false } }
  }
]);
