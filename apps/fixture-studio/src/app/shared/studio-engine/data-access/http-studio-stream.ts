import { HttpEventType } from '@angular/common/http';
import type { HttpEvent } from '@angular/common/http';

import type { AiFillEvent, AiFillProgressEvent } from '@fixture-automation/fixture-studio-api/contract';
import { EmptyError, catchError, concatMap, filter, first, firstValueFrom, map, race, takeWhile, tap, throwError } from 'rxjs';
import type { Observable } from 'rxjs';

import { abortOf$, withEngineFailures$ } from './http-studio-call.ts';
import type { EngineStreamCall, StudioEngineFailure } from '../common/engine.type.ts';
import { parseFillEvent, splitNdjson } from '../utils/ndjson.util.ts';

type Populated = Record<string, unknown>;

type OutcomeEvent = Exclude<AiFillEvent, AiFillProgressEvent>;

const NO_RESULT = 'The AI fill stream ended without a result.';

const streamFailure = (message: string, fix: string | undefined): StudioEngineFailure => {
  const failure: StudioEngineFailure = Object.assign(new Error(message), { fix });

  return failure;
};

const isOutcome = (event: AiFillEvent): event is OutcomeEvent => event.type !== 'progress';

const populatedOf = (event: OutcomeEvent): Populated => {
  if (event.type === 'error') throw streamFailure(event.message, event.fix);

  return event.populated;
};

const noResult = (error: unknown): Observable<never> => {
  if (!(error instanceof EmptyError)) return throwError(() => error);

  return throwError(() => streamFailure(NO_RESULT, undefined));
};

/**
 * Turns HTTP progress events into `ai-fill` events. `partialText` grows with every chunk, so only its
 * unseen tail is parsed; a line cut by a chunk boundary waits for the next chunk.
 */
const fillEvents$ = (events$: Observable<HttpEvent<string>>): Observable<AiFillEvent> => {
  let consumed = 0;
  let rest = '';

  const eventsIn = (text: string): AiFillEvent[] => {
    const split = splitNdjson(rest + text);
    const parsed = split.lines.map(parseFillEvent);

    rest = split.rest;

    return parsed.filter((event) => event !== undefined);
  };

  const eventsOf = (event: HttpEvent<string>): AiFillEvent[] => {
    if (event.type === HttpEventType.DownloadProgress) {
      const partial = event.partialText ?? '';
      const unseen = partial.slice(consumed);

      consumed = partial.length;

      return eventsIn(unseen);
    }

    if (event.type !== HttpEventType.Response) return [];

    const body = event.body ?? '';

    return eventsIn(`${body.slice(consumed)}\n`);
  };

  const isBeforeResponse = (event: HttpEvent<string>): boolean => event.type !== HttpEventType.Response;

  return events$.pipe(takeWhile(isBeforeResponse, true), concatMap(eventsOf));
};

/** Reads an `ai-fill` NDJSON response: progress goes to `onProgress`, a `result` resolves, an `error` rejects. */
export const readFillStream = async (events$: Observable<HttpEvent<string>>, call: EngineStreamCall): Promise<Populated> => {
  const reportProgress = (event: AiFillEvent): void => {
    if (event.type === 'progress') call.onProgress(event);
  };
  const outcome$ = fillEvents$(withEngineFailures$(events$)).pipe(tap(reportProgress), filter(isOutcome), first());
  const populated$ = outcome$.pipe(catchError(noResult), map(populatedOf));

  return firstValueFrom(race(populated$, abortOf$(call.signal)));
};
