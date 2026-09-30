import { describe, expect, it } from 'vitest';

import { isListFill, isMissingFill } from './missing-fill.util.ts';

describe('FEATURE: missing fill shape', (): void => {
  describe('GIVEN missing paths', (): void => {
    it.each<[string[], boolean]>([
      [['[0].status', '[2].id'], true],
      [['lines[0].sku', 'id'], false],
      [[], false]
    ])('WHEN %j is checked THEN a list fill is %s', (paths: string[], expected: boolean): void => {
      const isList = isListFill(paths);

      expect(isList).toBe(expected);
    });
  });

  describe('GIVEN a parsed answer', (): void => {
    it.each<[unknown, boolean, boolean]>([
      [{ status: 'open' }, false, true],
      [[{ status: 'open' }], false, false],
      [[{ status: 'open' }], true, true],
      [{ status: 'open' }, true, false],
      ['text', false, false]
    ])('WHEN %j is checked for a list fill of %s THEN it fits: %s', (value: unknown, isList: boolean, expected: boolean): void => {
      const fits = isMissingFill(value, isList);

      expect(fits).toBe(expected);
    });
  });
});
