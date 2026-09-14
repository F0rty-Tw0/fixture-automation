import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { diffFixture } from './fixture-diff.client.ts';
import { writeMissingFiles } from './missing-files.client.ts';
import type { MissingFiles } from '../common/missing.type.ts';
import { compiledMissing } from '../test/utils/compiled-missing.spec.util.ts';
import { nestedOrder, nestedSpec } from '../test/utils/nested-spec.spec.util.ts';
import { dropPaths } from '../utils/drop-path.util.ts';

const DROPPED = ['id', 'customer.email', 'lines[1].sku'];
const STUB_CUSTOMER = { email: 'string' };
const STUB_LINE = { sku: 'string' };
const STUB_LINES = [STUB_LINE];
const STUB_VALUE = { id: 'or_1', customer: STUB_CUSTOMER, lines: STUB_LINES };
const STUB_EXPORT = 'MISSING_STUB';
const STUB_EXPORTS = { [STUB_EXPORT]: STUB_VALUE };
const EMPTY_EXPORTS = { [STUB_EXPORT]: {} };
const MISSING_ALIAS = "export type Missing = components['schemas']['missing'];";

let directory: string | undefined;

const missingFiles = async (paths: string[]): Promise<MissingFiles> => {
  directory = await mkdtemp(join(tmpdir(), 'missing-files-'));

  const spec = await nestedSpec();
  const fixture = dropPaths(await nestedOrder(), paths);
  const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true });
  const files = await writeMissingFiles(diff, directory);

  return files;
};

const compiledFiles = async (files: MissingFiles): Promise<unknown> => {
  const sources = [files.typesFile, files.stubFile];
  const exported = await compiledMissing(dirname(files.typesFile), sources, 'missing.stub.js');

  return exported;
};

describe('FEATURE: generated missing-field artifacts', (): void => {
  afterEach(async (): Promise<void> => {
    if (directory !== undefined) await rm(directory, { recursive: true, force: true });

    directory = undefined;
  });

  describe('GIVEN a fixture missing required fields', (): void => {
    it('WHEN writing the artifacts THEN missing.json records the schema name, dialect and paths', async (): Promise<void> => {
      const files = await missingFiles(DROPPED);
      const missing: unknown = JSON.parse(await readFile(files.jsonFile, 'utf8'));
      const expected = { schemaName: 'order', dialect: 'openapi-30', paths: DROPPED };

      expect(missing).toMatchObject(expected);
    });

    it('WHEN typechecking the generated types and stub together THEN the stub exports the sampled value', async (): Promise<void> => {
      const files = await missingFiles(DROPPED);

      const exported = await compiledFiles(files);

      expect(exported).toStrictEqual(STUB_EXPORTS);
    });
  });

  describe('GIVEN a complete fixture', (): void => {
    it('WHEN writing the artifacts THEN the Missing type has no members and the stub is empty', async (): Promise<void> => {
      const files = await missingFiles([]);
      const types = await readFile(files.typesFile, 'utf8');

      const exported = await compiledFiles(files);

      expect(types).toContain('missing: Record<string, never>;');
      expect(types).toContain(MISSING_ALIAS);
      expect(exported).toStrictEqual(EMPTY_EXPORTS);
    });
  });
});
