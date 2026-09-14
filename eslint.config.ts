import { defineConfig } from 'eslint/config';
import { base, boundaries, javascript, json, prettier, typescript, vitest } from 'lint-suite/eslint';

export default defineConfig([
  ...base,
  ...javascript,
  ...typescript,
  ...json,
  ...vitest,
  ...prettier,
  ...boundaries,
  {
    files: ['*.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.tools.json',
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/out-tsc/**', '.nx/**', '**/coverage/**', '**/tmp/**', '**/test/fixtures/**']
  }
]);
