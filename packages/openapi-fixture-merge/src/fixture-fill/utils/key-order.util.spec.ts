import { describe, expect, it } from 'vitest';

import { orderLike } from './key-order.util.ts';

describe('FEATURE: key order of a merged fixture', (): void => {
  describe('GIVEN a flat object whose shared keys moved to the end', (): void => {
    it('WHEN ordered like the original THEN shared keys follow the original order', (): void => {
      const value = { id: 'in_1', status: 'open', amount_due: 100 };
      const reference = { id: 'in_1', amount_due: 0, status: 'open' };

      const ordered = orderLike(value, reference);

      expect(Object.keys(ordered ?? {})).toStrictEqual(['id', 'amount_due', 'status']);
      expect(ordered).toStrictEqual(value);
    });
  });

  describe('GIVEN keys the original does not have', (): void => {
    it('WHEN ordered like the original THEN the new keys follow in their current order', (): void => {
      const value = { memo: 'm', id: 'in_1', customer: 'cus_1', amount_due: 100 };
      const reference = { amount_due: 0, id: 'in_1' };

      const ordered = orderLike(value, reference);

      expect(Object.keys(ordered ?? {})).toStrictEqual(['amount_due', 'id', 'memo', 'customer']);
    });
  });

  describe('GIVEN original keys the value no longer has', (): void => {
    it('WHEN ordered like the original THEN the absent keys are not added', (): void => {
      const value = { status: 'open' };
      const reference = { id: 'in_1', status: 'draft' };

      const ordered = orderLike(value, reference);

      expect(ordered).toStrictEqual(value);
    });
  });

  describe('GIVEN nested objects', (): void => {
    it('WHEN ordered like the original THEN every level follows the original order', (): void => {
      const valueAddress = { line1: 'Main St', city: 'Oslo' };
      const valueCustomer = { email: 'ada@example.com', id: 'cus_1', address: valueAddress };
      const value = { customer: valueCustomer, id: 'in_1' };
      const referenceAddress = { city: 'x', line1: 'y' };
      const referenceCustomer = { id: 'cus_1', address: referenceAddress, email: 'x' };
      const reference = { id: 'in_1', customer: referenceCustomer };
      const expected = '{"id":"in_1","customer":{"id":"cus_1","address":{"city":"Oslo","line1":"Main St"},"email":"ada@example.com"}}';

      const ordered = orderLike(value, reference);

      expect(JSON.stringify(ordered)).toBe(expected);
    });
  });

  describe('GIVEN arrays of objects', (): void => {
    it('WHEN ordered like the original THEN each element follows the element at its index', (): void => {
      const valueFirst = { amount: 100, id: 'li_1' };
      const valueSecond = { amount: 200, id: 'li_2' };
      const valueThird = { amount: 300, id: 'li_3' };
      const value = { lines: [valueFirst, valueSecond, valueThird] };
      const referenceFirst = { id: 'li_1', amount: 0 };
      const referenceSecond = { id: 'li_2', amount: 0 };
      const reference = { lines: [referenceFirst, referenceSecond] };
      const expected = '{"lines":[{"id":"li_1","amount":100},{"id":"li_2","amount":200},{"amount":300,"id":"li_3"}]}';

      const ordered = orderLike(value, reference);

      expect(JSON.stringify(ordered)).toBe(expected);
    });
  });

  describe('GIVEN a reference whose shape does not match', (): void => {
    it('WHEN the reference is a scalar THEN the value is returned unchanged', (): void => {
      const value = { b: 1, a: 2 };

      const ordered = orderLike(value, 'not an object');

      expect(ordered).toBe(value);
    });

    it('WHEN the reference is undefined THEN the value is returned unchanged', (): void => {
      const value = { b: 1, a: 2 };

      const ordered = orderLike(value, undefined);

      expect(ordered).toBe(value);
    });

    it('WHEN the value is an array and the reference an object THEN the value is returned unchanged', (): void => {
      const value = [1, 2];
      const reference = { a: 1 };

      const ordered = orderLike(value, reference);

      expect(ordered).toBe(value);
    });

    it('WHEN the value is a scalar and the reference an object THEN the value is returned unchanged', (): void => {
      const reference = { a: 1 };

      const ordered = orderLike('text', reference);

      expect(ordered).toBe('text');
    });
  });

  describe('GIVEN an own __proto__ key parsed from JSON', (): void => {
    it('WHEN ordered like the original THEN it stays an own key and the prototype is untouched', (): void => {
      const value: unknown = JSON.parse('{"__proto__":{"polluted":true},"id":"in_1"}');
      const reference: unknown = JSON.parse('{"id":"in_1","__proto__":{}}');

      const ordered = orderLike(value, reference);

      expect(JSON.stringify(ordered)).toBe('{"id":"in_1","__proto__":{"polluted":true}}');
      expect(Object.getPrototypeOf(ordered)).toBe(Object.prototype);
    });
  });

  describe('GIVEN inputs that must survive the ordering untouched', (): void => {
    it('WHEN ordered like the original THEN neither the value nor the reference is mutated', (): void => {
      const valueCustomer = { email: 'ada@example.com', id: 'cus_1' };
      const value = { customer: valueCustomer, id: 'in_1', tags: ['b', 'a'] };
      const referenceCustomer = { id: 'cus_1', email: 'x' };
      const reference = { id: 'in_1', customer: referenceCustomer, tags: ['a'] };
      const valueBefore = JSON.stringify(value);
      const referenceBefore = JSON.stringify(reference);

      orderLike(value, reference);

      expect(JSON.stringify(value)).toBe(valueBefore);
      expect(JSON.stringify(reference)).toBe(referenceBefore);
    });
  });
});
