import { access, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MergeProject } from '../test/common/merge-project.type.ts';
import { mergeProject } from '../test/utils/merge-project.spec.util.ts';
import { STUB_SOURCE } from '../test/utils/populated-module.spec.util.ts';

const MISSING_TYPES = 'export type components = { schemas: { missing: { status: string } } };\n';

const validatedArgs = (project: MergeProject, populatedFile: string): string[] => {
  return [
    project.corruptFile,
    populatedFile,
    project.directory,
    '--endpoint-url',
    project.endpointUrl,
    '--spec',
    project.specUrl,
    '--schema',
    'invoice'
  ];
};

describe('FEATURE: fixture merge command', (): void => {
  let project: MergeProject;

  beforeEach(async (): Promise<void> => {
    project = await mergeProject();
  });

  afterEach(async (): Promise<void> => {
    await project.dispose();
  });

  describe('GIVEN a corrupt fixture and a JSON populated file', (): void => {
    it('WHEN merging against the spec THEN it writes the validated fixture', async (): Promise<void> => {
      const expected = { id: 'in_1', amount_due: 100, status: 'open' };

      const result = await project.run(validatedArgs(project, project.populatedFile));

      expect(result.stderr).toContain('filled 1 path(s)');
      await expect(readFile(project.outFile, 'utf8')).resolves.toBe(`${JSON.stringify(expected, null, 2)}\n`);
    }, 30000);
  });

  describe('GIVEN a TypeScript stub as the populated input', (): void => {
    it('WHEN merging THEN the stub value is filled in', async (): Promise<void> => {
      const expected = { id: 'in_1', amount_due: 100, status: 'open' };

      await project.write('missing.d.ts', MISSING_TYPES);

      const stubFile = await project.write('populated.stub.ts', STUB_SOURCE);

      await project.run(validatedArgs(project, stubFile));

      await expect(readFile(project.outFile, 'utf8')).resolves.toBe(`${JSON.stringify(expected, null, 2)}\n`);
    }, 30000);
  });

  describe('GIVEN no spec option', (): void => {
    it('WHEN merging THEN it warns and still writes the fixture', async (): Promise<void> => {
      const args = [project.corruptFile, project.populatedFile, project.directory, '--endpoint-url', project.endpointUrl];

      const result = await project.run(args);

      expect(result.stderr).toContain('warning: result not validated (no --spec)');
      await expect(access(project.outFile)).resolves.toBeUndefined();
    }, 30000);
  });

  describe('GIVEN a plain spec without a schema name', (): void => {
    it('WHEN merging THEN it fails without writing', async (): Promise<void> => {
      const args = [
        project.corruptFile,
        project.populatedFile,
        project.directory,
        '--endpoint-url',
        project.endpointUrl,
        '--spec',
        project.specUrl
      ];
      const failure = project.run(args);

      await expect(failure).rejects.toMatchObject({ code: 1 });
      await expect(failure).rejects.toThrow('openapi-fixture-merge: schema name required');
      await expect(failure).rejects.toThrow('fix: pass <schema-name>, or use a spec written by openapi-types');
      await expect(access(project.outFile)).rejects.toThrow();
    }, 30000);
  });

  describe('GIVEN a pruned spec carrying x-root-schema', (): void => {
    it('WHEN merging without a schema name THEN it validates against the root schema', async (): Promise<void> => {
      const spec = JSON.parse(await readFile(new URL(project.specUrl), 'utf8')) as object;
      const pruned = { ...spec, 'x-root-schema': 'invoice' };
      const prunedFile = await project.write('pruned.json', JSON.stringify(pruned));
      const args = [
        project.corruptFile,
        project.populatedFile,
        project.directory,
        '--endpoint-url',
        project.endpointUrl,
        '--spec',
        pathToFileURL(prunedFile).href
      ];

      const result = await project.run(args);

      expect(result.stderr).not.toContain('warning: result not validated');
      await expect(access(project.outFile)).resolves.toBeUndefined();
    }, 30000);
  });

  describe('GIVEN a populated value the schema rejects', (): void => {
    it('WHEN merging THEN it fails without writing', async (): Promise<void> => {
      const populatedFile = await project.write('invalid.json', '{ "status": "paid" }');
      const failure = project.run(validatedArgs(project, populatedFile));

      await expect(failure).rejects.toMatchObject({ code: 1 });
      await expect(failure).rejects.toThrow('openapi-fixture-merge: merged fixture violates schema "invoice"');
      await expect(failure).rejects.toThrow('see: openapi-fixture-merge --help');
      await expect(access(project.outFile)).rejects.toThrow();
    }, 30000);
  });

  describe('GIVEN too few positional arguments', (): void => {
    it('WHEN merging THEN it prints usage and fails', async (): Promise<void> => {
      const failure = project.run([project.corruptFile]);

      await expect(failure).rejects.toMatchObject({ code: 1 });
      await expect(failure).rejects.toThrow('openapi-fixture-merge: usage: <corrupt.json>');
    }, 30000);
  });

  describe('GIVEN a corrupt fixture that does not exist', (): void => {
    it('WHEN merging THEN it names the missing file', async (): Promise<void> => {
      const args = ['absent.json', project.populatedFile, project.directory, '--endpoint-url', project.endpointUrl];

      await expect(project.run(args)).rejects.toThrow('corrupt fixture file "absent.json" does not exist');
    }, 30000);
  });

  describe('GIVEN no endpoint URL', (): void => {
    it('WHEN merging THEN it fails without writing a fixture', async (): Promise<void> => {
      const args = [project.corruptFile, project.populatedFile, project.directory];
      const failure = project.run(args);

      await expect(failure).rejects.toMatchObject({ code: 1 });
      await expect(access(project.outFile)).rejects.toThrow();
    }, 30000);
  });

  describe('GIVEN the help flag', (): void => {
    it('WHEN running THEN it prints usage and exits successfully', async (): Promise<void> => {
      const result = await project.run(['--help']);

      expect(result.stdout).toContain('usage: openapi-fixture-merge');
    }, 30000);
  });
});
