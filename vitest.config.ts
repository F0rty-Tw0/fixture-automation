import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/fixture-studio-api/vitest.config.ts', 'packages/*/vitest.config.ts']
  }
});
