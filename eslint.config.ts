import { defineConfig } from 'eslint/config';
import { base, boundaries, javascript, json, playwright, prettier, typescript, vitest } from 'lint-suite/eslint';

export default defineConfig([
  ...base,
  ...javascript,
  ...typescript,
  ...json,
  ...vitest,
  ...playwright,
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
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out-tsc/**',
      '.nx/**',
      '.angular/**',
      '**/coverage/**',
      '**/tmp/**',
      '**/test/fixtures/**'
    ]
  }
]);
