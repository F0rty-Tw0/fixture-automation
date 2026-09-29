import { HttpErrorResponse } from '@angular/common/http';

import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { httpErrorBody, toApiError } from './api-error.util.ts';
import type { StudioEngineFailure } from '../../studio-engine/common/engine.type.ts';

const httpError = (status: number, error: unknown): HttpErrorResponse => {
  return new HttpErrorResponse({ status, statusText: 'Bad Gateway', error, url: '/api/specs' });
};

describe('FEATURE: HTTP failure mapping', (): void => {
  describe('GIVEN an HTTP error with an API body', (): void => {
    it('WHEN the body has a fix THEN keeps message and fix', (): void => {
      const expected: ApiErrorBody = { message: 'Spec is not OpenAPI 3.', fix: 'Convert it first.' };

      expect(httpErrorBody(httpError(400, expected))).toStrictEqual(expected);
    });

    it('WHEN the body has no fix THEN leaves the fix empty', (): void => {
      const expected: ApiErrorBody = { message: 'spec not found', fix: undefined };

      expect(httpErrorBody(httpError(404, { message: 'spec not found' }))).toStrictEqual(expected);
    });

    it('WHEN the body arrives as JSON text (a text response type) THEN reads it the same way', (): void => {
      const expected: ApiErrorBody = { message: 'too many AI CLI runs at once', fix: 'Retry.' };

      expect(httpErrorBody(httpError(429, JSON.stringify(expected)))).toStrictEqual(expected);
    });

    it('WHEN the status is a gateway error THEN still keeps the API message', (): void => {
      const expected: ApiErrorBody = { message: 'Spec host timed out.', fix: 'Retry later.' };

      expect(httpErrorBody(httpError(502, expected))).toStrictEqual(expected);
    });
  });

  describe.each([0, 502, 503, 504])('GIVEN a body-less %i (API down or proxy failing)', (status): void => {
    it('WHEN mapping THEN says the API did not answer', (): void => {
      const apiError = httpErrorBody(httpError(status, 'Bad gateway'));

      expect(apiError.message).toBe('The Fixture Studio API did not answer.');
    });
  });

  describe.each([
    ['a text body', 'Server exploded'],
    ['a body without a message', { detail: 'x' }]
  ])('GIVEN a 500 with %s', (_label, body): void => {
    it('WHEN mapping THEN names the status and points at the API', (): void => {
      const apiError = httpErrorBody(httpError(500, body));

      expect(apiError.message).toBe('The API answered 500 Bad Gateway without an error body.');
    });
  });

  it('GIVEN a plain Error WHEN mapping THEN keeps its message', (): void => {
    const expected: ApiErrorBody = { message: 'boom', fix: undefined };

    expect(httpErrorBody(new Error('boom'))).toStrictEqual(expected);
  });

  it('GIVEN a non-Error throw WHEN mapping THEN says the reason is unknown', (): void => {
    expect(httpErrorBody('nope').message).toBe('The request failed for an unknown reason.');
  });
});

describe('FEATURE: engine error mapping', (): void => {
  it('GIVEN no error WHEN mapping THEN returns nothing', (): void => {
    expect(toApiError(undefined)).toBeUndefined();
  });

  it('GIVEN a StudioEngineFailure WHEN mapping THEN returns its message and fix', (): void => {
    const expected: ApiErrorBody = { message: 'spec not found', fix: 'Reload the spec.' };
    const failure: StudioEngineFailure = Object.assign(new Error('spec not found'), { fix: 'Reload the spec.' });

    expect(toApiError(failure)).toStrictEqual(expected);
  });

  it('GIVEN an error without a body WHEN mapping THEN keeps its message', (): void => {
    const expected: ApiErrorBody = { message: 'boom', fix: undefined };

    expect(toApiError(new Error('boom'))).toStrictEqual(expected);
  });
});
