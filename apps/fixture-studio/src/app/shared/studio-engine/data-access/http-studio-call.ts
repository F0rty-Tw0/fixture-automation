import { Observable, catchError, firstValueFrom, race, throwError } from 'rxjs';

import { httpErrorBody } from '../../api-error/utils/api-error.util.ts';
import type { StudioEngineFailure } from '../common/engine.type.ts';

/** A rejection that keeps the transport error as `cause` and carries the user-facing message and fix. */
const engineFailure = (error: unknown): StudioEngineFailure => {
  const apiError = httpErrorBody(error);
  const failure: StudioEngineFailure = Object.assign(new Error(apiError.message, { cause: error }), { fix: apiError.fix });

  return failure;
};

/** Errors with the signal's reason once it aborts (at once when it already has). */
export const abortOf$ = (signal: AbortSignal): Observable<never> => {
  return new Observable<never>((subscriber) => {
    const abort = (): void => subscriber.error(signal.reason);

    if (signal.aborted) {
      abort();

      return undefined;
    }

    signal.addEventListener('abort', abort, { once: true });

    return (): void => signal.removeEventListener('abort', abort);
  });
};

/** Transport errors become engine failures; the abort reason passes through untouched. */
export const withEngineFailures$ = <TValue>(source$: Observable<TValue>): Observable<TValue> => {
  const fail = (error: unknown): Observable<never> => throwError(() => engineFailure(error));

  return source$.pipe(catchError(fail));
};

/** The first value of `source$`; aborting `signal` unsubscribes (cancelling the request) and rejects with its reason. */
export const untilAborted = async <TValue>(source$: Observable<TValue>, signal: AbortSignal): Promise<TValue> => {
  const request$ = withEngineFailures$(source$);

  return firstValueFrom(race(request$, abortOf$(signal)));
};
