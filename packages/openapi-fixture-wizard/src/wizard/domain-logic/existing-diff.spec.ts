import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { diffExisting } from './existing-diff.ts';
import type { DiffRequest } from '../common/wizard.type.ts';

const SPEC_URL = new URL('../test/fixtures/invoice/spec.json', import.meta.url).href;
const COMPLETE = { id: 'in_1', amount_due: 4200, status: 'open', memo: 'paid by card' };
const REQUIRED_ONLY = { id: 'in_1', amount_due: 4200, status: 'open' };
const CORRUPT = { id: 'in_1' };
const CORRUPT_DIFF = { schemaName: 'invoice', paths: ['amount_due', 'status', 'memo'] };
const WRAPPED_DIFF = { paths: ['body.amount_due', 'body.status'] };
const PLACEHOLDER = { id: 'in_1', amount_due: 0, status: 'open', memo: 'string' };
const PLACEHOLDER_DIFF = { paths: ['amount_due', 'memo'], replaced: ['amount_due', 'memo'] };
const PLACEHOLDER_BASELINE = { id: 'in_1', status: 'open' };

describe('FEATURE: existing fixture diff', (): void => {
  let directory: string;
  let spec: OpenApiSpec;

  const writeFixture = async (name: string, fixture: unknown): Promise<string> => {
    const file = join(directory, name);

    await writeFile(file, JSON.stringify(fixture));

    return file;
  };

  const request = (fixtureFile: string, outDir: string, requiredOnly: boolean, objectShape?: string): DiffRequest => {
    const built: DiffRequest = { spec, schemaName: 'invoice', fixtureFile, outDir, requiredOnly, objectShape };

    return built;
  };

  beforeAll(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'wizard-diff-'));
    spec = await loadSpec(SPEC_URL);
  });

  afterAll(async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  });

  describe('GIVEN a complete fixture', (): void => {
    it('WHEN diffed THEN returns undefined and writes nothing', async (): Promise<void> => {
      const fixtureFile = await writeFixture('complete.json', COMPLETE);
      const outDir = join(directory, 'complete');

      const result = await diffExisting(request(fixtureFile, outDir, false));

      expect(result).toBeUndefined();
      await expect(readdir(directory)).resolves.not.toContain('complete');
    });
  });

  describe('GIVEN a fixture missing fields', (): void => {
    it('WHEN diffed THEN returns the parsed fixture with the missing paths', async (): Promise<void> => {
      const fixtureFile = await writeFixture('corrupt.json', CORRUPT);
      const outDir = join(directory, 'corrupt');

      const result = await diffExisting(request(fixtureFile, outDir, false));

      expect(result).toMatchObject({ fixture: CORRUPT, diff: CORRUPT_DIFF });
    });

    it('WHEN diffed THEN writes the three missing files and the baseline into the out directory', async (): Promise<void> => {
      const fixtureFile = await writeFixture('corrupt-files.json', CORRUPT);
      const outDir = join(directory, 'corrupt-files');

      const result = await diffExisting(request(fixtureFile, outDir, false));

      expect(result).toMatchObject({
        jsonFile: join(outDir, 'missing.json'),
        typesFile: join(outDir, 'missing.d.ts'),
        stubFile: join(outDir, 'missing.stub.ts'),
        baselineFile: join(outDir, 'baseline.json')
      });
      await expect(readdir(outDir)).resolves.toStrictEqual(['baseline.json', 'missing.d.ts', 'missing.json', 'missing.stub.ts']);
    });
  });

  describe('GIVEN a fixture missing only an optional field', (): void => {
    it('WHEN diffed with required-only THEN returns undefined', async (): Promise<void> => {
      const fixtureFile = await writeFixture('required.json', REQUIRED_ONLY);
      const outDir = join(directory, 'required');

      const result = await diffExisting(request(fixtureFile, outDir, true));

      expect(result).toBeUndefined();
    });
  });

  describe('GIVEN a fixture wrapped in a body envelope', (): void => {
    it('WHEN diffed with the object shape THEN prefixes the missing paths with the shape', async (): Promise<void> => {
      const fixtureFile = await writeFixture('wrapped.json', { statusCode: 200, body: CORRUPT });
      const outDir = join(directory, 'wrapped');

      const result = await diffExisting(request(fixtureFile, outDir, true, 'body'));

      expect(result).toMatchObject({ diff: WRAPPED_DIFF });
    });
  });

  describe('GIVEN a fixture holding sampler placeholders', (): void => {
    it('WHEN diffed THEN the placeholders are replaced and listed as missing', async (): Promise<void> => {
      const fixtureFile = await writeFixture('placeholder.json', PLACEHOLDER);
      const outDir = join(directory, 'placeholder');

      const result = await diffExisting(request(fixtureFile, outDir, false));

      expect(result).toMatchObject({ fixture: PLACEHOLDER, diff: PLACEHOLDER_DIFF });
    });

    it('WHEN diffed THEN baseline.json holds the fixture without them', async (): Promise<void> => {
      const fixtureFile = await writeFixture('placeholder-baseline.json', PLACEHOLDER);
      const outDir = join(directory, 'placeholder-baseline');

      await diffExisting(request(fixtureFile, outDir, false));

      const baseline: unknown = JSON.parse(await readFile(join(outDir, 'baseline.json'), 'utf8'));

      expect(baseline).toStrictEqual(PLACEHOLDER_BASELINE);
    });
  });
});
