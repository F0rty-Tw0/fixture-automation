import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadPopulated } from './load-populated.client.ts';
import type { PopulatedModuleProject } from '../test/common/populated-module.type.ts';
import { populatedModuleProject } from '../test/utils/populated-module.spec.util.ts';

describe('FEATURE: populated fixture loading', (): void => {
  let project: PopulatedModuleProject;

  beforeEach(async (): Promise<void> => {
    project = await populatedModuleProject();
  });

  afterEach(async (): Promise<void> => {
    await project.dispose();
  });

  describe('GIVEN a JSON file', (): void => {
    it('WHEN loading THEN it returns the parsed value', async (): Promise<void> => {
      const file = await project.write('populated.json', '{ "status": "open" }');
      const expected = { status: 'open' };

      await expect(loadPopulated(file)).resolves.toStrictEqual(expected);
    });
  });

  describe('GIVEN a TypeScript stub importing an erased declaration', (): void => {
    it('WHEN loading THEN it returns the single exported value', async (): Promise<void> => {
      const expected = { status: 'open' };

      await expect(loadPopulated(project.stubFile)).resolves.toStrictEqual(expected);
    });
  });

  describe('GIVEN a module without exports', (): void => {
    it('WHEN loading THEN it reports the single-export requirement', async (): Promise<void> => {
      const file = await project.write('empty.stub.ts', 'export {};\n');

      await expect(loadPopulated(file)).rejects.toThrow('populated module must export exactly one value');
    });
  });

  describe('GIVEN a module with two exports', (): void => {
    it('WHEN loading THEN it reports the single-export requirement', async (): Promise<void> => {
      const source = 'export const first = { status: "open" };\nexport const second = { status: "draft" };\n';
      const file = await project.write('pair.stub.ts', source);

      await expect(loadPopulated(file)).rejects.toThrow('populated module must export exactly one value');
    });
  });

  describe('GIVEN a file extension that is neither JSON nor a module', (): void => {
    it('WHEN loading THEN it reports the supported extensions', async (): Promise<void> => {
      const file = await project.write('populated.yaml', 'status: open\n');

      await expect(loadPopulated(file)).rejects.toThrow('populated file must be .json, .ts, .mts, .js, or .mjs');
    });
  });
});
