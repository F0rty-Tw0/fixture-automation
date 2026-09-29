import { HttpEventType, HttpResponse } from '@angular/common/http';
import type { HttpEvent } from '@angular/common/http';

import type { AiFillProgressEvent } from '@fixture-automation/fixture-studio-api/contract';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { readFillStream } from './http-studio-stream.ts';
import { rejectionOf } from '../../../test/utils/promise.spec.util.ts';
import type { EngineStreamCall } from '../common/engine.type.ts';

const PROGRESS_LINE = '{"type":"progress","stream":"stdout","text":"thinking"}\n';
const RESULT_LINE = '{"type":"result","populated":{"status":"open"}}\n';
const POPULATED = { status: 'open' };

const partial = (partialText: string): HttpEvent<string> => {
  const event: HttpEvent<string> = { type: HttpEventType.DownloadProgress, loaded: partialText.length, partialText };

  return event;
};

describe('FEATURE: AI fill stream reader', (): void => {
  let events$: Subject<HttpEvent<string>>;
  let progress: AiFillProgressEvent[];
  let controller: AbortController;
  let call: EngineStreamCall;

  beforeEach((): void => {
    events$ = new Subject<HttpEvent<string>>();
    progress = [];
    controller = new AbortController();
    call = { signal: controller.signal, onProgress: (event): number => progress.push(event) };
  });

  describe('GIVEN a line cut across two chunks', (): void => {
    it('WHEN both chunks arrive THEN reports the line once, whole', async (): Promise<void> => {
      const reading = readFillStream(events$, call);
      const cut = 20;

      events$.next(partial(PROGRESS_LINE.slice(0, cut)));
      events$.next(partial(PROGRESS_LINE + RESULT_LINE));

      await expect(reading).resolves.toStrictEqual(POPULATED);
      expect(progress).toStrictEqual([{ type: 'progress', stream: 'stdout', text: 'thinking' }]);
    });
  });

  it('GIVEN an error line WHEN read THEN rejects with its message and fix', async (): Promise<void> => {
    const reading = readFillStream(events$, call);

    events$.next(partial('{"type":"error","message":"claude is not installed","fix":"Install it."}\n'));
    const error = await rejectionOf(reading);

    expect(error).toHaveProperty('message', 'claude is not installed');
    expect(error).toHaveProperty('fix', 'Install it.');
  });

  it('GIVEN the result only in the final response body WHEN the response ends THEN resolves it', async (): Promise<void> => {
    const reading = readFillStream(events$, call);
    const body = PROGRESS_LINE + RESULT_LINE.trimEnd();

    events$.next(partial(PROGRESS_LINE));
    events$.next(new HttpResponse({ body }));

    await expect(reading).resolves.toStrictEqual(POPULATED);
  });

  it('GIVEN a stream without a result WHEN it ends THEN rejects', async (): Promise<void> => {
    const reading = readFillStream(events$, call);

    events$.next(new HttpResponse({ body: PROGRESS_LINE }));
    const error = await rejectionOf(reading);

    expect(error).toHaveProperty('message', 'The AI fill stream ended without a result.');
  });

  it('GIVEN an unreadable line WHEN read THEN skips it', async (): Promise<void> => {
    const reading = readFillStream(events$, call);

    events$.next(partial(`not json\n${RESULT_LINE}`));

    await expect(reading).resolves.toStrictEqual(POPULATED);
  });

  it('GIVEN a running stream WHEN aborted THEN unsubscribes and rejects with the reason', async (): Promise<void> => {
    const reading = readFillStream(events$, call);

    controller.abort('cancelled');
    const reason = await rejectionOf(reading);

    expect(reason).toBe('cancelled');
    expect(events$.observed).toBe(false);
  });

  it('GIVEN a transport error WHEN read THEN rejects with the mapped failure', async (): Promise<void> => {
    const reading = readFillStream(events$, call);

    events$.error(new Error('socket closed'));
    const error = await rejectionOf(reading);

    expect(error).toHaveProperty('message', 'socket closed');
  });
});
