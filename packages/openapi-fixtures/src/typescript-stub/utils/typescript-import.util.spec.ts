import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { typescriptImport } from './typescript-import.util.ts';

describe('FEATURE: TypeScript stub imports', (): void => {
  describe('GIVEN declarations beside the stub', (): void => {
    it('WHEN calculating the import THEN produces a relative module specifier', (): void => {
      const outputPath = resolve('generated', 'invoice.stub.ts');
      const typesPath = resolve('generated', 'api.d.ts');

      const specifier = typescriptImport(outputPath, typesPath);

      expect(specifier).toBe('./api.d.ts');
    });
  });

  describe('GIVEN declarations above a nested stub', (): void => {
    it('WHEN calculating the import THEN preserves parent traversal with portable separators', (): void => {
      const outputPath = resolve('generated', 'test', 'stubs', 'invoice.stub.ts');
      const typesPath = resolve('generated', 'api.d.ts');

      const specifier = typescriptImport(outputPath, typesPath);

      expect(specifier).toBe('../../api.d.ts');
    });
  });

  describe.skipIf(process.platform !== 'win32')('GIVEN declarations on another Windows drive', (): void => {
    it('WHEN calculating the import THEN rejects a non-relative module specifier', (): void => {
      expect((): string => typescriptImport('C:\\stubs\\invoice.stub.ts', 'D:\\types\\api.d.ts')).toThrow(Error);
    });
  });
});
