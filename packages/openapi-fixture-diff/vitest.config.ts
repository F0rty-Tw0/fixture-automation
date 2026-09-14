import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'openapi-fixture-diff',
    include: ['src/**/*.spec.ts']
  }
});
