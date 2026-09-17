import { readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prepareOutput, writeFixtureOutput } from './fixture-output.client.ts';
import type { AiFixtureCliOptions, FixtureOutput } from '../common/ai-fixtures-cli.type.ts';
import type { ProcessWorkspace } from '../test/common/process.type.ts';
import { AI_FIXTURE_OPTIONS_STUB } from '../test/stubs/ai-fixture-options.stub.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

const REMOTE_SPEC = 'https://example.test/openapi.json';

describe('FEATURE: fixture output destination', (): void => {
  let workspace: ProcessWorkspace;
  let fixtureFile: string;

  const cliOptions = (overrides: Partial<AiFixtureCliOptions>): AiFixtureCliOptions => {
    const base: AiFixtureCliOptions = {
      specUrl: undefined,
      schemaName: 'invoice',
      fixtureFile,
      scenario: 'An open invoice.',
      options: AI_FIXTURE_OPTIONS_STUB,
      outFile: undefined,
      typesFile: undefined
    };
    const options: AiFixtureCliOptions = { ...base, ...overrides };

    return options;
  };

  beforeEach(async (): Promise<void> => {
    workspace = await processWorkspace();
    fixtureFile = workspace.file('invoice.json');

    await writeFile(fixtureFile, '{}');
  });

  afterEach(async (): Promise<void> => {
    vi.restoreAllMocks();
    await workspace.dispose();
  });

  describe('GIVEN no output file', (): void => {
    it('WHEN preparing THEN targets stdout without a types import', async (): Promise<void> => {
      const output = await prepareOutput(cliOptions({}));

      expect(output).toStrictEqual({ file: undefined, typesImport: undefined });
    });

    it('WHEN a types file is given THEN rejects because the import cannot be resolved', async (): Promise<void> => {
      const typesFile = workspace.file('api.d.ts');

      await expect(prepareOutput(cliOptions({ typesFile }))).rejects.toThrow(
        '--ts requires an output file to resolve the types import'
      );
    });
  });

  describe('GIVEN an output file', (): void => {
    it('WHEN it does not exist yet THEN keeps its resolved path', async (): Promise<void> => {
      const outFile = workspace.file('generated.json');

      const output = await prepareOutput(cliOptions({ outFile, specUrl: REMOTE_SPEC }));

      expect(output).toStrictEqual({ file: outFile, typesImport: undefined });
    });

    it('WHEN it exists behind a symlink THEN resolves the real path', async (): Promise<void> => {
      const target = workspace.file('generated.json');
      const link = workspace.file('link.json');

      await writeFile(target, '{}');
      await symlink(target, link);

      const output = await prepareOutput(cliOptions({ outFile: link }));

      expect(output.file).toBe(target);
    });

    it('WHEN its parent is a regular file THEN rethrows the lookup failure', async (): Promise<void> => {
      const outFile = join(fixtureFile, 'generated.json');

      await expect(prepareOutput(cliOptions({ outFile }))).rejects.toThrow(/ENOTDIR/);
    });

    it('WHEN a types file is given THEN resolves a relative import from the output directory', async (): Promise<void> => {
      const typesFile = workspace.file('api.d.ts');
      const outFile = workspace.file('nested/generated.stub.ts');

      await writeFile(typesFile, 'export type components = {};');

      const output = await prepareOutput(cliOptions({ outFile, typesFile }));

      expect(output).toStrictEqual({ file: outFile, typesImport: '../api.d.ts' });
    });
  });

  describe('GIVEN an output file that is also an input', (): void => {
    it('WHEN it is the fixture THEN rejects the destination', async (): Promise<void> => {
      const prepared = prepareOutput(cliOptions({ outFile: fixtureFile }));

      await expect(prepared).rejects.toThrow('the destination must differ from the fixture, spec, and types inputs');
    });

    it('WHEN it is the local spec THEN rejects the destination', async (): Promise<void> => {
      const specFile = workspace.file('spec.json');

      await writeFile(specFile, '{}');

      const prepared = prepareOutput(cliOptions({ outFile: specFile, specUrl: pathToFileURL(specFile).href }));

      await expect(prepared).rejects.toThrow('the destination must differ from the fixture, spec, and types inputs');
    });

    it('WHEN it is the types file THEN rejects the destination', async (): Promise<void> => {
      const typesFile = workspace.file('api.d.ts');

      await writeFile(typesFile, 'export type components = {};');

      const prepared = prepareOutput(cliOptions({ outFile: typesFile, typesFile }));

      await expect(prepared).rejects.toThrow('the destination must differ from the fixture, spec, and types inputs');
    });
  });

  describe('GIVEN a fixture that has no JSON form', (): void => {
    it('WHEN writing THEN rejects instead of writing "undefined"', async (): Promise<void> => {
      const target: FixtureOutput = { file: undefined, typesImport: undefined };

      await expect(writeFixtureOutput(target, 'invoice', undefined)).rejects.toThrow('cannot write a non-JSON fixture');
    });
  });

  describe('GIVEN a stdout target', (): void => {
    it('WHEN writing THEN prints the pretty JSON with a trailing newline', async (): Promise<void> => {
      const written: string[] = [];
      const capture = (chunk: string | Uint8Array): boolean => {
        written.push(String(chunk));

        return true;
      };
      const target: FixtureOutput = { file: undefined, typesImport: undefined };

      vi.spyOn(process.stdout, 'write').mockImplementation(capture);

      await writeFixtureOutput(target, 'invoice', { id: 'in_1' });

      expect(written).toStrictEqual(['{\n  "id": "in_1"\n}\n']);
    });
  });

  describe('GIVEN a file target in a missing directory', (): void => {
    it('WHEN writing THEN creates the directory and leaves only the fixture behind', async (): Promise<void> => {
      const file = workspace.file('nested/generated.json');
      const target: FixtureOutput = { file, typesImport: undefined };

      await writeFixtureOutput(target, 'invoice', { id: 'in_1' });

      await expect(readFile(file, 'utf8')).resolves.toBe('{\n  "id": "in_1"\n}\n');
      await expect(readdir(workspace.file('nested'))).resolves.toStrictEqual(['generated.json']);
    });
  });

  describe('GIVEN a file target with a types import', (): void => {
    it('WHEN writing THEN writes a typed stub module', async (): Promise<void> => {
      const file = workspace.file('generated.stub.ts');
      const target: FixtureOutput = { file, typesImport: './api.d.ts' };

      await writeFixtureOutput(target, 'invoice', { id: 'in_1' });

      const source = await readFile(file, 'utf8');

      expect(source).toContain('import type { components } from "./api.d.ts"');
      expect(source).toContain('export const INVOICE_STUB: components["schemas"]["invoice"] = {');
    });
  });
});
