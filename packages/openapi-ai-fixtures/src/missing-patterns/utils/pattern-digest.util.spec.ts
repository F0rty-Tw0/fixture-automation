import { describe, expect, it } from 'vitest';

import { patternDigest } from './pattern-digest.util.ts';
import type { MissingPattern } from '../common/missing-pattern.type.ts';

const NOTES = [{ text: 'n0' }, { text: 'n1' }, { text: 'n2' }, { text: 'n3' }];
const META = { x: 1 };
const FIRST_LINE = { sku: 's0', qty: 0, meta: META, notes: NOTES };
const LINES = [FIRST_LINE, { sku: 's1', qty: 1 }, { sku: 's2', qty: 2 }, { sku: 's3', qty: 3 }, { sku: 's4', qty: 4 }];
const ADDRESS = { city: 'Oslo' };
const CUSTOMER = { id: 'cus_1', name: 'Ada', address: ADDRESS, tags: ['a', 'b', 'c', 'd'] };
const INVOICE = { id: 'in_1', currency: 'usd', customer: CUSTOMER, lines: LINES, history: [1, 2, 3, 4] };
const ROOT_LIST = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

const pattern = (name: string, paths: string[]): MissingPattern => {
  const missingPattern: MissingPattern = { pattern: name, paths };

  return missingPattern;
};

const LINE_TAXES = pattern('lines[*].tax', ['lines[0].tax', 'lines[1].tax', 'lines[2].tax', 'lines[3].tax', 'lines[4].tax']);
const NOTE_AUTHORS = pattern('lines[*].notes[*].author', ['lines[0].notes[0].author', 'lines[0].notes[3].author']);
const CUSTOMER_EMAIL = pattern('customer.email', ['customer.email']);
const CUSTOMER_TAGS = pattern('customer.tags[*]', ['customer.tags[4]']);
const LIST_STATUS = pattern('[*].status', ['[0].status', '[3].status']);

describe('FEATURE: pattern digest', (): void => {
  describe('GIVEN an invoice with a five-element line array', (): void => {
    it('WHEN a line pattern is digested THEN the array keeps its first 3 elements as primitives and off-chain subtrees drop', (): void => {
      const lines = [
        { sku: 's0', qty: 0 },
        { sku: 's1', qty: 1 },
        { sku: 's2', qty: 2 }
      ];
      const expected = { id: 'in_1', currency: 'usd', lines };

      const digest = patternDigest(INVOICE, [LINE_TAXES]);

      expect(digest).toStrictEqual(expected);
    });

    it('WHEN a nested array pattern is digested THEN the nested array is capped at 3 elements too', (): void => {
      const notes = [{ text: 'n0' }, { text: 'n1' }, { text: 'n2' }];
      const firstLine = { sku: 's0', qty: 0, notes };
      const lines = [firstLine, { sku: 's1', qty: 1 }, { sku: 's2', qty: 2 }];

      const digest = patternDigest(INVOICE, [NOTE_AUTHORS]);

      expect(digest).toHaveProperty('lines', lines);
    });

    it('WHEN an object pattern is digested THEN the parent keeps its primitives and drops its subtrees', (): void => {
      const customer = { id: 'cus_1', name: 'Ada' };
      const expected = { id: 'in_1', currency: 'usd', customer };

      const digest = patternDigest(INVOICE, [CUSTOMER_EMAIL]);

      expect(digest).toStrictEqual(expected);
    });

    it('WHEN a primitive array element is missing THEN its array keeps its first 3 primitives', (): void => {
      const digest = patternDigest(INVOICE, [CUSTOMER_TAGS]);

      expect(digest).toHaveProperty('customer.tags', ['a', 'b', 'c']);
    });

    it('WHEN several patterns are digested THEN the digest merges their chains', (): void => {
      const customer = { id: 'cus_1', name: 'Ada' };
      const lines = [
        { sku: 's0', qty: 0 },
        { sku: 's1', qty: 1 },
        { sku: 's2', qty: 2 }
      ];
      const expected = { id: 'in_1', currency: 'usd', customer, lines };

      const digest = patternDigest(INVOICE, [CUSTOMER_EMAIL, LINE_TAXES]);

      expect(digest).toStrictEqual(expected);
    });

    it('WHEN digested THEN the fixture is not mutated', (): void => {
      const before = structuredClone(INVOICE);

      patternDigest(INVOICE, [LINE_TAXES, NOTE_AUTHORS, CUSTOMER_TAGS]);

      expect(INVOICE).toStrictEqual(before);
    });
  });

  describe('GIVEN a root list fixture', (): void => {
    it('WHEN an element pattern is digested THEN the list keeps its first 3 elements', (): void => {
      const digest = patternDigest(ROOT_LIST, [LIST_STATUS]);

      expect(digest).toStrictEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });
  });
});
