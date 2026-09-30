import { describe, expect, it } from 'vitest';

import { mergeAnswers } from './answer-merge.util.ts';

const CUSTOMER = { customer: 'cus_1' };
const CURRENCY = { currency: 'usd' };
const BOTH_KEYS = { customer: 'cus_1', currency: 'usd' };
const INTENT_CUSTOMER = { customer: 'cus_1' };
const INTENT_ACCOUNT = { customer_account: null };
const INTENT_BOTH = { customer: 'cus_1', customer_account: null };
const SOURCE = { customer: 'cus_2' };
const FIRST_INTENT = { payment_intent: INTENT_CUSTOMER };
const SECOND_INTENT = { payment_intent: INTENT_ACCOUNT, source: SOURCE };
const MERGED_INTENT = { payment_intent: INTENT_BOTH, source: SOURCE };
const LINES_FIRST = [{ id: 'il_1' }, { id: 'il_2' }];
const LINES_SECOND = [{ amount: 1 }, { amount: 2 }, { amount: 3 }];
const LINES_MERGED = [{ id: 'il_1', amount: 1 }, { id: 'il_2', amount: 2 }, { amount: 3 }];
const FIRST_LINES = { lines: LINES_FIRST };
const SECOND_LINES = { lines: LINES_SECOND };
const MERGED_LINES = { lines: LINES_MERGED };
const LINES_HOLE = [undefined, { amount: 2 }];
const LINES_HOLE_MERGED = [{ id: 'il_1' }, { id: 'il_2', amount: 2 }];
const HOLE = { lines: LINES_HOLE };
const HOLE_MERGED = { lines: LINES_HOLE_MERGED };

describe('FEATURE: merging chunked CLI answers', (): void => {
  describe('GIVEN answers for different keys', (): void => {
    it('WHEN merged THEN keeps both', (): void => {
      const merged = mergeAnswers(CUSTOMER, CURRENCY);

      expect(merged).toStrictEqual(BOTH_KEYS);
    });
  });

  describe('GIVEN answers inside the same object', (): void => {
    it('WHEN merged THEN merges them key by key', (): void => {
      const merged = mergeAnswers(FIRST_INTENT, SECOND_INTENT);

      expect(merged).toStrictEqual(MERGED_INTENT);
    });

    it('WHEN merged THEN leaves both inputs unchanged', (): void => {
      const first = structuredClone(FIRST_INTENT);
      const second = structuredClone(SECOND_INTENT);

      mergeAnswers(first, second);

      expect([first, second]).toStrictEqual([FIRST_INTENT, SECOND_INTENT]);
    });
  });

  describe('GIVEN answers inside the same array', (): void => {
    it('WHEN merged THEN merges them index by index', (): void => {
      const merged = mergeAnswers(FIRST_LINES, SECOND_LINES);

      expect(merged).toStrictEqual(MERGED_LINES);
    });

    it('WHEN the later answer skips an index THEN the earlier element stays', (): void => {
      const merged = mergeAnswers(FIRST_LINES, HOLE);

      expect(merged).toStrictEqual(HOLE_MERGED);
    });
  });

  describe('GIVEN list answers for a list fixture', (): void => {
    it('WHEN merged THEN merges them index by index and keeps each chunk element', (): void => {
      const first = [{ status: 'draft' }];
      const second = [undefined, undefined, { status: 'open' }];

      const merged = mergeAnswers(first, second);

      expect(merged).toStrictEqual([{ status: 'draft' }, undefined, { status: 'open' }]);
    });

    it('WHEN the first is the empty start of a run THEN the list replaces it', (): void => {
      const list = [{ status: 'open' }];

      const merged = mergeAnswers({}, list);

      expect(merged).toStrictEqual(list);
    });
  });

  describe('GIVEN the same scalar in both', (): void => {
    it('WHEN merged THEN the later answer wins', (): void => {
      const first = { total: 1 };
      const second = { total: 2 };

      const merged = mergeAnswers(first, second);

      expect(merged).toStrictEqual(second);
    });
  });
});
