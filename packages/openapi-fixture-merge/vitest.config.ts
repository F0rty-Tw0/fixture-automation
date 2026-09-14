import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'openapi-fixture-merge',
    include: ['src/**/*.spec.ts']
  }
});
