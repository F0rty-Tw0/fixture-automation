import { stripVTControlCharacters } from 'node:util';

import type { AiFixtureProgress } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';

import type { AiFillErrorEvent, AiFillEvent, AiFillProgressEvent, AiFillResultEvent } from '../../contract/common/studio-api.type.ts';
import type { AiFillJob } from '../common/ai.type.ts';

const keepLayout = (character: string): string => (character === '\n' || character === '\t' ? character : '');

const plainText = (text: string): string => {
  const stripped = stripVTControlCharacters(text);

  return stripped.replace(/\p{Cc}/gu, keepLayout);
};

const errorEvent = (error: unknown): AiFillErrorEvent => {
  const message = error instanceof Error ? error.message : 'AI fill failed';
  const fix = error instanceof FixtureError ? error.fix : undefined;
  const event: AiFillErrorEvent = { type: 'error', message, fix };

  return event;
};

/**
 * Runs one AI fill and frames it as NDJSON: `progress` lines while it runs, then one `result` or `error` line.
 * Cancelling the stream aborts `controller`, which terminates the CLI process tree; `onProgress` never throws,
 * because a throwing callback would cancel the run.
 */
export const aiFillStream = (job: AiFillJob, controller: AbortController): ReadableStream<string> => {
  let isOpen = true;
  let streamController: ReadableStreamDefaultController<string> | undefined;

  const push = (event: AiFillEvent): void => {
    if (!isOpen) return;

    streamController?.enqueue(`${JSON.stringify(event)}\n`);
  };

  const onProgress = (progress: AiFixtureProgress): void => {
    try {
      const text = plainText(progress.text);

      if (text.length === 0) return;

      const event: AiFillProgressEvent = { type: 'progress', stream: progress.stream, text };

      push(event);
    } catch {
      return;
    }
  };

  const run = async (): Promise<void> => {
    try {
      const { populated, sources, notes } = await job(controller.signal, onProgress);
      const event: AiFillResultEvent = { type: 'result', populated, sources, notes };

      push(event);
    } catch (error: unknown) {
      if (!controller.signal.aborted) push(errorEvent(error));
    }

    if (!isOpen) return;

    isOpen = false;
    streamController?.close();
  };

  const stream = new ReadableStream<string>({
    start(startController: ReadableStreamDefaultController<string>): void {
      streamController = startController;
      void run();
    },
    cancel(reason: unknown): void {
      isOpen = false;
      controller.abort(reason);
    }
  });

  return stream;
};
