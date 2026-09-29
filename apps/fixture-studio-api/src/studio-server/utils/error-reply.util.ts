import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import type { ApiErrorBody } from '../../contract/common/studio-api.type.ts';
import type { ErrorReply } from '../common/studio-server.type.ts';

const INTERNAL_ERROR_BODY: ApiErrorBody = { message: 'internal error', fix: undefined };
const INTERNAL_ERROR: ErrorReply = { statusCode: 500, body: INTERNAL_ERROR_BODY };

const statusOf = (error: unknown): number | undefined => {
  if (!isRecord(error)) return undefined;

  const { statusCode } = error;

  if (typeof statusCode !== 'number') return undefined;

  return statusCode;
};

const clientStatus = (error: unknown): number | undefined => {
  const statusCode = statusOf(error);

  if (statusCode === undefined) return undefined;

  const isClientError = statusCode >= 400 && statusCode < 500;

  if (!isClientError) return undefined;

  return statusCode;
};

/**
 * Maps a thrown error to the status and `ApiErrorBody` the API answers with.
 * `FixtureError` keeps its `fix` and answers 400 unless it carries its own `statusCode`;
 * Fastify's own 4xx errors (schema validation, bad JSON, body too large) keep their status; anything else hides behind a 500.
 */
export const errorReply = (error: unknown): ErrorReply => {
  if (error instanceof FixtureError) {
    const fixtureBody: ApiErrorBody = { message: error.message, fix: error.fix };
    const fixtureReply: ErrorReply = { statusCode: statusOf(error) ?? 400, body: fixtureBody };

    return fixtureReply;
  }

  const statusCode = clientStatus(error);
  const isKnownClientError = statusCode !== undefined && error instanceof Error;

  if (!isKnownClientError) return INTERNAL_ERROR;

  const clientBody: ApiErrorBody = { message: error.message, fix: undefined };
  const clientReply: ErrorReply = { statusCode, body: clientBody };

  return clientReply;
};
