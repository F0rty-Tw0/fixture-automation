import type { AiFillProgressEvent } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { answerInClone, fitsContext } from './chrome-ai-session.client.ts';
import { languageModelSessionMock } from '../../test/mocks/browser.mock.ts';
import { AI_PROMPT_RESULT_STUB } from '../../test/stubs/studio.stub.ts';
import { rejectionOf } from '../../test/utils/promise.spec.util.ts';
import type { AiRunOptions } from '../common/ai-fill.type.ts';
import { streamOf } from '../test/utils/stream.spec.util.ts';

const SIGNAL = new AbortController().signal;
const CONSTRAINED_OPTIONS = { responseConstraint: AI_PROMPT_RESULT_STUB.responseSchema, omitResponseConstraintInput: true };

describe('FEATURE: on-device model session', (): void => {
  let progress: AiFillProgressEvent[];
  let options: AiRunOptions;

  beforeEach((): void => {
    progress = [];
    options = { signal: SIGNAL, onProgress: (event): number => progress.push(event), onDownload: vi.fn() };
  });

  describe('SCENARIO: fitting a prompt into the context window', (): void => {
    it('GIVEN a Chrome that cannot measure prompts WHEN asked THEN trusts the prompt to fit', async (): Promise<void> => {
      const session = languageModelSessionMock();

      await expect(fitsContext(session, AI_PROMPT_RESULT_STUB, SIGNAL)).resolves.toBe(true);
    });

    it.each([
      ['within three quarters of the window', 740, true],
      ['past three quarters of the window', 741, false]
    ])('GIVEN a prompt %s WHEN asked THEN answers %s', async (_label, promptTokens, expected): Promise<void> => {
      const measure = vi.fn(async (): Promise<number> => Promise.resolve(promptTokens));
      const plain = languageModelSessionMock();
      const session: LanguageModelSession = { ...plain, contextWindow: 1000, contextUsage: 10, measureContextUsage: measure };

      await expect(fitsContext(session, AI_PROMPT_RESULT_STUB, SIGNAL)).resolves.toBe(expected);
      expect(measure).toHaveBeenCalledWith(AI_PROMPT_RESULT_STUB.prompt, { signal: SIGNAL });
    });
  });

  describe('SCENARIO: answering in a clone', (): void => {
    it('GIVEN a session that clones WHEN answered THEN answers in the clone and destroys only the clone', async (): Promise<void> => {
      const clone = languageModelSessionMock();
      const plain = languageModelSessionMock();
      const base: LanguageModelSession = { ...plain, clone: vi.fn(async (): Promise<LanguageModelSession> => Promise.resolve(clone)) };

      vi.mocked(clone.promptStreaming).mockReturnValue(streamOf(['{"status":"open"}']));

      const answer = await answerInClone(base, AI_PROMPT_RESULT_STUB, options);

      expect(answer).toStrictEqual({ status: 'open' });
      expect(clone.promptStreaming).toHaveBeenCalledWith(AI_PROMPT_RESULT_STUB.prompt, expect.objectContaining(CONSTRAINED_OPTIONS));
      expect(clone.destroy).toHaveBeenCalledTimes(1);
      expect(base.destroy).not.toHaveBeenCalled();
    });

    it('GIVEN a Chrome without clone WHEN answered THEN answers in the base session and keeps it', async (): Promise<void> => {
      const base = languageModelSessionMock();

      vi.mocked(base.promptStreaming).mockReturnValue(streamOf(['{"status":"open"}']));

      await answerInClone(base, AI_PROMPT_RESULT_STUB, options);

      expect(base.destroy).not.toHaveBeenCalled();
    });

    it('GIVEN an answer that is not JSON WHEN answered THEN rejects pointing at the local CLI', async (): Promise<void> => {
      const base = languageModelSessionMock();

      vi.mocked(base.promptStreaming).mockReturnValue(streamOf(['not json']));

      const error = await rejectionOf(answerInClone(base, AI_PROMPT_RESULT_STUB, options));

      expect(error).toHaveProperty('message', 'The on-device model answered with text that is not JSON.');
      expect(progress.length).toBeGreaterThan(0);
    });
  });
});
