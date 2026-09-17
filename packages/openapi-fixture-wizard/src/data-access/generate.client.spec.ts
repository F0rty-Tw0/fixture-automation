import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateFiles } from './generate.client.ts';
import type { GenerateRequest, WizardFormat } from '../common/wizard.type.ts';

const TIMEOUT = 30000;
const SPEC_URL = new URL('../test/fixtures/invoice/spec.json', import.meta.url).href;

describe('FEATURE: fixture file generation', (): void => {
  let directory: string;
  let spec: OpenApiSpec;

  const request = (format: WizardFormat): GenerateRequest => {
    const built: GenerateRequest = { spec, schemaName: 'invoice', outDir: join(directory, format), format };

    return built;
  };

  beforeAll(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'wizard-generate-'));
    spec = await loadSpec(SPEC_URL);
  });

  afterAll(async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  });

  describe('GIVEN the json format', (): void => {
    it('WHEN generating THEN writes only the fixture and returns its path', async (): Promise<void> => {
      const outDir = join(directory, 'json');

      const written = await generateFiles(request('json'));

      expect(written).toStrictEqual([join(outDir, 'invoice.fixture.json')]);
      await expect(readdir(outDir)).resolves.toStrictEqual(['invoice.fixture.json']);
    });

    it('WHEN generating THEN the fixture is the sampled schema', async (): Promise<void> => {
      const outDir = join(directory, 'json');

      await generateFiles(request('json'));

      const fixture: unknown = JSON.parse(await readFile(join(outDir, 'invoice.fixture.json'), 'utf8'));

      expect(fixture).toMatchObject({ id: 'in_123', status: 'draft' });
    });
  });

  describe('GIVEN the ts format', (): void => {
    it(
      'WHEN generating THEN writes the pruned spec, the types and the stub in that order',
      async (): Promise<void> => {
        const outDir = join(directory, 'ts');

        const written = await generateFiles(request('ts'));

        expect(written).toStrictEqual([
          join(outDir, 'invoice.spec.json'),
          join(outDir, 'invoice.d.ts'),
          join(outDir, 'invoice.fixture.ts')
        ]);
        await expect(readdir(outDir)).resolves.not.toContain('invoice.fixture.json');
      },
      TIMEOUT
    );

    it(
      'WHEN generating THEN the pruned spec carries x-root-schema and the stub imports the types',
      async (): Promise<void> => {
        const outDir = join(directory, 'ts');

        await generateFiles(request('ts'));

        const pruned: unknown = JSON.parse(await readFile(join(outDir, 'invoice.spec.json'), 'utf8'));
        const stub = await readFile(join(outDir, 'invoice.fixture.ts'), 'utf8');

        expect(pruned).toMatchObject({ 'x-root-schema': 'invoice' });
        expect(stub).toContain('from "./invoice.d.ts"');
      },
      TIMEOUT
    );
  });

  describe('GIVEN both formats', (): void => {
    it(
      'WHEN generating THEN writes the fixture between the types and the stub',
      async (): Promise<void> => {
        const outDir = join(directory, 'both');

        const written = await generateFiles(request('both'));

        expect(written).toStrictEqual([
          join(outDir, 'invoice.spec.json'),
          join(outDir, 'invoice.d.ts'),
          join(outDir, 'invoice.fixture.json'),
          join(outDir, 'invoice.fixture.ts')
        ]);
      },
      TIMEOUT
    );
  });
});
