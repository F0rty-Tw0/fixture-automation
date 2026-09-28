import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { AiFillBody, DiffBody, MergeBody } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiFillStore } from './ai-fill.store.ts';
import { CHROME_AI_PROVIDER } from './chrome-built-in-ai.provider.ts';
import { ComparisonStore } from './comparison.store.ts';
import { STUDIO_ENGINE } from './studio-engine.token.ts';
import type { AiFillContext, AiRunOptions, AiRunRequest, ChromeAiProvider } from '../common/ai-fill.type.ts';
import type { DiffRequest } from '../common/comparison.type.ts';
import type { EngineStreamCall, StudioEngine } from '../common/engine.type.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';
import { MERGE_RESULT_STUB, MISSING_FILE_STUB } from '../test/stubs/studio.stub.ts';
import { settle } from '../test/utils/studio-http.spec.util.ts';

const FIXTURE = { id: 'in_1' };
const POPULATED = { status: 'open' };
const CONTEXT: AiFillContext = {
  specId: 'spec-1',
  endpointId: 'GET /v1/invoices',
  fixture: FIXTURE,
  missing: MISSING_FILE_STUB,
  scenario: undefined,
  tool: 'claude',
  model: undefined
};
const CLI_RUN: AiRunRequest = { provider: 'cli', context: CONTEXT, objectShape: 'data' };
const CHROME_RUN: AiRunRequest = { ...CLI_RUN, provider: 'chrome' };
const EXPECTED_MERGE: MergeBody = { endpointId: 'GET /v1/invoices', fixture: FIXTURE, populated: POPULATED, objectShape: 'data' };
const EXPECTED_FILL: AiFillBody = { endpointId: 'GET /v1/invoices', fixture: FIXTURE, missing: MISSING_FILE_STUB, tool: 'claude', model: undefined, scenario: undefined };
const OTHER_FIXTURE = { id: 'in_2' };
const OTHER_DIFF: DiffBody = { endpointId: 'GET /v1/invoices', fixture: OTHER_FIXTURE, requiredOnly: false };
const OTHER_COMPARE: DiffRequest = { specId: 'spec-1', body: OTHER_DIFF };

describe('FEATURE: AI fill store', (): void => {
  let engine: StudioEngine;
  let store: AiFillStore;
  let chrome: ChromeAiProvider;
  let runSignal: AbortSignal | undefined;
  let reportProgress: EngineStreamCall['onProgress'];
  let reportDownload: AiRunOptions['onDownload'];
  let resolveFill: (populated: Record<string, unknown>) => void;

  beforeEach((): void => {
    engine = studioEngineMock();

    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [ComparisonStore, AiFillStore, engineProvider] });
    store = TestBed.inject(AiFillStore);
    chrome = TestBed.inject(CHROME_AI_PROVIDER);
    runSignal = undefined;

    const pending = async (): Promise<Record<string, unknown>> => {
      return new Promise<Record<string, unknown>>((resolve) => {
        resolveFill = resolve;
      });
    };
    const pendingCli = async (_specId: string, _body: AiFillBody, call: EngineStreamCall): Promise<Record<string, unknown>> => {
      runSignal = call.signal;
      reportProgress = call.onProgress;

      return pending();
    };
    const pendingChrome = async (_context: AiFillContext, options: AiRunOptions): Promise<unknown> => {
      runSignal = options.signal;
      reportDownload = options.onDownload;

      return pending();
    };

    vi.mocked(engine.cliFill).mockImplementation(pendingCli);
    vi.spyOn(chrome, 'fill').mockImplementation(pendingChrome);
    vi.mocked(engine.merge).mockResolvedValue(MERGE_RESULT_STUB);
  });

  it('GIVEN no run WHEN effects run THEN run and merge stay idle', (): void => {
    TestBed.tick();

    expect(store.run.status()).toBe('idle');
    expect(store.merge.status()).toBe('idle');
  });

  describe('GIVEN a CLI run', (): void => {
    beforeEach((): void => {
      store.start(CLI_RUN);
      TestBed.tick();
    });

    it('WHEN it starts THEN asks the API to fill with the context as the ai-fill body', (): void => {
      expect(engine.cliFill).toHaveBeenCalledWith('spec-1', EXPECTED_FILL, expect.anything());
      expect(chrome.fill).not.toHaveBeenCalled();
    });

    it('WHEN it streams progress THEN logs it', (): void => {
      reportProgress({ type: 'progress', stream: 'stdout', text: 'working' });

      expect(store.run.status()).toBe('loading');
      expect(store.log().map((line) => line.text)).toStrictEqual(['working']);
    });

    it('WHEN the CLI answers THEN merges the answer into the fixture, inside the envelope', async (): Promise<void> => {
      resolveFill(POPULATED);
      await settle();

      expect(engine.merge).toHaveBeenCalledWith('spec-1', EXPECTED_MERGE, expect.anything());
      expect(store.merge.value()).toStrictEqual(MERGE_RESULT_STUB);
    });

    it('WHEN cancelled THEN aborts the call and logs it', (): void => {
      store.cancel();
      TestBed.tick();

      expect(runSignal?.aborted).toBe(true);
      expect(store.run.status()).toBe('idle');
      expect(store.log().at(-1)?.text).toBe('Cancelled.');
    });

    it('WHEN a CLI line ends in a newline THEN logs it without the newline', (): void => {
      reportProgress({ type: 'progress', stream: 'stdout', text: 'mock: done\n' });

      expect(store.log().map((line) => line.text)).toStrictEqual(['mock: done']);
    });

    it('WHEN started again THEN clears the previous log', (): void => {
      reportProgress({ type: 'progress', stream: 'stdout', text: 'old' });

      store.start(CLI_RUN);

      expect(store.log()).toStrictEqual([]);
    });

    it('WHEN the compare changes mid-run THEN aborts the run and drops its log', (): void => {
      reportProgress({ type: 'progress', stream: 'stdout', text: 'working' });

      TestBed.inject(ComparisonStore).compare(OTHER_COMPARE);
      TestBed.tick();

      expect(runSignal?.aborted).toBe(true);
      expect(store.run.status()).toBe('idle');
      expect(store.log()).toStrictEqual([]);
    });

    it('WHEN the compare changes after the merge THEN drops the result and the merge', async (): Promise<void> => {
      resolveFill(POPULATED);
      await settle();

      TestBed.inject(ComparisonStore).compare(OTHER_COMPARE);
      TestBed.tick();

      expect(store.run.hasValue()).toBe(false);
      expect(store.merge.hasValue()).toBe(false);
    });
  });

  describe('GIVEN a compared fixture and a CLI run', (): void => {
    beforeEach((): void => {
      TestBed.inject(ComparisonStore).compare(OTHER_COMPARE);
      TestBed.tick();
      store.start(CLI_RUN);
      TestBed.tick();
    });

    it('WHEN the CLI answers THEN sends the compared fixture as the original that orders the merge', async (): Promise<void> => {
      const expected: MergeBody = { ...EXPECTED_MERGE, original: OTHER_FIXTURE };

      resolveFill(POPULATED);
      await settle();

      expect(engine.merge).toHaveBeenCalledWith('spec-1', expected, expect.anything());
    });
  });

  describe('GIVEN a Chrome run', (): void => {
    beforeEach((): void => {
      store.start(CHROME_RUN);
      TestBed.tick();
    });

    it('WHEN it starts THEN the on-device provider fills, not the CLI', (): void => {
      expect(chrome.fill).toHaveBeenCalledTimes(1);
      expect(engine.cliFill).not.toHaveBeenCalled();
    });

    it('WHEN the model downloads THEN reports the ratio', (): void => {
      reportDownload(0.25);

      expect(store.downloadRatio()).toBe(0.25);
    });

    it('WHEN it settles THEN counts the settled on-device run', async (): Promise<void> => {
      resolveFill(POPULATED);
      await settle();

      expect(store.chromeRunsSettled()).toBe(1);
    });
  });
});
