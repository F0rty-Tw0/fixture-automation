import { isRecord } from '@fixture-automation/shared';
import { describe, expect, it } from 'vitest';

import { baselineContext } from './baseline-context.util.ts';

const GEO = { lat: 1 };
const ADDRESS = { city: 'Oslo', geo: GEO };
const CUSTOMER = { id: 'cus_1', name: 'Ada', address: ADDRESS };
const META = { x: 1 };
const FIRST_LINE = { sku: 'a', quantity: 1, meta: META };
const SECOND_LINE = { sku: 'b', quantity: 2, tags: ['t'] };
const CARD = { brand: 'visa' };
const PAYMENT_METHOD = { card: CARD };
const FINALIZATION_ERROR = { code: 'x', payment_method: PAYMENT_METHOD };
const INVOICE = {
  id: 'in_1',
  customer: CUSTOMER,
  currency: 'usd',
  lines: [FIRST_LINE, SECOND_LINE, 'loose'],
  total: 5,
  last_finalization_error: FINALIZATION_ERROR,
  paid: false,
  note: null
};
const ROOT_PRIMITIVES = { id: 'in_1', currency: 'usd', total: 5, paid: false, note: null };
const FIRST_LINE_PRIMITIVES = { sku: 'a', quantity: 1 };
const SECOND_LINE_PRIMITIVES = { sku: 'b', quantity: 2 };
const PRUNED_LINES = [FIRST_LINE_PRIMITIVES, SECOND_LINE_PRIMITIVES, 'loose'];
const LINES_CONTEXT = { ...ROOT_PRIMITIVES, lines: PRUNED_LINES };
const CUSTOMER_PRIMITIVES = { id: 'cus_1', name: 'Ada' };
const CUSTOMER_CONTEXT = { ...ROOT_PRIMITIVES, customer: CUSTOMER_PRIMITIVES };
const ADDRESS_PRIMITIVES = { city: 'Oslo' };
const ADDRESS_CUSTOMER = { ...CUSTOMER_PRIMITIVES, address: ADDRESS_PRIMITIVES };
const ADDRESS_CONTEXT = { ...ROOT_PRIMITIVES, customer: ADDRESS_CUSTOMER };
const FIRST_SUB = { a: 1 };
const DEEP = { c: 3 };
const SECOND_SUB = { a: 2, b: DEEP };
const ROOT_LIST = [{ id: 1, sub: FIRST_SUB }, { id: 2, sub: SECOND_SUB }, [1, 2]];
const SECOND_SUB_PRIMITIVES = { a: 2 };
const ROOT_LIST_CONTEXT = [{ id: 1 }, { id: 2, sub: SECOND_SUB_PRIMITIVES }, []];

const recordKeys = (value: unknown): string[] => {
  if (!isRecord(value)) return [];

  return Object.keys(value);
};

describe('FEATURE: baseline context', (): void => {
  describe('GIVEN an invoice with nested objects and arrays', (): void => {
    it('WHEN a top-level path is kept THEN only the root primitives remain', (): void => {
      const context = baselineContext(INVOICE, ['status']);

      expect(context).toStrictEqual(ROOT_PRIMITIVES);
    });

    it('WHEN a nested object path is kept THEN its parent keeps its primitives and drops its subtrees', (): void => {
      const context = baselineContext(INVOICE, ['customer.email']);

      expect(context).toStrictEqual(CUSTOMER_CONTEXT);
    });

    it('WHEN a deeper path is kept THEN every object on its parent chain keeps its primitives', (): void => {
      const context = baselineContext(INVOICE, ['customer.address.zip']);

      expect(context).toStrictEqual(ADDRESS_CONTEXT);
    });

    it('WHEN an array index path is kept THEN the array keeps its full length with primitives-only elements', (): void => {
      const context = baselineContext(INVOICE, ['lines[1].tax']);

      expect(context).toStrictEqual(LINES_CONTEXT);
    });

    it('WHEN paths share a parent THEN the parent appears once', (): void => {
      const context = baselineContext(INVOICE, ['lines[0].tax', 'lines[1].tax']);

      expect(context).toStrictEqual(LINES_CONTEXT);
    });

    it('WHEN pruned THEN keys keep the fixture order', (): void => {
      const context = baselineContext(INVOICE, ['customer.email']);

      expect(recordKeys(context)).toStrictEqual(['id', 'customer', 'currency', 'total', 'paid', 'note']);
    });

    it('WHEN pruned THEN the fixture is not mutated', (): void => {
      const before = structuredClone(INVOICE);

      baselineContext(INVOICE, ['lines[1].tax', 'customer.address.zip']);

      expect(INVOICE).toStrictEqual(before);
    });
  });

  describe('GIVEN a root array fixture', (): void => {
    it('WHEN an element path is kept THEN the array keeps its length, off-path elements shrink to primitives', (): void => {
      const context = baselineContext(ROOT_LIST, ['[1].sub.c']);

      expect(context).toStrictEqual(ROOT_LIST_CONTEXT);
    });
  });

  describe('GIVEN a primitive fixture', (): void => {
    it('WHEN pruned THEN it stays as-is', (): void => {
      const context = baselineContext('text', ['name']);

      expect(context).toBe('text');
    });
  });
});
