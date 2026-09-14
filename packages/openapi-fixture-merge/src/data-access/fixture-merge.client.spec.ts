import { access, readFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mergeFixture } from './fixture-merge.client.ts';
import type { MergeInput, MergeSpec } from '../common/fixture-merge.type.ts';
import type { MergeProject } from '../test/common/merge-project.type.ts';
import { mergeProject } from '../test/utils/merge-project.spec.util.ts';

const invoiceSpec = (project: MergeProject): MergeSpec => {
  const spec: MergeSpec = { url: project.specUrl, schemaName: 'invoice' };

  return spec;
};

const mergeInput = (project: MergeProject, populatedFile: string, spec: MergeSpec | undefined): MergeInput => {
  const base: MergeInput = { corruptFile: project.corruptFile, populatedFile, outFile: project.outFile };

  if (spec === undefined) return base;

  const input: MergeInput = { ...base, spec };

  return input;
};

describe('FEATURE: fixture merge', (): void => {
  let project: MergeProject;

  beforeEach(async (): Promise<void> => {
    project = await mergeProject();
    vi.spyOn(console, 'error').mockImplementation((): void => undefined);
  });

  afterEach(async (): Promise<void> => {
    vi.restoreAllMocks();
    await project.dispose();
  });

  describe('GIVEN a populated file that completes the fixture', (): void => {
    it('WHEN merging with a spec THEN it writes validated two-space JSON', async (): Promise<void> => {
      const input = mergeInput(project, project.populatedFile, invoiceSpec(project));
      const expected = { id: 'in_1', amount_due: 100, status: 'open' };

      const result = await mergeFixture(input);

      expect(result.filled).toStrictEqual(['status']);
      expect(result.outFile).toBe(project.outFile);
      await expect(readFile(project.outFile, 'utf8')).resolves.toBe(`${JSON.stringify(expected, null, 2)}\n`);
      expect(console.error).toHaveBeenCalledWith('filled 1 path(s)');
    });
  });

  describe('GIVEN no spec option', (): void => {
    it('WHEN merging THEN it warns that the result is unvalidated', async (): Promise<void> => {
      const input = mergeInput(project, project.populatedFile, undefined);

      await mergeFixture(input);

      expect(console.error).toHaveBeenCalledWith('warning: result not validated (no --spec)');
    });
  });

  describe('GIVEN a populated value the schema rejects', (): void => {
    it('WHEN merging THEN it reports the ajv path and writes nothing', async (): Promise<void> => {
      const populatedFile = await project.write('invalid.json', '{ "status": "paid" }');
      const input = mergeInput(project, populatedFile, invoiceSpec(project));

      await expect(mergeFixture(input)).rejects.toThrow('/status: must be equal to one of the allowed values');
      await expect(access(project.outFile)).rejects.toThrow();
    });
  });

  describe('GIVEN a required property still absent after the merge', (): void => {
    it('WHEN merging THEN it reports the document root path', async (): Promise<void> => {
      const corruptFile = await project.write('bare.json', '{ "id": "in_1" }');
      const populatedFile = await project.write('status.json', '{ "status": "open" }');
      const base = mergeInput(project, populatedFile, invoiceSpec(project));
      const input: MergeInput = { ...base, corruptFile };

      await expect(mergeFixture(input)).rejects.toThrow("/: must have required property 'amount_due'");
    });
  });
});
