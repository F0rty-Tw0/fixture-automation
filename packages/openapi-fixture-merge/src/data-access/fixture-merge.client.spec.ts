import { access, readFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mergeFixture } from './fixture-merge.client.ts';
import type { MergeInput, MergeResult, MergeSpec } from '../common/fixture-merge.type.ts';
import type { MergeProject } from '../test/common/merge-project.type.ts';
import { mergeProject } from '../test/utils/merge-project.spec.util.ts';

const invoiceSpec = (project: MergeProject): MergeSpec => {
  const spec: MergeSpec = { url: project.specUrl, schemaName: 'invoice' };

  return spec;
};

const mergeInput = (project: MergeProject, populatedFile: string, spec: MergeSpec | undefined): MergeInput => {
  const base: MergeInput = {
    corruptFile: project.corruptFile,
    populatedFile,
    outDir: project.directory,
    endpointUrl: project.endpointUrl
  };

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
    it('WHEN merging with a spec THEN it writes validated JSON and provenance artifacts', async (): Promise<void> => {
      const input = mergeInput(project, project.populatedFile, invoiceSpec(project));
      const expected = { id: 'in_1', amount_due: 100, status: 'open' };
      const expectedJson = `${JSON.stringify(expected, null, 2)}\n`;
      const expectedProvenance = {
        endpointUrl: project.endpointUrl,
        sha256: 'ad7f90a28226334d3d09f9e34d2ac03a50818107a34a1056bface5ea5992a59f'
      };
      const expectedProvenanceSource = `${JSON.stringify(expectedProvenance, null, 2)}\n`;
      const expectedResult: MergeResult = {
        value: expected,
        filled: ['status'],
        outFile: project.outFile,
        provenanceFile: project.provenanceFile,
        provenance: expectedProvenance
      };

      const result = await mergeFixture(input);

      expect(result).toStrictEqual(expectedResult);
      await expect(readFile(result.outFile, 'utf8')).resolves.toBe(expectedJson);
      await expect(readFile(result.provenanceFile, 'utf8')).resolves.toBe(expectedProvenanceSource);
    });
  });

  describe('GIVEN a populated value the schema rejects', (): void => {
    it('WHEN merging THEN it reports the ajv path and writes neither artifact', async (): Promise<void> => {
      const populatedFile = await project.write('invalid.json', '{ "status": "paid" }');
      const input = mergeInput(project, populatedFile, invoiceSpec(project));

      await expect(mergeFixture(input)).rejects.toThrow('/status: must be equal to one of the allowed values');
      await expect(access(project.outFile)).rejects.toThrow();
      await expect(access(project.provenanceFile)).rejects.toThrow();
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

  describe('GIVEN repeated merges for one endpoint', (): void => {
    it('WHEN the content changes THEN the artifact name stays stable and the checksum changes', async (): Promise<void> => {
      const input = mergeInput(project, project.populatedFile, undefined);

      const first = await mergeFixture(input);
      const second = await mergeFixture(input);
      const draftFile = await project.write('draft.json', '{ "status": "draft" }');
      const changedInput = mergeInput(project, draftFile, undefined);
      const changed = await mergeFixture(changedInput);

      expect(second).toStrictEqual(first);
      expect(changed.outFile).toBe(first.outFile);
      expect(changed.provenanceFile).toBe(first.provenanceFile);
      expect(changed.provenance.sha256).not.toBe(first.provenance.sha256);
    });
  });
});
