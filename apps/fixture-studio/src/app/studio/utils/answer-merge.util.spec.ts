import { describe, expect, it } from 'vitest';

import { mergeAnswers } from './answer-merge.util.ts';

const INTENT_CUSTOMER = { customer: 'cus_1' };
const INTENT_ACCOUNT = { customer_account: null };
const INTENT_BOTH = { customer: 'cus_1', customer_account: null };
const SOURCE = { customer: 'cus_2' };
const LINES_FIRST = [{ id: 'il_1' }, { id: 'il_2' }];
const LINES_SECOND = [{ amount: 1 }, { amount: 2 }, { amount: 3 }];
const LINES_MERGED = [{ id: 'il_1', amount: 1 }, { id: 'il_2', amount: 2 }, { amount: 3 }];

describe('FEATURE: merging chunked model answers', (): void => {
  it('GIVEN answers for different keys WHEN merged THEN keeps both', (): void => {
    const merged = mergeAnswers({ customer: 'cus_1' }, { currency: 'usd' });

    expect(merged).toStrictEqual({ customer: 'cus_1', currency: 'usd' });
  });

  it('GIVEN answers inside the same object WHEN merged THEN merges them key by key', (): void => {
    const first = { payment_intent: INTENT_CUSTOMER };
    const second = { payment_intent: INTENT_ACCOUNT, source: SOURCE };

    const merged = mergeAnswers(first, second);

    expect(merged).toStrictEqual({ payment_intent: INTENT_BOTH, source: SOURCE });
  });

  it('GIVEN answers inside the same array WHEN merged THEN merges them index by index', (): void => {
    const merged = mergeAnswers({ lines: LINES_FIRST }, { lines: LINES_SECOND });

    expect(merged).toStrictEqual({ lines: LINES_MERGED });
  });

  it('GIVEN the same scalar in both WHEN merged THEN the later answer wins', (): void => {
    const merged = mergeAnswers({ total: 1 }, { total: 2 });

    expect(merged).toStrictEqual({ total: 2 });
  });

  it('GIVEN answers WHEN merged THEN leaves both inputs unchanged', (): void => {
    const first = { payment_intent: INTENT_CUSTOMER };
    const second = { payment_intent: INTENT_ACCOUNT };

    mergeAnswers(first, second);

    expect(first.payment_intent).toStrictEqual({ customer: 'cus_1' });
    expect(second.payment_intent).toStrictEqual({ customer_account: null });
  });
});
