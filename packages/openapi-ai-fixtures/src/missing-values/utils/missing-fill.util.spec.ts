import { describe, expect, it } from 'vitest';

import { absentPaths, isListFill, isMissingFill, missingOnly } from './missing-fill.util.ts';

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

  describe('GIVEN an answer holding more than the missing paths', (): void => {
    it('WHEN trimmed THEN keeps only the missing values, other items stay holes', (): void => {
      const lines = [{ qty: 'bad' }, { qty: 1, sku: 'x' }, { junk: true }];
      const answer = { id: 'extra', lines };

      const fill = missingOnly(answer, ['lines[1].qty']);

      expect(JSON.stringify(fill)).toBe('{"lines":[null,{"qty":1}]}');
    });

    it('WHEN a missing path is absent from the answer THEN it is left out', (): void => {
      const fill = missingOnly({ id: 'in_1' }, ['id', 'memo']);

      expect(fill).toStrictEqual({ id: 'in_1' });
    });

    it('WHEN the paths start at an index THEN the trimmed fill is a list', (): void => {
      const fill = missingOnly([{ status: 'open', id: 'a' }], ['[0].status']);

      expect(fill).toStrictEqual([{ status: 'open' }]);
    });
  });

  describe('GIVEN an answer checked for every missing path', (): void => {
    it('WHEN a path has no value THEN lists it, keeping null as a value', (): void => {
      const lines = [{ qty: null }];
      const answer = { lines };

      const absent = absentPaths(answer, ['lines[0].qty', 'lines[1].note', 'id']);

      expect(absent).toStrictEqual(['lines[1].note', 'id']);
    });
  });
});
