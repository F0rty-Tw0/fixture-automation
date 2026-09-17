import { describe, expect, it } from 'vitest';

import { errorMessage } from './error-message.util.ts';

describe('FEATURE: error message extraction', (): void => {
  describe('GIVEN an Error', (): void => {
    it('WHEN rendered THEN returns its message', (): void => {
      expect(errorMessage(new TypeError('bad input'))).toBe('bad input');
    });
  });

  describe('GIVEN a thrown value that is not an Error', (): void => {
    it.each([
      ['boom', 'boom'],
      [42, '42'],
      [undefined, 'undefined']
    ])('WHEN %s is rendered THEN returns it as text', (thrown: unknown, expected: string): void => {
      expect(errorMessage(thrown)).toBe(expected);
    });
  });
});
