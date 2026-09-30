import { describe, expect, it } from 'vitest';

import { deepFill } from './deep-fill.util.ts';
import type { FillOptions } from '../common/fixture-fill.type.ts';
import { holedArray } from '../test/utils/holed-array.spec.util.ts';

const KEEP_PRESENT: FillOptions = { keepPresent: true };
const TRAILING_HOLE = holedArray(
  3,
  new Map([
    [0, 'a'],
    [1, 'b']
  ])
);
const INNER_HOLE = holedArray(
  3,
  new Map([
    [0, 'a'],
    [2, 'c']
  ])
);

describe('FEATURE: deep fill of absent fixture fields', (): void => {
  describe('GIVEN a flat fixture missing one key', (): void => {
    it('WHEN filling THEN it copies the key and records the path', (): void => {
      const base = { id: 'in_1', amount_due: 100 };
      const fill = { status: 'open' };
      const expected = { id: 'in_1', amount_due: 100, status: 'open' };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(expected);
      expect(result.filled).toStrictEqual(['status']);
    });
  });

  describe('GIVEN keys already present in the fixture', (): void => {
    it('WHEN filling THEN the fixture values win and nothing is recorded', (): void => {
      const base = { id: 'in_1', memo: null, amount_due: 0, note: '' };
      const fill = { id: 'in_ai', memo: 'replaced', amount_due: 4200, note: 'replaced' };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(base);
      expect(result.filled).toStrictEqual([]);
    });
  });

  describe('GIVEN a nested object with a partially populated branch', (): void => {
    it('WHEN filling THEN it recurses and records dotted paths', (): void => {
      const baseCustomer = { id: 'cus_1' };
      const base = { id: 'in_1', customer: baseCustomer };
      const fillCustomer = { id: 'cus_ai', email: 'ada@example.com' };
      const fill = { customer: fillCustomer, currency: 'usd' };
      const expectedCustomer = { id: 'cus_1', email: 'ada@example.com' };
      const expected = { id: 'in_1', customer: expectedCustomer, currency: 'usd' };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(expected);
      expect(result.filled).toStrictEqual(['customer.email', 'currency']);
    });
  });

  describe('GIVEN arrays of equal length', (): void => {
    it('WHEN filling THEN elements are zipped by index', (): void => {
      const baseFirst = { id: 'li_1' };
      const baseSecond = { id: 'li_2' };
      const baseLines = [baseFirst, baseSecond];
      const base = { lines: baseLines };
      const fillFirst = { amount: 100 };
      const fillSecond = { amount: 200 };
      const fillLines = [fillFirst, fillSecond];
      const fill = { lines: fillLines };
      const expectedFirst = { id: 'li_1', amount: 100 };
      const expectedSecond = { id: 'li_2', amount: 200 };
      const expectedLines = [expectedFirst, expectedSecond];
      const expected = { lines: expectedLines };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(expected);
      expect(result.filled).toStrictEqual(['lines[0].amount', 'lines[1].amount']);
    });
  });

  describe('GIVEN more fill elements than fixture elements', (): void => {
    it('WHEN filling THEN the extra elements are appended and recorded', (): void => {
      const base = { tags: ['a'] };
      const fill = { tags: ['ignored', 'b', 'c'] };
      const expected = { tags: ['a', 'b', 'c'] };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(expected);
      expect(result.filled).toStrictEqual(['tags[1]', 'tags[2]']);
    });
  });

  describe('GIVEN a scalar in the fixture where the fill holds an object', (): void => {
    it('WHEN filling THEN the fill object replaces the scalar and records the path', (): void => {
      const base = { customer: 'cus_1' };
      const fillCustomer = { id: 'cus_ai' };
      const fill = { customer: fillCustomer };
      const expected = { customer: fillCustomer };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(expected);
      expect(result.filled).toStrictEqual(['customer']);
    });
  });

  describe('GIVEN a string in the fixture where the fill holds a string differing only in casing', (): void => {
    it('WHEN filling THEN the fill casing replaces the fixture and records the path', (): void => {
      const base = { status: 'Open' };
      const fill = { status: 'open' };
      const expected = { status: 'open' };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(expected);
      expect(result.filled).toStrictEqual(['status']);
    });
  });

  describe('GIVEN a string in the fixture where the fill holds a number', (): void => {
    it('WHEN filling THEN the fill number replaces the string and records the path', (): void => {
      const base = { amount_due: '4200' };
      const fill = { amount_due: 4200 };
      const expected = { amount_due: 4200 };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(expected);
      expect(result.filled).toStrictEqual(['amount_due']);
    });
  });

  describe('GIVEN a null in the fixture where the fill holds a string', (): void => {
    it('WHEN filling THEN the null is kept and nothing is recorded', (): void => {
      const base = { memo: null };
      const fill = { memo: 'replaced' };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(base);
      expect(result.filled).toStrictEqual([]);
    });
  });

  describe('GIVEN a string in the fixture where the fill holds null', (): void => {
    it('WHEN filling THEN the string is kept and nothing is recorded', (): void => {
      const base = { memo: 'keep' };
      const fill = { memo: null };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(base);
      expect(result.filled).toStrictEqual([]);
    });
  });

  describe('GIVEN a casing mismatch inside an array element', (): void => {
    it('WHEN filling THEN the nested string is replaced and the indexed path is recorded', (): void => {
      const baseLine = { status: 'Paid' };
      const base = { lines: [baseLine] };
      const fillLine = { status: 'paid' };
      const fill = { lines: [fillLine] };
      const expectedLine = { status: 'paid' };
      const expected = { lines: [expectedLine] };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(expected);
      expect(result.filled).toStrictEqual(['lines[0].status']);
    });
  });

  describe('GIVEN fill elements past the baseline end holding a hole or undefined', (): void => {
    it.each<[string, unknown[], unknown[], string[]]>([
      ['a trailing hole', TRAILING_HOLE, ['a', 'b'], ['[1]']],
      ['a hole followed by a value', INNER_HOLE, ['a'], []],
      ['an explicit undefined followed by a value', ['a', 'b', undefined, 'd'], ['a', 'b'], ['[1]']]
    ])(
      'WHEN filling past %s THEN appending stops there and no element becomes null',
      (_label: string, fill: unknown[], expected: unknown[], filled: string[]): void => {
        const result = deepFill(['a'], fill);

        expect(result.value).toStrictEqual(expected);
        expect(result.filled).toStrictEqual(filled);
      }
    );
  });

  describe('GIVEN keepPresent and present values the fill would replace', (): void => {
    it('WHEN filling THEN a type mismatch, a casing mismatch and a scalar under an object fill are all kept', (): void => {
      const base = { amount_due: '4200', status: 'Open', customer: 'cus_1' };
      const fillCustomer = { id: 'cus_ai' };
      const fill = { amount_due: 4200, status: 'open', customer: fillCustomer };

      const result = deepFill(base, fill, KEEP_PRESENT);

      expect(result.value).toStrictEqual(base);
      expect(result.filled).toStrictEqual([]);
    });

    it('WHEN a present array is shorter than the fill THEN no element is appended, an empty array included', (): void => {
      const base = { tags: [], lines: ['a'] };
      const fill = { tags: ['string'], lines: ['a', 'b'] };

      const result = deepFill(base, fill, KEEP_PRESENT);

      expect(result.value).toStrictEqual(base);
      expect(result.filled).toStrictEqual([]);
    });

    it('WHEN an array element lacks a key THEN the key is still filled beside the kept value', (): void => {
      const base = [{ amount_due: '4200' }];
      const fillLine = { amount_due: 4200, status: 'open' };
      const fill = [fillLine];
      const expectedLine = { amount_due: '4200', status: 'open' };

      const result = deepFill(base, fill, KEEP_PRESENT);

      expect(result.value).toStrictEqual([expectedLine]);
      expect(result.filled).toStrictEqual(['[0].status']);
    });
  });

  describe('GIVEN a fill with holes or undefined values', (): void => {
    it('WHEN an array slot is a hole THEN the baseline element stays and is not reported filled', (): void => {
      const holed: unknown[] = [];

      const fillElement = { b: 'string' };
      const baseElement = { a: 1 };
      const baseItems = ['keep-me', 7, baseElement];

      holed[2] = fillElement;

      const base = { items: baseItems };
      const fill = { items: holed };
      const kept = { a: 1, b: 'string' };
      const items = ['keep-me', 7, kept];
      const expected = { items };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual(expected);
      expect(result.filled).toStrictEqual(['items[2].b']);
    });

    it('WHEN a key holds undefined THEN it neither replaces nor adds a value', (): void => {
      const base = { id: 'in_1' };
      const fill = { id: undefined, memo: undefined };

      const result = deepFill(base, fill);

      expect(result.value).toStrictEqual({ id: 'in_1' });
      expect(result.filled).toStrictEqual([]);
    });
  });

  describe('GIVEN inputs that must survive the merge untouched', (): void => {
    it('WHEN filling THEN neither the fixture nor the fill is mutated', (): void => {
      const baseCustomer = { id: 'cus_1' };
      const base = { customer: baseCustomer, tags: ['a'] };
      const fillCustomer = { email: 'ada@example.com' };
      const fill = { customer: fillCustomer, tags: ['ignored', 'b'] };
      const baseBefore = JSON.stringify(base);
      const fillBefore = JSON.stringify(fill);

      deepFill(base, fill);

      expect(JSON.stringify(base)).toBe(baseBefore);
      expect(JSON.stringify(fill)).toBe(fillBefore);
    });
  });
});
