import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AiMissingFactory, ModelDiscovery } from '@fixture-automation/openapi-ai-fixtures';
import { promptedInputs } from '@fixture-automation/openapi-fixtures';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { answering, silence } from '@fixture-automation/shared/testing';

import { runWizard } from './wizard.client.ts';
import type { WizardDeps } from '../common/wizard.type.ts';

const TIMEOUT = 30000;
const SPEC_URL = new URL('../test/fixtures/invoice/spec.json', import.meta.url).href;
const PRUNED_SPEC_URL = new URL('../test/fixtures/invoice/pruned.json', import.meta.url).href;
const DISCOVERY: ModelDiscovery = { models: ['m1'], source: 'codex-cli' };
const FILLED = { amount_due: 4200, status: 'open', memo: 'paid by card' };
const CORRUPT = { id: 'in_1' };
const COMPLETE = { ...CORRUPT, ...FILLED };

const exists = async (file: string): Promise<boolean> => {
  try {
    await access(file);

    return true;
  } catch {
    return false;
  }
};

describe('FEATURE: fixture wizard', (): void => {
  let directory: string;
  let corruptFile: string;
  let completeFile: string;
  const enrich: AiMissingFactory = async (): Promise<Record<string, unknown>> => Promise.resolve(FILLED);
  const fill = (): AiMissingFactory => enrich;
  const discover = async (): Promise<ModelDiscovery> => Promise.resolve(DISCOVERY);

  const run = async (...answers: string[]): Promise<void> => {
    const question = answering(...answers);
    const deps: WizardDeps = { question, discover, fill };

    await runWizard(promptedInputs(question), deps);
  };

  beforeAll(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'fixture-wizard-'));
    corruptFile = join(directory, 'corrupt.json');
    completeFile = join(directory, 'complete.json');

    await writeFile(corruptFile, JSON.stringify(CORRUPT));
    await writeFile(completeFile, JSON.stringify(COMPLETE));
  });

  afterAll(async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN json format and no existing fixture', (): void => {
    it(
      'WHEN the run ends THEN only the fixture is written',
      async (): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);
        const outDir = join(directory, 'one');

        await run(SPEC_URL, outDir, '', 'invoice', '1', '');
        await expect(exists(join(outDir, 'invoice.fixture.json'))).resolves.toBe(true);
        await expect(exists(join(outDir, 'invoice.d.ts'))).resolves.toBe(false);
        await expect(exists(join(outDir, 'missing'))).resolves.toBe(false);
      },
      TIMEOUT
    );
  });

  describe('GIVEN both formats, a route target, a corrupt fixture, an AI fill and a merge', (): void => {
    it(
      'WHEN every prompt is answered THEN writes every file, validates the merged fixture and reports its artifacts',
      async (): Promise<void> => {
        const messages: unknown[] = [];

        vi.spyOn(console, 'error').mockImplementation((message: unknown): void => {
          messages.push(message);
        });
        const outDir = join(directory, 'two');
        const mergedFile = join(outDir, 'HiGglABFLx4DXxZ48qyjaogB4bM=.json');
        const provenanceFile = join(outDir, 'HiGglABFLx4DXxZ48qyjaogB4bM=.provenance.json');
        const answers = [SPEC_URL, outDir, 'get', 'v1/invoices/{id}', '3', corruptFile, '', '', 'y', '2', '1', '', 'y', ''];

        await run(...answers);

        for (const name of ['invoice.spec.json', 'invoice.d.ts', 'invoice.fixture.json', 'invoice.fixture.ts']) {
          await expect(exists(join(outDir, name))).resolves.toBe(true);
        }

        for (const name of ['missing.json', 'missing.d.ts', 'missing.stub.ts', 'populated.json']) {
          await expect(exists(join(outDir, 'missing', name))).resolves.toBe(true);
        }

        const merged: unknown = JSON.parse(await readFile(mergedFile, 'utf8'));

        expect(merged).toStrictEqual(COMPLETE);
        await expect(exists(provenanceFile)).resolves.toBe(true);
        expect(messages).toContainEqual(expect.stringContaining(`wrote ${mergedFile}`));
        expect(messages).toContainEqual(expect.stringContaining(`wrote ${provenanceFile}`));
      },
      TIMEOUT
    );

    it(
      'WHEN the merge is accepted THEN reuses the route as METHOD,path without asking method or target-url again',
      async (): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);
        const outDir = join(directory, 'route-reuse');
        const provenanceFile = join(outDir, 'HiGglABFLx4DXxZ48qyjaogB4bM=.provenance.json');

        await run(SPEC_URL, outDir, 'get', 'v1/invoices/{id}', '1', corruptFile, '', '', 'y', '2', '1', '', 'y', '');

        const provenance: unknown = JSON.parse(await readFile(provenanceFile, 'utf8'));

        expect(provenance).toMatchObject({ endpointUrl: 'GET,v1/invoices/{id}' });
      },
      TIMEOUT
    );
  });

  describe('GIVEN a schema targeted by name, a corrupt fixture, an AI fill and a merge', (): void => {
    it(
      'WHEN the merge is accepted THEN asks method and target-url once and hashes that endpoint',
      async (): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);
        const outDir = join(directory, 'named');
        const provenanceFile = join(outDir, '3DUc12LG279NKuk8HnrFr4oZLws=.provenance.json');

        await run(SPEC_URL, outDir, '', 'invoice', '1', corruptFile, '', '', 'y', '2', '1', '', 'y', 'get', 'v1/invoices/in_2', '');

        const provenance: unknown = JSON.parse(await readFile(provenanceFile, 'utf8'));

        expect(provenance).toMatchObject({ endpointUrl: 'GET,v1/invoices/in_2' });
      },
      TIMEOUT
    );
  });

  describe('GIVEN a pruned spec carrying x-root-schema', (): void => {
    it(
      'WHEN the run ends THEN neither method nor schema-name is asked and the root schema is generated',
      async (): Promise<void> => {
        const messages: unknown[] = [];

        vi.spyOn(console, 'error').mockImplementation((message: unknown): void => {
          messages.push(message);
        });
        const outDir = join(directory, 'rooted');

        await run(PRUNED_SPEC_URL, outDir, '1', '');

        await expect(exists(join(outDir, 'invoice.fixture.json'))).resolves.toBe(true);
        expect(messages).toContainEqual(expect.stringContaining('using root schema invoice from the spec'));
      },
      TIMEOUT
    );
  });

  describe('GIVEN a complete existing fixture', (): void => {
    it(
      'WHEN diffed THEN skips filling and writes no missing files',
      async (): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);
        const outDir = join(directory, 'three');

        await run(SPEC_URL, outDir, '', 'invoice', '1', completeFile, '', '');
        await expect(exists(join(outDir, 'missing'))).resolves.toBe(false);
      },
      TIMEOUT
    );
  });

  describe('GIVEN a corrupt fixture and no AI fill', (): void => {
    it(
      'WHEN the fill is declined THEN keeps the missing files',
      async (): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);
        const outDir = join(directory, 'four');

        await run(SPEC_URL, outDir, '', 'invoice', '1', corruptFile, '', '', 'n');
        await expect(exists(join(outDir, 'missing', 'missing.json'))).resolves.toBe(true);
        await expect(exists(join(outDir, 'missing', 'populated.json'))).resolves.toBe(false);
      },
      TIMEOUT
    );
  });

  describe('GIVEN a corrupt fixture, an AI fill and a declined merge', (): void => {
    it(
      'WHEN no endpoint URL is supplied THEN the populated fixture is retained without merged artifacts',
      async (): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);
        const outDir = join(directory, 'five');

        await run(SPEC_URL, outDir, '', 'invoice', '1', corruptFile, '', '', 'y', '2', '1', '', 'n');

        const outputEntries = await readdir(outDir);

        await expect(exists(join(outDir, 'missing', 'populated.json'))).resolves.toBe(true);
        expect(outputEntries.sort()).toStrictEqual(['invoice.fixture.json', 'missing']);
      },
      TIMEOUT
    );
  });

  describe('GIVEN a body envelope and a hash subdirectory', (): void => {
    it(
      'WHEN filled and merged THEN keeps the envelope and hashes the prefixed endpoint',
      async (): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);
        const fixture = { statusCode: 200, body: CORRUPT };
        const populated = { body: FILLED };
        const expected = { statusCode: 200, body: COMPLETE };
        const fixtureFile = join(directory, 'wrapped.json');
        const outDir = join(directory, 'wrapped');
        const question = answering(
          SPEC_URL,
          outDir,
          '',
          'invoice',
          '1',
          fixtureFile,
          'body',
          '',
          'y',
          '2',
          '1',
          '',
          'y',
          'get',
          'custodies/v2',
          'savings-v2'
        );
        const enrichBody: AiMissingFactory = async (): Promise<Record<string, unknown>> => Promise.resolve(populated);
        const fillBody = (): AiMissingFactory => enrichBody;
        const deps: WizardDeps = { question, discover, fill: fillBody };
        const mergedFile = join(outDir, 'pr3BjNLuLB11QZrlaK508hgrGXY=.json');
        const provenanceFile = join(outDir, 'pr3BjNLuLB11QZrlaK508hgrGXY=.provenance.json');

        await writeFile(fixtureFile, JSON.stringify(fixture));
        await runWizard(promptedInputs(question), deps);

        const merged: unknown = JSON.parse(await readFile(mergedFile, 'utf8'));
        const provenance: unknown = JSON.parse(await readFile(provenanceFile, 'utf8'));

        expect(merged).toStrictEqual(expected);
        expect(provenance).toMatchObject({ endpointUrl: 'GET,savings-v2/custodies/v2' });
      },
      TIMEOUT
    );
  });
});
