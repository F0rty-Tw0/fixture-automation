import { describe, expect, it } from 'vitest';

import { loadTypesRenderer } from './openapi-typescript.client.ts';
import type { TypesRenderer } from '../common/openapi-types.type.ts';
import { packageNotFound } from '../test/utils/module-not-found.spec.util.ts';

const MISSING_TYPESCRIPT = {
  name: 'FixtureError',
  message: 'TypeScript export needs the "typescript" package, which is not installed',
  fix: 'install it next to fixture-studio: npm i typescript@5'
};
const MISSING_OPENAPI_TYPESCRIPT = {
  name: 'FixtureError',
  message: 'TypeScript export needs the "openapi-typescript" package, which is not installed',
  fix: 'install it next to fixture-studio: npm i openapi-typescript@7'
};

describe('FEATURE: openapi-typescript loader', (): void => {
  describe('GIVEN the typescript peer is not installed', (): void => {
    it('WHEN the renderer is loaded THEN fails with a FixtureError naming the package and how to install it', async (): Promise<void> => {
      const importRenderer = async (): Promise<TypesRenderer> => Promise.reject(packageNotFound('typescript'));

      const loading = loadTypesRenderer(importRenderer);

      await expect(loading).rejects.toMatchObject(MISSING_TYPESCRIPT);
    });
  });

  describe('GIVEN openapi-typescript itself is not installed', (): void => {
    it('WHEN the renderer is loaded THEN fails with a FixtureError naming it', async (): Promise<void> => {
      const importRenderer = async (): Promise<TypesRenderer> => Promise.reject(packageNotFound('openapi-typescript'));

      const loading = loadTypesRenderer(importRenderer);

      await expect(loading).rejects.toMatchObject(MISSING_OPENAPI_TYPESCRIPT);
    });
  });

  describe('GIVEN the import fails for another reason', (): void => {
    it.each<[string, Error]>([
      ['another package is missing', packageNotFound('yaml')],
      ['the module throws while loading', new SyntaxError('Unexpected token')]
    ])('WHEN %s THEN rethrows that error unchanged', async (_reason: string, error: Error): Promise<void> => {
      const importRenderer = async (): Promise<TypesRenderer> => Promise.reject(error);

      const loading = loadTypesRenderer(importRenderer);

      await expect(loading).rejects.toBe(error);
    });
  });

  describe('GIVEN both packages are installed', (): void => {
    it('WHEN the default renderer is loaded THEN renders an in-memory document', async (): Promise<void> => {
      const info = { title: 't', version: '0' };
      const document = { openapi: '3.1.0', info };

      const render = await loadTypesRenderer();
      const types = await render(document);

      expect(types).toContain('export type paths');
    });
  });
});
