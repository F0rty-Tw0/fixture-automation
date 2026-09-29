import { FixtureError } from '@fixture-automation/openapi-fixtures';

/** A `FixtureError` the error handler answers with `statusCode` instead of 400. */
export const statusError = (statusCode: number, message: string, fix: string): FixtureError => {
  const error = new FixtureError(message, fix);

  return Object.assign(error, { statusCode });
};
