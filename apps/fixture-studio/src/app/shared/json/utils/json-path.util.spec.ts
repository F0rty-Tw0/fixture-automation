import { describe, expect, it } from 'vitest';

import { pathSegments, valueAt, withValueAt } from './json-path.util.ts';

describe('FEATURE: JSON paths', (): void => {
  describe('GIVEN path text', (): void => {
    it.each([
      ['a dotted path', 'customer.address.city', ['customer', 'address', 'city']],
      ['a path with array indices', 'lines[0].items[12].sku', ['lines', '0', 'items', '12', 'sku']],
      ['a JSON pointer', '/customer/lines/0', ['customer', 'lines', '0']],
      ['a pointer with escaped characters', '/a~1b/c~0d', ['a/b', 'c~d']],
      ['the root pointer', '/', []],
      ['a pointer through an empty key', '/a//b', ['a', '', 'b']],
      ['an empty path', '', []]
    ])('WHEN %s is split THEN returns its segments', (_label, path, segments): void => {
      expect(pathSegments(path)).toStrictEqual(segments);
    });
  });

  describe('GIVEN a nested value', (): void => {
    const LINE = { sku: 'A-1' };
    const CUSTOMER = { id: 'cus_1' };
    const VALUE = { customer: CUSTOMER, lines: [LINE] };

    it.each([
      ['an object property', ['customer', 'id'], 'cus_1'],
      ['an array item property', ['lines', '0', 'sku'], 'A-1'],
      ['an absent property', ['customer', 'name'], undefined],
      ['a path through a scalar', ['customer', 'id', 'x'], undefined],
      ['no segments', [], VALUE]
    ])('WHEN %s is read THEN returns its value', (_label, segments, expected): void => {
      expect(valueAt(VALUE, segments)).toStrictEqual(expected);
    });
  });

  describe('GIVEN a record to write into', (): void => {
    it('WHEN a nested object path is written THEN creates the missing objects and leaves the input alone', (): void => {
      const root = { id: 'in_1' };

      const address = { city: 'Oslo' };
      const customer = { address };

      const written = withValueAt(root, ['customer', 'address', 'city'], 'Oslo');

      expect(written).toStrictEqual({ id: 'in_1', customer });
      expect(root).toStrictEqual({ id: 'in_1' });
    });

    it('WHEN an array index path is written THEN creates or copies the array', (): void => {
      const line = { sku: 'A-1' };
      const lines = [line];
      const root = { lines };
      const counted = { sku: 'A-1', qty: 2 };
      const countedLines = [counted];

      const written = withValueAt(root, ['lines', '0', 'qty'], 2);

      expect(written).toStrictEqual({ lines: countedLines });
      expect(line).toStrictEqual({ sku: 'A-1' });
    });

    it('WHEN an index under an absent key is written THEN creates an array', (): void => {
      const written = withValueAt({}, ['tags', '0'], 'vip');

      expect(written).toStrictEqual({ tags: ['vip'] });
    });

    it('WHEN no segments are given THEN returns the record unchanged', (): void => {
      const root = { id: 'in_1' };

      expect(withValueAt(root, [], 'x')).toBe(root);
    });

    it('WHEN an item of a list is written THEN keeps the list a list', (): void => {
      const first = { id: 'in_1' };
      const list = [first, first];

      const written = withValueAt(list, ['1', 'created'], 2);

      expect(written).toStrictEqual([first, { id: 'in_1', created: 2 }]);
    });
  });
});
