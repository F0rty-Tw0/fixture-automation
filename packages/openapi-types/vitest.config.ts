import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'openapi-types',
    include: ['src/**/*.spec.ts']
  }
});
