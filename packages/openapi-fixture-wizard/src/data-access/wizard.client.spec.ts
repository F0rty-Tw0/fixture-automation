import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AiMissingFactory, ModelDiscovery } from '@fixture-automation/openapi-ai-fixtures';
import { promptedInputs } from '@fixture-automation/openapi-fixtures';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { runWizard } from './wizard.client.ts';
import type { WizardDeps } from '../common/wizard.type.ts';
import { answering, silence } from '../test/utils/answering.spec.util.ts';

const TIMEOUT = 30000;
const SPEC_URL = new URL('../test/fixtures/invoice/spec.json', import.meta.url).href;
const DISCOVERY: ModelDiscovery = { models: ['m1'], source: 'curated' };
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
  const enrich = vi.fn(async (): Promise<Record<string, unknown>> => Promise.resolve(FILLED));
  const fill = vi.fn((): AiMissingFactory => enrich);
  const discover = vi.fn(async (): Promise<ModelDiscovery> => Promise.resolve(DISCOVERY));

  const run = async (...answers: string[]): Promise<ReturnType<typeof vi.fn>> => {
    const question = vi.fn(answering(...answers));
    const deps: WizardDeps = { question, discover, fill };

    await runWizard(promptedInputs(question), deps);

    return question;
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
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('GIVEN json format and no existing fixture', (): void => {
    it(
      'WHEN the run ends THEN only the fixture is written and five prompts were asked',
      async (): Promise<void> => {
        const printed = vi.spyOn(console, 'error').mockImplementation(silence);
        const outDir = join(directory, 'one');

        const question = await run(SPEC_URL, outDir, 'invoice', '1', '');

        expect(question).toHaveBeenCalledTimes(5);
        await expect(exists(join(outDir, 'invoice.fixture.json'))).resolves.toBe(true);
        await expect(exists(join(outDir, 'invoice.d.ts'))).resolves.toBe(false);
        await expect(exists(join(outDir, 'missing'))).resolves.toBe(false);
        expect(printed).toHaveBeenCalledWith(`wrote ${join(outDir, 'invoice.fixture.json')}`);
      },
      TIMEOUT
    );
  });

  describe('GIVEN both formats, a route target, a corrupt fixture, an AI fill and a merge', (): void => {
    it(
      'WHEN every prompt is answered THEN writes every file and validates the merged fixture',
      async (): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);
        const outDir = join(directory, 'two');
        const answers = [SPEC_URL, outDir, 'GET /v1/invoices/{id}', '3', corruptFile, '', 'y', '2', '1', '', 'y', ''];

        const question = await run(...answers);

        expect(question).toHaveBeenCalledTimes(12);
        expect(discover).toHaveBeenCalledWith('codex');
        expect(fill).toHaveBeenCalledTimes(1);
        expect(enrich).toHaveBeenCalledWith('invoice', expect.objectContaining({ fixture: CORRUPT }));

        for (const name of ['invoice.spec.json', 'invoice.d.ts', 'invoice.fixture.json', 'invoice.fixture.ts']) {
          await expect(exists(join(outDir, name))).resolves.toBe(true);
        }

        for (const name of ['missing.json', 'missing.d.ts', 'missing.stub.ts', 'populated.json']) {
          await expect(exists(join(outDir, 'missing', name))).resolves.toBe(true);
        }

        const fixed: unknown = JSON.parse(await readFile(join(outDir, 'invoice.fixed.json'), 'utf8'));

        expect(fixed).toStrictEqual(COMPLETE);
      },
      TIMEOUT
    );
  });

  describe('GIVEN a complete existing fixture', (): void => {
    it(
      'WHEN diffed THEN reports no missing fields and never fills',
      async (): Promise<void> => {
        const printed = vi.spyOn(console, 'error').mockImplementation(silence);
        const outDir = join(directory, 'three');

        const question = await run(SPEC_URL, outDir, 'invoice', '1', completeFile, '');

        expect(question).toHaveBeenCalledTimes(6);
        expect(printed).toHaveBeenCalledWith('no missing fields');
        expect(fill).not.toHaveBeenCalled();
        await expect(exists(join(outDir, 'missing'))).resolves.toBe(false);
      },
      TIMEOUT
    );
  });

  describe('GIVEN a corrupt fixture and no AI fill', (): void => {
    it(
      'WHEN the fill is declined THEN keeps the missing files and never asks about merging',
      async (): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);
        const outDir = join(directory, 'four');

        const question = await run(SPEC_URL, outDir, 'invoice', '1', corruptFile, '', 'n');

        expect(question).toHaveBeenCalledTimes(7);
        expect(fill).not.toHaveBeenCalled();
        await expect(exists(join(outDir, 'missing', 'missing.json'))).resolves.toBe(true);
        await expect(exists(join(outDir, 'missing', 'populated.json'))).resolves.toBe(false);
      },
      TIMEOUT
    );
  });
});
