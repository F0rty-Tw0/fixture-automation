import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'fixture-studio-api',
    include: ['src/**/*.spec.ts'],
    // A diff, merge or generate route spawns a spec worker that loads its modules from source first (1-3 s under load).
    testTimeout: 30_000
  }
});
