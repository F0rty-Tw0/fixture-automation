import type { AiFixtureProgress } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { aiFillStream } from './ai-fill-stream.ts';
import type { AiFillJob } from '../common/ai.type.ts';
import { ndjsonLines, streamText } from '../test/utils/ndjson.spec.util.ts';

type ProgressSink = (progress: AiFixtureProgress) => void;

const POPULATED = { status: 'open' };

const progressJob = (texts: string[]): AiFillJob => {
  const job: AiFillJob = async (_signal: AbortSignal, onProgress: ProgressSink): Promise<Record<string, unknown>> => {
    for (const text of texts) onProgress({ stream: 'stderr', text });

    return Promise.resolve(POPULATED);
  };

  return job;
};

const failingJob = (error: unknown): AiFillJob => {
  const job: AiFillJob = async (): Promise<Record<string, unknown>> => Promise.reject(error);

  return job;
};

describe('FEATURE: AI fill stream', (): void => {
  describe('GIVEN a job that reports progress and succeeds', (): void => {
    it('WHEN read THEN frames one JSON event per line, progress first and the result last', async (): Promise<void> => {
      const stream = aiFillStream(progressJob(['one\n', 'two\n']), new AbortController());

      const text = await streamText(stream);

      expect(text.endsWith('\n')).toBe(true);
      expect(ndjsonLines(text)).toStrictEqual([
        { type: 'progress', stream: 'stderr', text: 'one\n' },
        { type: 'progress', stream: 'stderr', text: 'two\n' },
        { type: 'result', populated: POPULATED }
      ]);
    });

    it('WHEN progress carries terminal codes THEN they are stripped and empty remainders are dropped', async (): Promise<void> => {
      const stream = aiFillStream(progressJob(['\u001B[32mgreen\u001B[0m\tok\n', '\u001B[0m', '\u0007']), new AbortController());

      const lines = ndjsonLines(await streamText(stream));

      expect(lines).toStrictEqual([
        { type: 'progress', stream: 'stderr', text: 'green\tok\n' },
        { type: 'result', populated: POPULATED }
      ]);
    });
  });

  describe('GIVEN a job that fails', (): void => {
    it.each<[string, unknown, Record<string, unknown>]>([
      ['a FixtureError', new FixtureError('bad tool', 'use codex'), { type: 'error', message: 'bad tool', fix: 'use codex' }],
      ['a plain Error', new Error('claude exited 1'), { type: 'error', message: 'claude exited 1' }],
      ['a non-Error', 'boom', { type: 'error', message: 'AI fill failed' }]
    ])(
      'WHEN it throws %s THEN the last line is an error event',
      async (_label: string, error: unknown, expected: Record<string, unknown>): Promise<void> => {
        const stream = aiFillStream(failingJob(error), new AbortController());

        const lines = ndjsonLines(await streamText(stream));

        expect(lines).toStrictEqual([expected]);
      }
    );
  });

  describe('GIVEN a running job', (): void => {
    it('WHEN the stream is cancelled THEN the job signal aborts and late progress neither throws nor emits', async (): Promise<void> => {
      const controller = new AbortController();
      let lateProgressThrew = false;
      let settle: () => void = (): void => undefined;
      const settled = new Promise<void>((resolve): void => {
        settle = resolve;
      });

      const job: AiFillJob = async (signal: AbortSignal, onProgress: ProgressSink): Promise<Record<string, unknown>> => {
        const pending = new Promise<Record<string, unknown>>((_resolve, reject): void => {
          const onAbort = (): void => {
            try {
              onProgress({ stream: 'stdout', text: 'late\n' });
            } catch {
              lateProgressThrew = true;
            }

            reject(new Error('aborted'));
            settle();
          };

          signal.addEventListener('abort', onAbort, { once: true });
        });

        return pending;
      };
      const stream = aiFillStream(job, controller);

      await stream.cancel('client gone');
      await settled;

      expect(controller.signal.aborted).toBe(true);
      expect(controller.signal.reason).toBe('client gone');
      expect(lateProgressThrew).toBe(false);
    });

    it('WHEN the signal aborts without a cancel THEN the stream closes without an error line', async (): Promise<void> => {
      const controller = new AbortController();
      const job: AiFillJob = async (signal: AbortSignal): Promise<Record<string, unknown>> => {
        const pending = new Promise<Record<string, unknown>>((_resolve, reject): void => {
          signal.addEventListener('abort', (): void => reject(new Error('aborted')), { once: true });
        });

        return pending;
      };
      const stream = aiFillStream(job, controller);

      controller.abort();

      const text = await streamText(stream);

      expect(text).toBe('');
    });
  });
});
