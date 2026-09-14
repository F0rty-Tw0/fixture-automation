import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'openapi-fixtures',
    include: ['src/**/*.spec.ts']
  }
});
