import { describe, expect, it } from 'vitest';

import { pathPointer, pathTree, sampleAtPath, valueAtPath } from './fill-path.util.ts';
import type { PathValue } from '../common/ai.type.ts';

const LINES = [{ sku: 'a' }, { sku: 'b', tax: null }];
const ANSWER = { id: 'in_1', lines: LINES, memo: 'm' };
const SAMPLE_LINE = { sku: 'string', quantity: 0 };
const SAMPLE = { lines: [SAMPLE_LINE] };
const LIST_SAMPLE = [SAMPLE_LINE];

describe('FEATURE: fill paths', (): void => {
  describe('GIVEN a diff path', (): void => {
    it('WHEN turned into a pointer THEN keys and indices become escaped pointer tokens', (): void => {
      const pointer = pathPointer('a/b.lines[2].c~d');

      expect(pointer).toBe('/a~1b/lines/2/c~0d');
    });
  });

  describe('GIVEN an answer', (): void => {
    it('WHEN a present path is read THEN returns its value', (): void => {
      const value = valueAtPath(ANSWER, 'lines[1].sku');

      expect(value).toBe('b');
    });

    it('WHEN a path holding null is read THEN returns null', (): void => {
      const value = valueAtPath(ANSWER, 'lines[1].tax');

      expect(value).toBeNull();
    });

    it.each(['lines[2].sku', 'customer.email', 'memo.length', 'lines.sku'])(
      'WHEN the absent path %s is read THEN returns undefined',
      (path: string): void => {
        const value = valueAtPath(ANSWER, path);

        expect(value).toBeUndefined();
      }
    );
  });

  describe('GIVEN a sampler value with one element per array', (): void => {
    it('WHEN a path at a later index is read THEN reads the first element instead', (): void => {
      const value = sampleAtPath(SAMPLE, 'lines[3].quantity');

      expect(value).toBe(0);
    });

    it('WHEN a list sample is read at a later index THEN reads its first element', (): void => {
      const value = sampleAtPath(LIST_SAMPLE, '[4].sku');

      expect(value).toBe('string');
    });
  });

  describe('GIVEN values at concrete paths', (): void => {
    it('WHEN built into a tree THEN each lands at its path and skipped array slots stay holes', (): void => {
      const quantity: PathValue = { path: 'lines[2].quantity', value: 1 };
      const id: PathValue = { path: 'id', value: 'in_1' };
      const sku: PathValue = { path: 'lines[0].sku', value: 'a' };

      const tree = pathTree([quantity, id, sku], false);

      const json = JSON.stringify(tree);

      expect(json).toBe('{"lines":[{"sku":"a"},null,{"quantity":1}],"id":"in_1"}');
      expect(Object.keys(tree)).toStrictEqual(['lines', 'id']);
    });

    it('WHEN a skipped slot is checked THEN it holds no value, not even an empty object', (): void => {
      const quantity: PathValue = { path: 'lines[2].quantity', value: 1 };

      const tree = pathTree([quantity], false);

      const lines = valueAtPath(tree, 'lines');

      expect(Array.isArray(lines) && Object.hasOwn(lines, 0)).toBe(false);
    });

    it('WHEN the paths start at an index THEN the tree is a list', (): void => {
      const status: PathValue = { path: '[1].status', value: 'draft' };

      const tree = pathTree([status], true);

      expect(JSON.stringify(tree)).toBe('[null,{"status":"draft"}]');
    });

    it('WHEN nothing is given for a list THEN is an empty list', (): void => {
      const tree = pathTree([], true);

      expect(tree).toStrictEqual([]);
    });

    it('WHEN a later path needs another container type THEN replaces the earlier value', (): void => {
      const scalar: PathValue = { path: 'customer', value: 'cus_1' };
      const nested: PathValue = { path: 'customer.email', value: 'a@b.c' };

      const tree = pathTree([scalar, nested], false);

      const customer = { email: 'a@b.c' };

      expect(tree).toStrictEqual({ customer });
    });

    it('WHEN nothing is given THEN is an empty object', (): void => {
      const tree = pathTree([], false);

      expect(tree).toStrictEqual({});
    });
  });
});
