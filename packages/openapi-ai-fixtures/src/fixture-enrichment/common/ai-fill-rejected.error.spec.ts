import { describe, expect, it } from 'vitest';

import { AiFillRejectedError } from './ai-fill-rejected.error.ts';

const FIRST = { status: 'paid' };
const SECOND = { status: 'void' };

describe('FEATURE: AI fill rejected error', (): void => {
  describe('GIVEN a message, the parsed candidates and the problem', (): void => {
    describe('WHEN constructing the error', (): void => {
      const error = new AiFillRejectedError('fill rejected', [FIRST, SECOND], '/status: must be open');

      it('THEN is an Error named AiFillRejectedError', (): void => {
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('AiFillRejectedError');
      });

      it('THEN keeps the message', (): void => {
        expect(error.message).toBe('fill rejected');
      });

      it('THEN keeps every candidate in attempt order', (): void => {
        expect(error.candidates).toStrictEqual([FIRST, SECOND]);
      });

      it('THEN keeps the problem', (): void => {
        expect(error.problem).toBe('/status: must be open');
      });
    });
  });

  describe('GIVEN error options with a cause', (): void => {
    it('WHEN constructing the error THEN forwards the cause', (): void => {
      const cause = new SyntaxError('Unexpected token');

      const error = new AiFillRejectedError('fill rejected', [], 'not JSON', { cause });

      expect(error.cause).toBe(cause);
    });
  });
});
