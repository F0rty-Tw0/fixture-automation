import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'openapi-ai-fixtures',
    include: ['src/**/*.spec.ts']
  }
});
