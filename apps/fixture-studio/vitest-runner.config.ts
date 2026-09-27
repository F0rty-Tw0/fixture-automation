import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// `@angular/build:unit-test` writes its virtual entry files at the workspace root, but pnpm installs
// the app's packages under apps/fixture-studio/node_modules. Resolve bare imports from the app instead.
const APP_IMPORTER = fileURLToPath(new URL('src/main.ts', import.meta.url));
const BARE_IMPORT = /^(?![./\0]|[A-Za-z]:|angular:|virtual:)/u;

const resolveFromApp: Plugin = {
  name: 'fixture-studio:resolve-from-app',
  enforce: 'pre',
  async resolveId(id, importer, options) {
    const isBare = BARE_IMPORT.test(id);
    const isFromApp = importer?.includes('/apps/fixture-studio/') ?? false;

    if (!isBare || isFromApp) return undefined;

    return this.resolve(id, APP_IMPORTER, { ...options, skipSelf: true });
  }
};

export default defineConfig({
  plugins: [resolveFromApp]
});
