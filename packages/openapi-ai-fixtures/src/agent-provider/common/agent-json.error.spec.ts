import { describe, expect, it } from 'vitest';

import { AgentJsonError } from './agent-json.error.ts';

describe('FEATURE: agent JSON error', (): void => {
  describe('GIVEN a message and the raw agent response', (): void => {
    describe('WHEN constructing the error', (): void => {
      const error = new AgentJsonError('not JSON', '{oops');

      it('THEN is an Error named AgentJsonError', (): void => {
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('AgentJsonError');
      });

      it('THEN keeps the message', (): void => {
        expect(error.message).toBe('not JSON');
      });

      it('THEN keeps the raw response', (): void => {
        expect(error.response).toBe('{oops');
      });

      it('THEN has no cause', (): void => {
        expect(error.cause).toBeUndefined();
      });
    });
  });

  describe('GIVEN error options with a cause', (): void => {
    it('WHEN constructing the error THEN forwards the cause', (): void => {
      const cause = new SyntaxError('Unexpected token');

      const error = new AgentJsonError('not JSON', '{oops', { cause });

      expect(error.cause).toBe(cause);
    });
  });
});
