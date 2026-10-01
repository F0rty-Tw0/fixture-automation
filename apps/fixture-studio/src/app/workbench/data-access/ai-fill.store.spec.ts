import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { AiFillBody, AiFillResultEvent, DiffBody, MergeBody } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiFillStore } from './ai-fill.store.ts';
import { CHROME_AI_PROVIDER } from './chrome-built-in-ai.provider.ts';
import { ComparisonStore } from './comparison.store.ts';
import type { EngineStreamCall, StudioEngine } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { MERGE_RESULT_STUB, MISSING_FILE_STUB } from '../../test/stubs/studio.stub.ts';
import { settle } from '../../test/utils/studio-http.spec.util.ts';
import type { AiDownloadOptions, AiFillContext, AiRunOptions, AiRunRequest, ChromeAiProvider } from '../common/ai-fill.type.ts';
import type { DiffRequest } from '../common/comparison.type.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';

const FIXTURE = { id: 'in_1' };
const POPULATED = { status: 'open' };
const RESULT: AiFillResultEvent = { type: 'result', populated: POPULATED };
const CONTEXT: AiFillContext = {
  specId: 'spec-1',
  endpointId: 'GET /v1/invoices',
  fixture: FIXTURE,
  missing: MISSING_FILE_STUB,
  complete: undefined,
  scenario: undefined,
  tool: 'claude',
  model: undefined
};
const CLI_RUN: AiRunRequest = { provider: 'cli', context: CONTEXT, objectShape: 'data' };
const CHROME_RUN: AiRunRequest = { ...CLI_RUN, provider: 'chrome' };
const EXPECTED_MERGE: MergeBody = { endpointId: 'GET /v1/invoices', fixture: FIXTURE, populated: POPULATED, objectShape: 'data' };
const EXPECTED_FILL: AiFillBody = {
  endpointId: 'GET /v1/invoices',
  fixture: FIXTURE,
  missing: MISSING_FILE_STUB,
  tool: 'claude',
  model: undefined,
  scenario: undefined
};
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
  let resolveFill: (result: AiFillResultEvent) => void;

  beforeEach((): void => {
    engine = studioEngineMock();

    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [ComparisonStore, AiFillStore, engineProvider] });
    store = TestBed.inject(AiFillStore);
    chrome = TestBed.inject(CHROME_AI_PROVIDER);
    runSignal = undefined;

    const pending = async (): Promise<AiFillResultEvent> => {
      return new Promise<AiFillResultEvent>((resolve) => {
        resolveFill = resolve;
      });
    };
    const pendingCli = async (_specId: string, _body: AiFillBody, call: EngineStreamCall): Promise<AiFillResultEvent> => {
      runSignal = call.signal;
      reportProgress = call.onProgress;

      return pending();
    };
    const pendingChrome = async (_context: AiFillContext, options: AiRunOptions): Promise<AiFillResultEvent> => {
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
      resolveFill(RESULT);
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

    it('WHEN a status line ends in a newline THEN logs it without the newline', (): void => {
      reportProgress({ type: 'progress', stream: 'status', text: 'mock: done\n' });

      expect(store.log().map((line) => line.text)).toStrictEqual(['mock: done']);
    });

    it('WHEN the model output arrives in fragments THEN logs them as one growing entry', (): void => {
      reportProgress({ type: 'progress', stream: 'stdout', text: '{"status":' });
      reportProgress({ type: 'progress', stream: 'stdout', text: '"open"}\n' });

      expect(store.log().map((line) => line.text)).toStrictEqual(['{"status":"open"}\n']);
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
      resolveFill(RESULT);
      await settle();

      TestBed.inject(ComparisonStore).compare(OTHER_COMPARE);
      TestBed.tick();

      expect(store.run.hasValue()).toBe(false);
      expect(store.merge.hasValue()).toBe(false);
      expect(store.answer()).toBeUndefined();
      expect(store.merged()).toBeUndefined();
    });

    it('WHEN started again after a merge THEN drops the last answer and merge at once', async (): Promise<void> => {
      resolveFill(RESULT);
      await settle();

      store.start({ ...CLI_RUN });

      expect(store.answer()).toBeUndefined();
      expect(store.merged()).toBeUndefined();
      expect(store.shownAnswer()).toBeUndefined();
    });

    it('WHEN a re-run fails after a merge THEN shows nothing of the earlier run', async (): Promise<void> => {
      resolveFill(RESULT);
      await settle();
      vi.mocked(engine.cliFill).mockRejectedValueOnce(new Error('claude exited with code 1.'));

      store.start({ ...CLI_RUN });
      await settle();

      expect(store.run.status()).toBe('error');
      expect(store.answer()).toBeUndefined();
      expect(store.merged()).toBeUndefined();
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

      resolveFill(RESULT);
      await settle();

      expect(engine.merge).toHaveBeenCalledWith('spec-1', expected, expect.anything());
    });
  });

  describe('GIVEN a model download is started', (): void => {
    let finishDownload: () => void;
    let downloadOptions: AiDownloadOptions | undefined;

    beforeEach((): void => {
      const pendingDownload = async (options: AiDownloadOptions): Promise<void> => {
        downloadOptions = options;

        return new Promise<void>((resolve) => {
          finishDownload = resolve;
        });
      };

      vi.spyOn(chrome, 'download').mockImplementation(pendingDownload);
      store.startDownload();
      TestBed.tick();
    });

    it('WHEN it is under way THEN shows progress from zero', (): void => {
      expect(store.download.isLoading()).toBe(true);
      expect(store.downloadRatio()).toBe(0);
    });

    it('WHEN Chrome reports progress THEN shows the ratio', (): void => {
      downloadOptions?.onDownload(0.4);

      expect(store.downloadRatio()).toBe(0.4);
    });

    it('WHEN it finishes THEN clears the progress and counts it as settled', async (): Promise<void> => {
      finishDownload();
      await settle();

      expect(store.download.value()).toBe(true);
      expect(store.downloadRatio()).toBeUndefined();
      expect(store.chromeRunsSettled()).toBe(1);
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
      resolveFill(RESULT);
      await settle();

      expect(store.chromeRunsSettled()).toBe(1);
    });
  });
});
