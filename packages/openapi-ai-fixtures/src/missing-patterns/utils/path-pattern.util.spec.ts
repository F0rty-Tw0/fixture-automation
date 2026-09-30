import { describe, expect, it } from 'vitest';

import { missingPatterns, pathPattern } from './path-pattern.util.ts';
import type { MissingPattern } from '../common/missing-pattern.type.ts';

const OBJECT_PATHS = ['lines[0].qty', 'status', 'lines[0].sku', 'lines[1].qty', 'lines[1].sku', 'customer.email'];
const LIST_PATHS = ['[0].id', '[1].id', '[0].tags[2]', '[1].tags[0]'];
const NESTED_PATHS = ['a[1].b[0].c', 'a[0].b[3].c', 'a[1].d'];

describe('FEATURE: missing path patterns', (): void => {
  describe('GIVEN a single path', (): void => {
    it.each([
      ['lines[2].qty', 'lines[*].qty'],
      ['[3].id', '[*].id'],
      ['a[1].b[0].c', 'a[*].b[*].c'],
      ['matrix[10][2]', 'matrix[*][*]'],
      ['customer.email', 'customer.email']
    ])('WHEN %s is turned into a pattern THEN it reads %s', (path: string, expected: string): void => {
      const pattern = pathPattern(path);

      expect(pattern).toBe(expected);
    });
  });

  describe('GIVEN the missing paths of an object fixture', (): void => {
    it('WHEN grouped THEN each pattern appears once in first-seen order with its paths in input order', (): void => {
      const lineQuantities: MissingPattern = { pattern: 'lines[*].qty', paths: ['lines[0].qty', 'lines[1].qty'] };
      const status: MissingPattern = { pattern: 'status', paths: ['status'] };
      const lineSkus: MissingPattern = { pattern: 'lines[*].sku', paths: ['lines[0].sku', 'lines[1].sku'] };
      const email: MissingPattern = { pattern: 'customer.email', paths: ['customer.email'] };

      const patterns = missingPatterns(OBJECT_PATHS);

      expect(patterns).toStrictEqual([lineQuantities, status, lineSkus, email]);
    });
  });

  describe('GIVEN the missing paths of a list fixture', (): void => {
    it('WHEN grouped THEN root indices collapse too', (): void => {
      const ids: MissingPattern = { pattern: '[*].id', paths: ['[0].id', '[1].id'] };
      const tags: MissingPattern = { pattern: '[*].tags[*]', paths: ['[0].tags[2]', '[1].tags[0]'] };

      const patterns = missingPatterns(LIST_PATHS);

      expect(patterns).toStrictEqual([ids, tags]);
    });
  });

  describe('GIVEN paths inside nested arrays', (): void => {
    it('WHEN grouped THEN every index level collapses', (): void => {
      const deep: MissingPattern = { pattern: 'a[*].b[*].c', paths: ['a[1].b[0].c', 'a[0].b[3].c'] };
      const shallow: MissingPattern = { pattern: 'a[*].d', paths: ['a[1].d'] };

      const patterns = missingPatterns(NESTED_PATHS);

      expect(patterns).toStrictEqual([deep, shallow]);
    });
  });

  describe('GIVEN no missing paths', (): void => {
    it('WHEN grouped THEN there are no patterns', (): void => {
      const patterns = missingPatterns([]);

      expect(patterns).toStrictEqual([]);
    });
  });
});
