import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MISSING_SCENARIO } from '@fixture-automation/openapi-ai-fixtures';
import type { AiMissingFactory, AiMissingRequest, ModelDiscovery } from '@fixture-automation/openapi-ai-fixtures';
import type { FixtureDiff, SpecSchema } from '@fixture-automation/openapi-fixture-diff';
import { loadSpec, silentInputs, writeTextFile } from '@fixture-automation/openapi-fixtures';
import type { Inputs, OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { fillMissing } from './fill.client.ts';
import type { DiffResult, WizardContext, WizardDeps } from '../common/wizard.type.ts';
import { answering, silence } from '../test/utils/answering.spec.util.ts';

const SPEC_URL = new URL('../test/fixtures/invoice/spec.json', import.meta.url).href;
const DISCOVERY: ModelDiscovery = { models: ['m1'], source: 'codex-cli' };
const CORRUPT = { id: 'in_1' };
const FILLED = { status: 'open' };
const STATUS_SCHEMA: SpecSchema = { type: 'string' };
const MISSING_PROPERTIES = { status: STATUS_SCHEMA };
const MISSING_SCHEMA: SpecSchema = { type: 'object', properties: MISSING_PROPERTIES };
const NO_COMPONENTS = { schemas: {} };
const DIFF: FixtureDiff = {
  schemaName: 'invoice',
  dialect: 'openapi-30',
  paths: ['status'],
  schema: MISSING_SCHEMA,
  components: NO_COMPONENTS
};

describe('FEATURE: missing field fill', (): void => {
  let directory: string;
  let spec: OpenApiSpec;
  let diffed: DiffResult;

  const enrich = vi.fn<AiMissingFactory>();
  const fill = vi.fn((): AiMissingFactory => enrich);

  const context = (extraPrompt: string | undefined): WizardContext => {
    const question = answering('2', '1');
    const deps: WizardDeps = { question, discover: async (): Promise<ModelDiscovery> => Promise.resolve(DISCOVERY), fill };
    const inputs: Inputs = { ...silentInputs, optional: async (): Promise<string | undefined> => Promise.resolve(extraPrompt) };
    const built: WizardContext = {
      inputs,
      deps,
      specUrl: SPEC_URL,
      spec,
      schemaName: 'invoice',
      outDir: directory,
      fixtureFile: join(directory, 'corrupt.json'),
      objectShape: undefined
    };

    return built;
  };

  beforeAll(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'wizard-fill-'));
    spec = await loadSpec(SPEC_URL);

    const jsonFile = join(directory, 'missing', 'missing.json');

    await writeFile(join(directory, 'corrupt.json'), JSON.stringify(CORRUPT));
    await writeTextFile(jsonFile, JSON.stringify(DIFF));
    diffed = {
      fixture: CORRUPT,
      diff: DIFF,
      jsonFile,
      typesFile: join(directory, 'missing', 'missing.d.ts'),
      stubFile: join(directory, 'missing', 'missing.stub.ts')
    };
  });

  afterAll(async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  });

  afterEach((): void => {
    vi.restoreAllMocks();
    enrich.mockReset();
    fill.mockClear();
  });

  describe('GIVEN the extra prompt is skipped', (): void => {
    it('WHEN filled THEN writes the filled values to populated.json next to missing.json', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      enrich.mockResolvedValue(FILLED);

      const populatedFile = await fillMissing(context(undefined), diffed);

      expect(populatedFile).toBe(join(directory, 'missing', 'populated.json'));
      await expect(readFile(populatedFile, 'utf8')).resolves.toBe(`${JSON.stringify(FILLED, null, 2)}\n`);
    });

    it('WHEN filled THEN sends the fixture, the parsed missing file and the default scenario', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      enrich.mockResolvedValue(FILLED);
      const request: AiMissingRequest = { fixture: CORRUPT, missing: DIFF, scenario: MISSING_SCENARIO };

      await fillMissing(context(undefined), diffed);

      expect(enrich).toHaveBeenCalledWith('invoice', request);
    });

    it('WHEN filled THEN runs the chosen tool and model with populated.json as the recovery file', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      enrich.mockResolvedValue(FILLED);

      await fillMissing(context(undefined), diffed);

      expect(fill).toHaveBeenCalledWith(
        expect.objectContaining({ tool: 'codex', model: 'm1', recoveryFile: join(directory, 'missing', 'populated.json') })
      );
    });
  });

  describe('GIVEN an extra prompt is typed', (): void => {
    it('WHEN filled THEN sends it as the scenario', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      enrich.mockResolvedValue(FILLED);

      await fillMissing(context('an open invoice'), diffed);

      expect(enrich).toHaveBeenCalledWith('invoice', expect.objectContaining({ scenario: 'an open invoice' }));
    });
  });
});
