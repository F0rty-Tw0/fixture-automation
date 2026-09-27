import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { errorReply } from './error-reply.util.ts';
import type { ErrorReply } from '../common/studio-server.type.ts';
import type { ApiErrorBody } from '../contract/common/studio-api.type.ts';

const INTERNAL_BODY: ApiErrorBody = { message: 'internal error', fix: undefined };
const INTERNAL_REPLY: ErrorReply = { statusCode: 500, body: INTERNAL_BODY };

const clientError = (message: string, statusCode: unknown): Error => Object.assign(new Error(message), { statusCode });

describe('FEATURE: error reply', (): void => {
  describe('GIVEN a FixtureError', (): void => {
    it('WHEN it has a fix THEN answers 400 with message and fix', (): void => {
      const body: ApiErrorBody = { message: 'schema not found: x', fix: 'did you mean y?' };

      const reply = errorReply(new FixtureError('schema not found: x', 'did you mean y?'));

      expect(reply).toStrictEqual({ statusCode: 400, body });
    });

    it('WHEN it carries its own status THEN answers with that status', (): void => {
      const body: ApiErrorBody = { message: 'spec not found', fix: 'reload' };
      const error = Object.assign(new FixtureError('spec not found', 'reload'), { statusCode: 404 });

      const reply = errorReply(error);

      expect(reply).toStrictEqual({ statusCode: 404, body });
    });

    it('WHEN it has no fix THEN answers 400 with an undefined fix', (): void => {
      const body: ApiErrorBody = { message: 'bad spec', fix: undefined };

      const reply = errorReply(new FixtureError('bad spec'));

      expect(reply).toStrictEqual({ statusCode: 400, body });
    });
  });

  describe('GIVEN a Fastify client error', (): void => {
    it.each([400, 413, 499])('WHEN its status is %i THEN keeps the status and message', (statusCode: number): void => {
      const body: ApiErrorBody = { message: 'body/url Invalid URL', fix: undefined };

      const reply = errorReply(clientError('body/url Invalid URL', statusCode));

      expect(reply).toStrictEqual({ statusCode, body });
    });
  });

  describe('GIVEN anything else', (): void => {
    it.each([
      ['a plain Error', new Error('database password is hunter2')],
      ['a 500 status error', clientError('boom', 500)],
      ['a 399 status error', clientError('odd', 399)],
      ['a non-numeric status', clientError('odd', '400')],
      ['a thrown string', 'boom'],
      ['a status-carrying non-Error', { statusCode: 400, message: 'fake' }]
    ])('WHEN it is %s THEN answers 500 without leaking the message', (_label: string, error: unknown): void => {
      const reply = errorReply(error);

      expect(reply).toStrictEqual(INTERNAL_REPLY);
    });
  });
});
