import { describe, expect, it } from 'vitest';

import { lineHighlights } from './line-highlight.util.ts';
import type { LineHighlight, PathHighlight } from '../common/document-view.type.ts';

const pretty = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const ADDRESS = { city: 'Oslo' };
const CUSTOMER = { id: 'cus_1', address: ADDRESS };
const LINE = { sku: 'A-1', tags: [] };
const INVOICE = { id: 'in_1', customer: CUSTOMER, lines: [LINE], memo: {} };
const INVOICE_JSON = pretty(INVOICE);

describe('FEATURE: lines a value covers', (): void => {
  describe('GIVEN a pretty-printed invoice', (): void => {
    it.each([
      ['a top-level scalar', 'id', 2, 2],
      ['a nested object', 'customer', 3, 8],
      ['a scalar inside it', 'customer.address.city', 6, 6],
      ['an array item', 'lines[0]', 10, 13],
      ['an empty array', 'lines[0].tags', 12, 12],
      ['an empty object', 'memo', 15, 15]
    ])('WHEN %s is highlighted THEN covers the lines its value spans', (_label, path, from, to): void => {
      const highlight: PathHighlight = { path, origin: 'missing', outcome: 'sampler' };

      const [line] = lineHighlights(INVOICE_JSON, [highlight]);

      expect(line?.from).toBe(from);
      expect(line?.to).toBe(to);
    });
  });

  it('GIVEN a list fixture whose root is an array WHEN an item path is highlighted THEN covers that item value', (): void => {
    const first = { id: 'in_1', created: 1 };
    const second = { id: 'in_2', created: 2 };
    const list = pretty([first, second]);
    const highlight: PathHighlight = { path: '[1].created', origin: 'missing', outcome: 'sampler' };

    const [line] = lineHighlights(list, [highlight]);

    expect(line?.from).toBe(8);
    expect(line?.to).toBe(8);
  });

  it('GIVEN an empty path WHEN highlighted THEN never marks the whole document', (): void => {
    const highlight: PathHighlight = { path: '', origin: 'missing', outcome: 'sampler' };

    expect(lineHighlights(INVOICE_JSON, [highlight])).toStrictEqual([]);
  });

  describe('GIVEN keys holding a dot or a bracket beside look-alike nested keys', (): void => {
    const nested = { b: 1 };
    const tricky = pretty({ 'a.b': 'flat', a: nested, 'k[0]': 'bracket', '': 'empty' });

    it.each([
      ['a pointer to the flat dotted key', '/a.b', 2],
      ['a pointer to the nested key', '/a/b', 4],
      ['a pointer to the bracketed key', '/k[0]', 6]
    ])('WHEN %s is highlighted THEN marks its own line', (_label, path, from): void => {
      const highlight: PathHighlight = { path, origin: 'broken', outcome: 'unfilled' };

      const [line] = lineHighlights(tricky, [highlight]);

      expect(line?.from).toBe(from);
    });
  });

  it('GIVEN text that is not JSON WHEN highlighted THEN highlights nothing', (): void => {
    const highlight: PathHighlight = { path: 'id', origin: 'missing', outcome: 'sampler' };

    expect(lineHighlights('not json', [highlight])).toStrictEqual([]);
  });
});

describe('FEATURE: line highlights', (): void => {
  describe('GIVEN a pretty-printed invoice', (): void => {
    it('WHEN a missing value filled by AI is highlighted THEN covers its lines and labels them', (): void => {
      const highlight: PathHighlight = { path: 'customer.address', origin: 'missing', outcome: 'ai' };
      const expected: LineHighlight = {
        from: 5,
        to: 7,
        origin: 'missing',
        outcome: 'ai',
        label: 'customer.address · Was missing · Filled by AI'
      };

      expect(lineHighlights(INVOICE_JSON, [highlight])).toStrictEqual([expected]);
    });

    it('WHEN a broken value of the existing fixture is highlighted THEN labels it broken only', (): void => {
      const highlight: PathHighlight = { path: 'id', origin: 'broken', outcome: 'broken' };
      const expected: LineHighlight = { from: 2, to: 2, origin: 'broken', outcome: 'broken', label: 'id · Broken in your fixture' };

      expect(lineHighlights(INVOICE_JSON, [highlight])).toStrictEqual([expected]);
    });

    it('WHEN a highlight says why its value is broken THEN keeps the reason and the value for the tooltip', (): void => {
      const highlight: PathHighlight = { path: 'id', origin: 'broken', outcome: 'broken', reason: 'must be integer', found: '"in_1"' };

      const [line] = lineHighlights(INVOICE_JSON, [highlight]);

      expect(line?.reason).toBe('must be integer');
      expect(line?.found).toBe('"in_1"');
    });

    it('WHEN a merge error names a JSON pointer THEN highlights the value it points at', (): void => {
      const highlight: PathHighlight = { path: '/lines/0/sku', origin: 'broken', outcome: 'unfilled' };

      const [line] = lineHighlights(INVOICE_JSON, [highlight]);

      expect(line?.from).toBe(11);
    });

    it('WHEN a path is not in the document THEN leaves it out', (): void => {
      const highlight: PathHighlight = { path: 'customer.name', origin: 'missing', outcome: 'sampler' };

      expect(lineHighlights(INVOICE_JSON, [highlight])).toStrictEqual([]);
    });
  });

  it('GIVEN no highlights WHEN mapped THEN skips reading the document', (): void => {
    expect(lineHighlights('not json', [])).toStrictEqual([]);
  });
});
