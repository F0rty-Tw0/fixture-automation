import { describe, expect, it } from 'vitest';

import { parseChoice } from './choice.util.ts';

const OPTIONS = ['json', 'ts', 'both'];

describe('FEATURE: numbered choice parsing', (): void => {
  describe('GIVEN three options', (): void => {
    it.each([
      ['1', 'json'],
      ['3', 'both'],
      [' 2 ', 'ts']
    ])('WHEN %s is answered THEN returns the matching option', (answer: string, expected: string): void => {
      expect(parseChoice(answer, OPTIONS)).toBe(expected);
    });

    it.each(['', 'json', '0', '4', '-1', '1.5'])('WHEN %s is answered THEN selects nothing', (answer: string): void => {
      expect(parseChoice(answer, OPTIONS)).toBeUndefined();
    });
  });
});
