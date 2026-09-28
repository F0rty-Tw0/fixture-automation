import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { AiToolStatus, AiToolsResult, DiffResult } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FixtureAiFill } from './fixture-ai-fill.service.ts';
import { FixtureComparison } from './fixture-comparison.service.ts';
import { provideFixtureWorkbench } from './fixture-workbench.provider.ts';
import { SpecBrowser } from './spec-browser.service.ts';
import type { AiAvailability } from '../common/ai-fill.type.ts';
import type { StudioEngine } from '../common/engine.type.ts';
import { AiSettingsStore } from '../data-access/ai-settings.store.ts';
import { CHROME_AI_PROVIDER } from '../data-access/chrome-built-in-ai.provider.ts';
import { ComparisonStore } from '../data-access/comparison.store.ts';
import { SpecStore } from '../data-access/spec.store.ts';
import { STUDIO_ENGINE } from '../data-access/studio-engine.token.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';
import { CLI_TOOLS_RESULT_STUB, DIFF_RESULT_STUB, LOADED_SPEC_STUB, MERGE_RESULT_STUB } from '../test/stubs/studio.stub.ts';
import { settle } from '../test/utils/studio-http.spec.util.ts';

const MISSING_CLAUDE: AiToolStatus = { tool: 'claude', installed: false };
const MISSING_CODEX: AiToolStatus = { tool: 'codex', installed: false };
const INSTALLED_GEMINI: AiToolStatus = { tool: 'gemini', installed: true };
const CLAUDE_MISSING_TOOLS: AiToolsResult = { tools: [MISSING_CLAUDE, MISSING_CODEX, INSTALLED_GEMINI], mock: false };
const NO_TOOLS: AiToolsResult = { tools: [MISSING_CLAUDE, MISSING_CODEX], mock: false };
const MOCK_TOOLS: AiToolsResult = { ...CLI_TOOLS_RESULT_STUB, mock: true };
const DISCOVERY_FAILURE = new Error('claude model discovery failed: not logged in');

describe('FEATURE: fixture AI fill', (): void => {
  let engine: StudioEngine;

  const setUp = async (availability: AiAvailability): Promise<FixtureAiFill> => {
    vi.spyOn(TestBed.inject(CHROME_AI_PROVIDER), 'availability').mockResolvedValue(availability);

    const fill = TestBed.inject(FixtureAiFill);

    await settle();

    return fill;
  };

  /** Loads the spec, reads a fixture and compares it inside the `data` envelope; waits for the diff without waiting on Chrome. */
  const compareInvoice = async (): Promise<void> => {
    const comparison = TestBed.inject(FixtureComparison);
    const hasDiff = (): void => {
      TestBed.tick();
      expect(TestBed.inject(ComparisonStore).diff.hasValue()).toBe(true);
    };

    TestBed.inject(SpecBrowser).loadUrl('https://example.com/a.json');
    await vi.waitFor((): void => {
      TestBed.tick();
      expect(TestBed.inject(SpecStore).loadedSpec()).toBeDefined();
    });
    await comparison.readFile(new File(['{"id":"in_1"}'], 'a.json'));
    comparison.form.set({ pasted: '', objectShape: 'data', replacePlaceholders: true });
    comparison.compare('GET /v1/invoices');
    await vi.waitFor(hasDiff);
  };

  beforeEach((): void => {
    localStorage.clear();
    engine = studioEngineMock();
    vi.mocked(engine.cliModels).mockResolvedValue({ models: ['mock-model'], source: 'mock' });
    vi.mocked(engine.cliTools).mockResolvedValue(CLI_TOOLS_RESULT_STUB);
    vi.mocked(engine.loadSpec).mockResolvedValue(LOADED_SPEC_STUB);
    vi.mocked(engine.diff).mockResolvedValue(DIFF_RESULT_STUB);
    vi.mocked(engine.merge).mockResolvedValue(MERGE_RESULT_STUB);
    vi.mocked(engine.cliFill).mockResolvedValue({ status: 'open' });
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [provideFixtureWorkbench(), engineProvider] });
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('SCENARIO: provider choice', (): void => {
    it('GIVEN no opt-in WHEN Chrome AI is available THEN the local CLI fills', async (): Promise<void> => {
      const fill = await setUp('available');

      expect(fill.provider()).toBe('cli');
    });

    it('GIVEN an opt-in WHEN Chrome AI is available THEN the on-device model fills', async (): Promise<void> => {
      TestBed.inject(AiSettingsStore).setChromeOptIn(true);

      const fill = await setUp('downloadable');

      expect(fill.provider()).toBe('chrome');
    });

    it('GIVEN an opt-in WHEN Chrome AI is unavailable THEN falls back to the local CLI', async (): Promise<void> => {
      TestBed.inject(AiSettingsStore).setChromeOptIn(true);

      const fill = await setUp('unavailable');

      expect(fill.provider()).toBe('cli');
    });

    it('GIVEN the local CLI WHEN a tool is chosen THEN discovers its models', async (): Promise<void> => {
      const fill = await setUp('unavailable');

      expect(fill.models.value()?.models).toStrictEqual(['mock-model']);
      expect(engine.cliModels).toHaveBeenCalledWith('claude', expect.anything());
    });

    it('GIVEN the on-device provider WHEN chosen THEN skips model discovery', async (): Promise<void> => {
      TestBed.inject(AiSettingsStore).setChromeOptIn(true);

      await setUp('available');

      expect(engine.cliModels).not.toHaveBeenCalled();
    });
  });

  describe('SCENARIO: CLI install check', (): void => {
    it('GIVEN the chosen tool is missing WHEN the check answers THEN picks the first installed tool and discovers only its models', async (): Promise<void> => {
      vi.mocked(engine.cliTools).mockResolvedValue(CLAUDE_MISSING_TOOLS);

      const fill = await setUp('unavailable');

      expect(fill.form().tool).toBe('gemini');
      expect(engine.cliModels).toHaveBeenCalledExactlyOnceWith('gemini', expect.anything());
    });

    describe('GIVEN no CLI is installed', (): void => {
      beforeEach((): void => {
        vi.mocked(engine.cliTools).mockResolvedValue(NO_TOOLS);
      });

      it('WHEN read THEN says so, keeps the tool, and discovers no models', async (): Promise<void> => {
        const fill = await setUp('unavailable');

        expect(fill.isNoCliInstalled()).toBe(true);
        expect(fill.form().tool).toBe('claude');
        expect(engine.cliModels).not.toHaveBeenCalled();
      });

      it('WHEN a compare has missing paths THEN cannot run', async (): Promise<void> => {
        const fill = await setUp('unavailable');

        await compareInvoice();
        await settle();

        expect(fill.canRun()).toBe(false);
      });
    });

    it('GIVEN the API runs the mock AI WHEN the check answers THEN flags the mock', async (): Promise<void> => {
      vi.mocked(engine.cliTools).mockResolvedValue(MOCK_TOOLS);

      const fill = await setUp('unavailable');

      expect(fill.isMockAi()).toBe(true);
    });

    it('GIVEN the check fails WHEN read THEN offers every tool and still discovers models', async (): Promise<void> => {
      vi.mocked(engine.cliTools).mockRejectedValue(new Error('The Fixture Studio API did not answer.'));

      const fill = await setUp('unavailable');

      expect(fill.toolOptions()).toStrictEqual(CLI_TOOLS_RESULT_STUB.tools);
      expect(fill.isMockAi()).toBe(false);
      expect(engine.cliModels).toHaveBeenCalledWith('claude', expect.anything());
    });

    it('GIVEN the on-device provider WHEN chosen THEN skips the install check', async (): Promise<void> => {
      TestBed.inject(AiSettingsStore).setChromeOptIn(true);

      await setUp('available');

      expect(engine.cliTools).not.toHaveBeenCalled();
    });
  });

  describe('SCENARIO: model discovery failure', (): void => {
    it('GIVEN a failing discovery WHEN read THEN exposes its message and offers no models', async (): Promise<void> => {
      vi.mocked(engine.cliModels).mockRejectedValue(DISCOVERY_FAILURE);

      const fill = await setUp('unavailable');

      expect(fill.modelsError()?.message).toBe(DISCOVERY_FAILURE.message);
      expect(fill.modelOptions()).toStrictEqual([]);
    });

    it('GIVEN a failed discovery WHEN retried THEN discovers again and lists the models', async (): Promise<void> => {
      vi.mocked(engine.cliModels).mockRejectedValueOnce(DISCOVERY_FAILURE);
      const fill = await setUp('unavailable');

      fill.retryModels();
      await settle();

      expect(fill.modelsError()).toBeUndefined();
      expect(fill.modelOptions()).toStrictEqual(['mock-model']);
    });
  });

  describe('SCENARIO: running', (): void => {
    it('GIVEN no compare yet WHEN read THEN cannot run', async (): Promise<void> => {
      const fill = await setUp('unavailable');

      expect(fill.canRun()).toBe(false);
    });

    it('GIVEN an opt-in and a compare WHEN Chrome has not answered yet THEN cannot run until it does', async (): Promise<void> => {
      let answer: (availability: AiAvailability) => void = (): void => undefined;
      const pending = new Promise<AiAvailability>((resolve) => {
        answer = resolve;
      });

      TestBed.inject(AiSettingsStore).setChromeOptIn(true);
      vi.spyOn(TestBed.inject(CHROME_AI_PROVIDER), 'availability').mockReturnValue(pending);
      const fill = TestBed.inject(FixtureAiFill);

      await compareInvoice();

      expect(fill.canRun()).toBe(false);

      answer('available');
      await settle();

      expect(fill.canRun()).toBe(true);
    });

    describe('GIVEN a compare with missing paths, inside an envelope', (): void => {
      let fill: FixtureAiFill;

      beforeEach(async (): Promise<void> => {
        fill = await setUp('unavailable');
        await compareInvoice();
        await settle();
      });

      it('WHEN read THEN can run', (): void => {
        expect(fill.canRun()).toBe(true);
      });

      it('WHEN run THEN fills with the scenario and model, merges, and exposes the results', async (): Promise<void> => {
        fill.form.set({ scenario: '  overdue  ', tool: 'claude', model: '' });

        fill.run();
        await settle();

        const body = vi.mocked(engine.cliFill).mock.lastCall?.[1];
        const expectedBody = { scenario: 'overdue', model: undefined, missing: DIFF_RESULT_STUB.missing };

        expect(body).toMatchObject(expectedBody);
        expect(fill.filledJson()).toBe('{\n  "status": "open"\n}\n');
        expect(fill.mergeResult()).toStrictEqual(MERGE_RESULT_STUB);
      });

      it('WHEN the envelope is edited after the compare THEN fill and merge keep the compared one', async (): Promise<void> => {
        TestBed.inject(FixtureComparison).form.set({ pasted: '', objectShape: 'payload', replacePlaceholders: true });

        fill.run();
        await settle();

        const fixture = { id: 'in_1' };
        const expected = { objectShape: 'data', fixture };

        expect(engine.merge).toHaveBeenLastCalledWith('spec-1', expect.objectContaining(expected), expect.anything());
      });
    });

    describe('GIVEN a compare that replaced placeholder values', (): void => {
      const baseline = { data: {} };
      const replacedDiff: DiffResult = { ...DIFF_RESULT_STUB, missingPaths: ['data.id'], replacedPaths: ['data.id'], baseline };

      beforeEach((): void => {
        vi.mocked(engine.diff).mockResolvedValue(replacedDiff);
      });

      it('WHEN read THEN can run on the replaced paths alone', async (): Promise<void> => {
        const fill = await setUp('unavailable');

        await compareInvoice();
        await settle();

        expect(fill.canRun()).toBe(true);
      });

      it('WHEN run with the CLI THEN fill and merge start from the baseline, not the compared fixture', async (): Promise<void> => {
        const fill = await setUp('unavailable');

        await compareInvoice();
        await settle();
        fill.run();
        await settle();

        const body = vi.mocked(engine.cliFill).mock.lastCall?.[1];

        expect(body?.fixture).toStrictEqual(baseline);
        expect(engine.merge).toHaveBeenLastCalledWith('spec-1', expect.objectContaining({ fixture: baseline }), expect.anything());
      });

      it('WHEN run on the device THEN the on-device model gets the baseline', async (): Promise<void> => {
        TestBed.inject(AiSettingsStore).setChromeOptIn(true);
        const chrome = TestBed.inject(CHROME_AI_PROVIDER);
        const fill = await setUp('available');

        vi.spyOn(chrome, 'fill').mockResolvedValue({ status: 'open' });
        await compareInvoice();
        await settle();
        fill.run();
        await settle();

        expect(chrome.fill).toHaveBeenCalledWith(expect.objectContaining({ fixture: baseline }), expect.anything());
      });
    });

    it('GIVEN an on-device run WHEN it settles THEN checks Chrome availability again', async (): Promise<void> => {
      TestBed.inject(AiSettingsStore).setChromeOptIn(true);
      const chrome = TestBed.inject(CHROME_AI_PROVIDER);
      const fill = await setUp('downloadable');

      vi.spyOn(chrome, 'fill').mockResolvedValue({ status: 'open' });
      vi.mocked(chrome.availability).mockResolvedValue('available');
      await compareInvoice();
      await settle();

      fill.run();
      await settle();

      expect(chrome.availability).toHaveBeenCalledTimes(2);
      expect(fill.chromeAvailability.value()).toBe('available');
    });
  });
});
