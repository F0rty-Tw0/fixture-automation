import { HttpErrorResponse } from '@angular/common/http';

import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';

import { parseJsonOrUndefined } from '../../json/utils/json.util.ts';
import { isRecord } from '../../json/utils/record.util.ts';

const UNREACHABLE_ERROR: ApiErrorBody = {
  message: 'The Fixture Studio API did not answer.',
  fix: 'Start it with pnpm studio (it listens on 127.0.0.1:3333), then retry.'
};

/** A text response type (the `ai-fill` stream) hands the error body over as a string. */
const decodedBody = (body: unknown): unknown => {
  if (typeof body !== 'string') return body;

  return parseJsonOrUndefined(body);
};

const apiErrorBodyOf = (raw: unknown): ApiErrorBody | undefined => {
  const body = decodedBody(raw);

  if (!isRecord(body)) return undefined;

  const message = body['message'];
  const fix = body['fix'];

  if (typeof message !== 'string') return undefined;

  const fixLine = typeof fix === 'string' ? fix : undefined;
  const apiError: ApiErrorBody = { message, fix: fixLine };

  return apiError;
};

/** 0 is a network failure; the dev proxy answers 502/503/504 without a body when the API is down. */
const UNREACHABLE_STATUSES = [0, 502, 503, 504];

const httpApiError = (error: HttpErrorResponse): ApiErrorBody => {
  const apiError = apiErrorBodyOf(error.error);
  const isUnreachable = UNREACHABLE_STATUSES.includes(error.status);

  if (apiError !== undefined) return apiError;

  if (isUnreachable) return UNREACHABLE_ERROR;

  const bodyless: ApiErrorBody = {
    message: `The API answered ${error.status} ${error.statusText} without an error body.`,
    fix: UNREACHABLE_ERROR.fix
  };

  return bodyless;
};

const unexpectedBody = (message: string): ApiErrorBody => {
  const unexpected: ApiErrorBody = { message, fix: undefined };

  return unexpected;
};

/** What a failed HTTP call means to the user, whatever the transport threw. */
export const httpErrorBody = (error: unknown): ApiErrorBody => {
  if (error instanceof HttpErrorResponse) return httpApiError(error);

  if (error instanceof Error) return unexpectedBody(error.message);

  return unexpectedBody('The request failed for an unknown reason.');
};

/** Maps a resource error (a `StudioEngineFailure` when the engine failed) to the `{ message, fix }` pair the UI shows. */
export const toApiError = (error: Error | undefined): ApiErrorBody | undefined => {
  if (error === undefined) return undefined;

  const fix = 'fix' in error ? error.fix : undefined;
  const fixLine = typeof fix === 'string' ? fix : undefined;
  const apiError: ApiErrorBody = { message: error.message, fix: fixLine };

  return apiError;
};
