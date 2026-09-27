import { fileURLToPath } from 'node:url';

import { defineConfig } from 'eslint/config';
import { angular, angularTemplate, rxjs } from 'lint-suite/eslint';

import baseConfig from '../../eslint.config.ts';

// Absolute, because the rule resolves `globalStyles` against the lint cwd (repo root for `pnpm lint`, the app for `nx lint`).
const GLOBAL_STYLES = fileURLToPath(new URL('src/styles.scss', import.meta.url));

export default defineConfig([
  ...baseConfig,
  ...angular,
  ...angularTemplate,
  ...rxjs,
  {
    files: ['**/*.html'],
    rules: {
      'lint-suite-angular-template/no-unstyled-classes': ['error', { globalStyles: [GLOBAL_STYLES] }]
    }
  },
  {
    // e2e assertions live in `expect*` page helpers, each a boxed `THEN` step.
    files: ['e2e/**/*.e2e.ts'],
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
