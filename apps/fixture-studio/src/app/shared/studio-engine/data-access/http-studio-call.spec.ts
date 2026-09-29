import { HttpErrorResponse } from '@angular/common/http';

import { Subject, of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { untilAborted } from './http-studio-call.ts';
import { rejectionOf } from '../../../test/utils/promise.spec.util.ts';

describe('FEATURE: abortable observable calls', (): void => {
  it('GIVEN a source that emits WHEN awaited THEN resolves its first value', async (): Promise<void> => {
    const signal = new AbortController().signal;

    await expect(untilAborted(of(42), signal)).resolves.toBe(42);
  });

  it('GIVEN an already aborted signal WHEN awaited THEN rejects at once and leaves no subscription', async (): Promise<void> => {
    const controller = new AbortController();
    const source$ = new Subject<number>();

    controller.abort('too late');
    const reason = await rejectionOf(untilAborted(source$, controller.signal));

    expect(reason).toBe('too late');
    expect(source$.observed).toBe(false);
  });

  it('GIVEN a source that errors WHEN awaited THEN rejects with the message and fix, keeping the cause', async (): Promise<void> => {
    const source$ = new Subject<number>();
    const body = { message: 'Bad spec', fix: 'Fix it.' };
    const cause = new HttpErrorResponse({ status: 400, error: body });
    const pending = untilAborted(source$, new AbortController().signal);

    source$.error(cause);
    const error = await rejectionOf(pending);

    expect(error).toHaveProperty('message', 'Bad spec');
    expect(error).toHaveProperty('fix', 'Fix it.');
    expect(error).toHaveProperty('cause', cause);
  });
});
