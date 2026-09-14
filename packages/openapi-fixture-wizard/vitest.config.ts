import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'openapi-fixture-wizard',
    include: ['src/**/*.spec.ts']
  }
});
