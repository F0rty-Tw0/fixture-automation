import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { AiFillProgressEvent, AiPromptBody, AiPromptResult } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHROME_AI_PROVIDER } from './chrome-built-in-ai.provider.ts';
import { STUDIO_ENGINE } from './studio-engine.token.ts';
import type { AiFillContext, AiRunOptions, ChromeAiProvider } from '../common/ai-fill.type.ts';
import type { StudioEngine } from '../common/engine.type.ts';
import { languageModelMock, languageModelSessionMock } from '../test/mocks/browser.mock.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';
import { AI_PROMPT_RESULT_STUB, MISSING_FILE_STUB } from '../test/stubs/studio.stub.ts';
import { rejectionOf } from '../test/utils/promise.spec.util.ts';
import { streamOf } from '../test/utils/stream.spec.util.ts';

const FIXTURE = { id: 'in_1' };
const CONTEXT: AiFillContext = {
  specId: 'spec-1',
  endpointId: 'GET /v1/invoices',
  fixture: FIXTURE,
  missing: MISSING_FILE_STUB,
  scenario: 'overdue',
  tool: 'claude',
  model: undefined
};
const SYSTEM_PROMPT: LanguageModelPrompt = { role: 'system', content: 'You fill fixtures.' };
const SESSION_OPTIONS = { initialPrompts: [SYSTEM_PROMPT] };
const PROMPT_OPTIONS = { responseConstraint: AI_PROMPT_RESULT_STUB.responseSchema };
const DOWNLOAD_HALF = { loaded: 0.5 };

describe('FEATURE: Chrome built-in AI provider', (): void => {
  let engine: StudioEngine;
  let provider: ChromeAiProvider;
  let progress: AiFillProgressEvent[];
  let downloads: number[];
  let options: AiRunOptions;

  beforeEach((): void => {
    engine = studioEngineMock();
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [engineProvider] });
    provider = TestBed.inject(CHROME_AI_PROVIDER);
    progress = [];
    downloads = [];
    options = {
      signal: new AbortController().signal,
      onProgress: (event): number => progress.push(event),
      onDownload: (ratio): number => downloads.push(ratio)
    };
    vi.mocked(engine.aiPrompt).mockResolvedValue(AI_PROMPT_RESULT_STUB);
  });

  afterEach((): void => {
    vi.unstubAllGlobals();
  });

  describe('SCENARIO: availability', (): void => {
    it('GIVEN a browser without the Prompt API WHEN asked THEN is unavailable', async (): Promise<void> => {
      vi.stubGlobal('LanguageModel', undefined);

      await expect(provider.availability()).resolves.toBe('unavailable');
    });

    it('GIVEN the Prompt API WHEN asked THEN reports what Chrome says', async (): Promise<void> => {
      const factory = languageModelMock();

      vi.mocked(factory.availability).mockResolvedValue('downloadable');
      vi.stubGlobal('LanguageModel', factory);

      await expect(provider.availability()).resolves.toBe('downloadable');
    });

    it('GIVEN the Prompt API throws WHEN asked THEN is unavailable', async (): Promise<void> => {
      const factory = languageModelMock();

      vi.mocked(factory.availability).mockRejectedValue(new Error('policy'));
      vi.stubGlobal('LanguageModel', factory);

      await expect(provider.availability()).resolves.toBe('unavailable');
    });
  });

  describe('SCENARIO: filling', (): void => {
    let factory: LanguageModelFactory;
    let session: LanguageModelSession;

    beforeEach((): void => {
      factory = languageModelMock();
      session = languageModelSessionMock();
      vi.stubGlobal('LanguageModel', factory);
    });

    describe('GIVEN a model that downloads, then streams JSON in chunks', (): void => {
      beforeEach((): void => {
        const createSession = async (createOptions?: LanguageModelCreateOptions): Promise<LanguageModelSession> => {
          const monitor: LanguageModelMonitor = new EventTarget();

          createOptions?.monitor?.(monitor);
          monitor.dispatchEvent(Object.assign(new Event('downloadprogress'), DOWNLOAD_HALF));
          monitor.dispatchEvent(new Event('downloadprogress'));

          return Promise.resolve(session);
        };

        vi.mocked(factory.create).mockImplementation(createSession);
        vi.mocked(session.promptStreaming).mockReturnValue(streamOf(['{"status":', '"open"}']));
      });

      it('WHEN filled THEN resolves the parsed answer', async (): Promise<void> => {
        await expect(provider.fill(CONTEXT, options)).resolves.toStrictEqual({ status: 'open' });
      });

      it('WHEN filled THEN starts with the system prompt and constrains the answer to the schema', async (): Promise<void> => {
        await provider.fill(CONTEXT, options);

        expect(factory.create).toHaveBeenCalledWith(expect.objectContaining(SESSION_OPTIONS));
        expect(session.promptStreaming).toHaveBeenCalledWith('Fill status.', expect.objectContaining(PROMPT_OPTIONS));
      });

      it('WHEN filled THEN reports download progress (ignoring events without a ratio) and destroys the session', async (): Promise<void> => {
        await provider.fill(CONTEXT, options);

        expect(downloads).toStrictEqual([0.5]);
        expect(progress.length).toBeGreaterThan(0);
        expect(session.destroy).toHaveBeenCalledTimes(1);
      });
    });

    describe('GIVEN a Chrome that rejects the response schema', (): void => {
      beforeEach((): void => {
        vi.mocked(factory.create).mockResolvedValue(session);
      });

      it.each([
        ['a TypeError', new TypeError('responseConstraint')],
        ['a NotSupportedError', new DOMException('no structured output', 'NotSupportedError')]
      ])('WHEN it throws %s THEN asks once more without the schema', async (_label, rejection): Promise<void> => {
        const reject = (): never => {
          throw rejection;
        };

        vi.mocked(session.promptStreaming).mockImplementationOnce(reject).mockReturnValueOnce(streamOf(['{"status":"open"}']));

        const answer = await provider.fill(CONTEXT, options);
        const retryOptions = vi.mocked(session.promptStreaming).mock.lastCall?.[1];

        expect(answer).toStrictEqual({ status: 'open' });
        expect(session.promptStreaming).toHaveBeenCalledTimes(2);
        expect(retryOptions).not.toHaveProperty('responseConstraint');
      });

      it('WHEN the failure is something else THEN does not retry', async (): Promise<void> => {
        const failure = new Error('model crashed');
        const reject = (): never => {
          throw failure;
        };

        vi.mocked(session.promptStreaming).mockImplementation(reject);

        await expect(provider.fill(CONTEXT, options)).rejects.toBe(failure);
        expect(session.promptStreaming).toHaveBeenCalledTimes(1);
      });
    });

    describe('GIVEN a model that measures prompts against a 1000-token context window', (): void => {
      const GAP_PATHS = ['customer', 'error.customer', 'error.source'];
      const GAP_MISSING = { ...MISSING_FILE_STUB, paths: GAP_PATHS };
      const GAP_CONTEXT: AiFillContext = { ...CONTEXT, missing: GAP_MISSING };
      const MERGED_ERROR = { customer: 'cus_2', source: 'src_1' };
      const ANSWERS: Record<string, string> = {
        customer: '{"customer":"cus_1"}',
        'error.customer,error.source': '{"error":{"customer":"cus_2","source":"src_1"}}',
        'error.customer': '{"error":{"customer":"cus_2"}}',
        'error.source': '{"error":{"source":"src_1"}}'
      };
      let clones: LanguageModelSession[];
      let promptTokens: Record<string, number>;

      const promptKey = (paths: string[] | undefined): string => paths?.join(',') ?? 'whole';

      const promptFor = async (_specId: string, body: AiPromptBody): Promise<AiPromptResult> => {
        const prompt: AiPromptResult = { ...AI_PROMPT_RESULT_STUB, prompt: promptKey(body.paths) };

        return Promise.resolve(prompt);
      };

      const measure = async (input: string): Promise<number> => Promise.resolve(promptTokens[input] ?? 100);

      const cloneSession = async (): Promise<LanguageModelSession> => {
        const clone = languageModelSessionMock();
        const answer = (input: string): ReadableStream<string> => streamOf([ANSWERS[input] ?? '{"status":"open"}']);

        vi.mocked(clone.promptStreaming).mockImplementation(answer);
        clones.push(clone);

        return Promise.resolve(clone);
      };

      const requestedPaths = (): (string[] | undefined)[] => vi.mocked(engine.aiPrompt).mock.calls.map((call) => call[1].paths);

      beforeEach((): void => {
        clones = [];
        promptTokens = {};
        const measured = languageModelSessionMock();

        session = { ...measured, contextWindow: 1000, contextUsage: 10, measureContextUsage: vi.fn(measure), clone: vi.fn(cloneSession) };
        vi.mocked(factory.create).mockResolvedValue(session);
        vi.mocked(engine.aiPrompt).mockImplementation(promptFor);
      });

      it('WHEN the whole fixture fits THEN answers it in one prompt, in a clone of the session', async (): Promise<void> => {
        const answer = await provider.fill(GAP_CONTEXT, options);

        expect(answer).toStrictEqual({ status: 'open' });
        expect(requestedPaths()).toStrictEqual([undefined]);
        expect(clones).toHaveLength(1);
        expect(session.promptStreaming).not.toHaveBeenCalled();
      });

      it('WHEN only the parts around the missing paths fit THEN asks with every path and a trimmed baseline', async (): Promise<void> => {
        promptTokens = { whole: 900, 'customer,error.customer,error.source': 700 };

        await provider.fill(GAP_CONTEXT, options);

        expect(requestedPaths()).toStrictEqual([undefined, GAP_PATHS]);
      });

      it('WHEN even those are too large THEN fills each half on its own and merges the answers', async (): Promise<void> => {
        promptTokens = { whole: 900, 'customer,error.customer,error.source': 900, 'customer,error.customer': 900 };

        const answer = await provider.fill(GAP_CONTEXT, options);

        expect(requestedPaths()).toStrictEqual([undefined, GAP_PATHS, ['customer', 'error.customer'], ['customer'], ['error.customer'], ['error.source']]);
        expect(answer).toStrictEqual({ customer: 'cus_1', error: MERGED_ERROR });
      });

      it('WHEN one missing path alone is too large THEN suggests the local CLI and destroys every session', async (): Promise<void> => {
        promptTokens = { whole: 900, 'customer,error.customer,error.source': 900, 'customer,error.customer': 900, customer: 900 };

        const error = await rejectionOf(provider.fill(GAP_CONTEXT, options));

        expect(error).toHaveProperty('message', 'This fixture is too large for the on-device model.');
        expect(clones).toHaveLength(0);
        expect(session.destroy).toHaveBeenCalledTimes(1);
      });

      it('WHEN a chunk answer is not JSON THEN rejects and destroys its clone', async (): Promise<void> => {
        const answerText = (): ReadableStream<string> => streamOf(['not json']);
        const brokenClone = async (): Promise<LanguageModelSession> => {
          const clone = languageModelSessionMock();

          vi.mocked(clone.promptStreaming).mockImplementation(answerText);
          clones.push(clone);

          return Promise.resolve(clone);
        };

        session = { ...session, clone: vi.fn(brokenClone) };
        vi.mocked(factory.create).mockResolvedValue(session);

        await expect(provider.fill(GAP_CONTEXT, options)).rejects.toThrow('not JSON');
        expect(clones[0]?.destroy).toHaveBeenCalledTimes(1);
      });
    });

    it('GIVEN a fixture too large for the model WHEN filled THEN suggests the local CLI', async (): Promise<void> => {
      vi.mocked(factory.create).mockRejectedValue(new DOMException('too big', 'QuotaExceededError'));

      const error = await rejectionOf(provider.fill(CONTEXT, options));

      expect(error).toHaveProperty('message', 'This fixture is too large for the on-device model.');
      expect(error).toHaveProperty('fix', 'Turn off "Use on-device Chrome AI" to fill it with the local CLI instead.');
    });

    it('GIVEN an answer that is not JSON WHEN filled THEN rejects and still destroys the session', async (): Promise<void> => {
      vi.mocked(factory.create).mockResolvedValue(session);
      vi.mocked(session.promptStreaming).mockReturnValue(streamOf(['not json']));

      const error = await rejectionOf(provider.fill(CONTEXT, options));

      expect(error).toHaveProperty('message', 'The on-device model answered with text that is not JSON.');
      expect(session.destroy).toHaveBeenCalledTimes(1);
    });

    it('GIVEN a model not downloaded yet WHEN filled THEN rejects without starting the download', async (): Promise<void> => {
      vi.mocked(factory.availability).mockResolvedValue('downloadable');

      const error = await rejectionOf(provider.fill(CONTEXT, options));

      expect(error).toHaveProperty('message', 'The on-device model is not downloaded yet.');
      expect(factory.create).not.toHaveBeenCalled();
    });

    it('GIVEN the Prompt API WHEN the model is downloaded THEN creates a session only to drop it', async (): Promise<void> => {
      vi.mocked(factory.create).mockResolvedValue(session);

      await provider.download(options);

      expect(session.destroy).toHaveBeenCalledTimes(1);
      expect(session.promptStreaming).not.toHaveBeenCalled();
    });

    it('GIVEN another failure WHEN filled THEN passes it through', async (): Promise<void> => {
      const failure = new Error('aborted');

      vi.mocked(factory.create).mockRejectedValue(failure);

      await expect(provider.fill(CONTEXT, options)).rejects.toBe(failure);
    });
  });

  it('GIVEN a browser without the Prompt API WHEN filled THEN rejects pointing at the local CLI', async (): Promise<void> => {
    vi.stubGlobal('LanguageModel', undefined);

    const error = await rejectionOf(provider.fill(CONTEXT, options));

    expect(error).toHaveProperty('message', 'This browser has no on-device Chrome AI.');
  });

  it('GIVEN a browser without the Prompt API WHEN the model is downloaded THEN rejects pointing at the local CLI', async (): Promise<void> => {
    vi.stubGlobal('LanguageModel', undefined);

    const error = await rejectionOf(provider.download(options));

    expect(error).toHaveProperty('fix', 'Turn off "Use on-device Chrome AI" to fill it with the local CLI instead.');
  });
});
