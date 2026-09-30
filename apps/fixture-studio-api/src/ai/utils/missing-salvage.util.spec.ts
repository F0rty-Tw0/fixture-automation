import { beforeAll, describe, expect, it } from 'vitest';

import { missingSalvage } from './missing-salvage.util.ts';
import type { FillSource, MissingFile } from '../../contract/common/studio-api.type.ts';
import { missingFixture } from '../../test/utils/studio-spec.spec.util.ts';

const CONTEXT = 'Chunk 2 of 3: claude returned text that is not JSON';
const RATE = { rate: 0 };
const SAMPLED_LINES = [{ sku: 'string' }, { tax: RATE }, { quantity: 0 }];
const SAMPLED_CUSTOMER = { email: 'user@example.com' };
const SAMPLED = { id: 'string', customer: SAMPLED_CUSTOMER, lines: SAMPLED_LINES };
const ALL_SAMPLER: Record<string, FillSource> = {
  id: 'sampler',
  'customer.email': 'sampler',
  'lines[0].sku': 'sampler',
  'lines[1].tax': 'sampler',
  'lines[2].quantity': 'sampler'
};
const ALL_AI: Record<string, FillSource> = {
  id: 'ai',
  'customer.email': 'ai',
  'lines[0].sku': 'ai',
  'lines[1].tax': 'ai',
  'lines[2].quantity': 'ai'
};
const CUSTOMER = { email: 'ann@example.com' };
const FULL_TAX = { rate: 0.2 };
const FULL_LINES = [{ sku: 'A' }, { tax: FULL_TAX }, { quantity: 3 }];
const FULL = { id: 'in_1', customer: CUSTOMER, lines: FULL_LINES };
const PARTIAL = { id: 'in_1', customer: CUSTOMER };
const WRONG_TAX = { rate: 'x' };
const WRONG_CUSTOMER = { email: 'not an email' };
const WRONG_LINES = [{ sku: 'A' }, { tax: WRONG_TAX }, { quantity: 'many' }];
const WRONG_TYPES = { id: 5, customer: WRONG_CUSTOMER, lines: WRONG_LINES };
const WHOLE_CUSTOMER = { email: 'ann@example.com', name: 'Ann' };
const WHOLE_LINE_A = { sku: 'A', tax: RATE, quantity: 1 };
const WHOLE_LINE_B = { sku: 'B', tax: FULL_TAX, quantity: 1 };
const WHOLE_LINE_C = { sku: 'C', tax: RATE, quantity: 3 };
const WHOLE_LINES = [WHOLE_LINE_A, WHOLE_LINE_B, WHOLE_LINE_C];
const WHOLE_FIXTURE = { id: 'in_1', amount_due: 5, memo: 'm', customer: WHOLE_CUSTOMER, lines: WHOLE_LINES };
const WHOLE_POPULATED_LINES = [{ sku: 'A' }, { tax: FULL_TAX }, { quantity: 3 }];
const WHOLE_POPULATED = { id: 'in_1', customer: CUSTOMER, lines: WHOLE_POPULATED_LINES };
const CODE_SCHEMA = { type: 'string', pattern: '^[0-9]{3}$' };
const CODE_PROPERTIES = { code: CODE_SCHEMA };
const CODE_PROJECTION = { type: 'object', required: ['code'], properties: CODE_PROPERTIES };
const STRING_PROJECTION = { type: 'string' };
const EMPTY_SCHEMAS: Record<string, unknown> = {};
const EMPTY_COMPONENTS = { schemas: EMPTY_SCHEMAS };
const CODE_MISSING: MissingFile = {
  schemaName: 'x',
  dialect: 'openapi-30',
  paths: ['code'],
  schema: CODE_PROJECTION,
  components: EMPTY_COMPONENTS
};
const UNSAMPLEABLE: MissingFile = { ...CODE_MISSING, schema: STRING_PROJECTION };
const SAMPLED_B = { const: 'string' };
const B_IS_SAMPLED = { b: SAMPLED_B };
const B_SAMPLED = { required: ['b'], properties: B_IS_SAMPLED };
const SHORT = { maxLength: 3 };
const A_IS_SHORT = { a: SHORT };
const SHORT_A = { properties: A_IS_SHORT };
const TEXT = { type: 'string' };
const PAIR_PROPERTIES = { a: TEXT, b: TEXT };
const PAIR_PROJECTION = { type: 'object', required: ['a', 'b'], properties: PAIR_PROPERTIES, if: B_SAMPLED, then: SHORT_A };
const PAIR_MISSING: MissingFile = { ...CODE_MISSING, dialect: 'openapi-31', paths: ['a', 'b'], schema: PAIR_PROJECTION };

describe('FEATURE: missing fill salvage', (): void => {
  let lines: MissingFile;

  beforeAll(async (): Promise<void> => {
    lines = await missingFixture('lines');
  });

  describe('GIVEN no parsed answer', (): void => {
    it('WHEN salvaged THEN every missing path holds the sampler value at its own index', (): void => {
      const outcome = missingSalvage(lines, [], CONTEXT);

      expect(outcome.populated).toStrictEqual(SAMPLED);
    });

    it('WHEN salvaged THEN every source is the sampler', (): void => {
      const outcome = missingSalvage(lines, [], CONTEXT);

      expect(outcome.sources).toStrictEqual(ALL_SAMPLER);
    });

    it('WHEN salvaged THEN one note says why and how many values the schema filled', (): void => {
      const outcome = missingSalvage(lines, [], CONTEXT);

      expect(outcome.notes).toStrictEqual([`${CONTEXT}; 5 values filled from the schema.`]);
    });
  });

  describe('GIVEN an answer with only some missing paths', (): void => {
    it('WHEN salvaged THEN keeps its values and samples the rest', (): void => {
      const outcome = missingSalvage(lines, [PARTIAL], CONTEXT);

      expect(outcome.populated).toStrictEqual({ ...SAMPLED, ...PARTIAL });
      expect(outcome.sources).toStrictEqual({ ...ALL_SAMPLER, id: 'ai', 'customer.email': 'ai' });
      expect(outcome.notes).toStrictEqual([`${CONTEXT}; 2 values kept from the answer, 3 values filled from the schema.`]);
    });
  });

  describe('GIVEN an answer with wrong types and formats', (): void => {
    it('WHEN salvaged THEN replaces only the invalid values from the sampler', (): void => {
      const outcome = missingSalvage(lines, [WRONG_TYPES], CONTEXT);

      const repairedLines = [{ sku: 'A' }, { tax: RATE }, { quantity: 0 }];

      expect(outcome.populated).toStrictEqual({ ...SAMPLED, lines: repairedLines });
      expect(outcome.sources).toStrictEqual({ ...ALL_SAMPLER, 'lines[0].sku': 'ai' });
    });
  });

  describe('GIVEN an answer that is the whole fixture', (): void => {
    it('WHEN salvaged THEN keeps only the values at missing paths', (): void => {
      const outcome = missingSalvage(lines, [WHOLE_FIXTURE], CONTEXT);

      expect(outcome.populated).toStrictEqual(WHOLE_POPULATED);
      expect(outcome.sources).toStrictEqual(ALL_AI);
    });
  });

  describe('GIVEN a valid answer inside a wrapper key', (): void => {
    it('WHEN salvaged THEN unwraps it and keeps every value', (): void => {
      const wrapped = { missing: FULL };

      const outcome = missingSalvage(lines, [wrapped], CONTEXT);

      expect(outcome.populated).toStrictEqual(FULL);
      expect(outcome.notes).toStrictEqual([`${CONTEXT}; 5 values kept from the answer.`]);
    });
  });

  describe('GIVEN two answers', (): void => {
    it('WHEN salvaged THEN builds on the one with more valid missing paths', (): void => {
      const outcome = missingSalvage(lines, [PARTIAL, WRONG_TYPES], CONTEXT);

      expect(outcome.sources).toStrictEqual({ ...ALL_SAMPLER, id: 'ai', 'customer.email': 'ai' });
    });

    it('WHEN both are equally good THEN builds on the later repair', (): void => {
      const repaired = { id: 'in_2' };

      const outcome = missingSalvage(lines, [{ id: 'in_1' }, repaired], CONTEXT);

      expect(outcome.populated).toMatchObject(repaired);
    });
  });

  describe.each<[string, unknown]>([
    ['text', 'truncated {"id": "in'],
    ['an array', [FULL]],
    ['null values', { id: null, customer: null }]
  ])('GIVEN an answer that is %s', (_label: string, candidate: unknown): void => {
    it('WHEN salvaged THEN every path comes from the sampler', (): void => {
      const outcome = missingSalvage(lines, [candidate], CONTEXT);

      expect(outcome.sources).toStrictEqual(ALL_SAMPLER);
    });
  });

  describe('GIVEN a path whose sampler value breaks its pattern', (): void => {
    it('WHEN salvaged THEN leaves it out and marks it unfilled', (): void => {
      const outcome = missingSalvage(CODE_MISSING, [], CONTEXT);

      expect(outcome.populated).toStrictEqual({});
      expect(outcome.sources).toStrictEqual({ code: 'unfilled' });
      expect(outcome.notes).toStrictEqual([`${CONTEXT}; 1 value left unfilled.`]);
    });

    it('WHEN the answer holds a valid value THEN keeps it', (): void => {
      const answer = { code: '042' };

      const outcome = missingSalvage(CODE_MISSING, [answer], CONTEXT);

      expect(outcome.populated).toStrictEqual(answer);
      expect(outcome.sources).toStrictEqual({ code: 'ai' });
    });
  });

  describe('GIVEN an answer valid alone but rejected next to the sampled values', (): void => {
    it('WHEN salvaged THEN retries the rejected paths with sampler values instead of leaving them unfilled', (): void => {
      const answer = { a: 'long-value' };

      const outcome = missingSalvage(PAIR_MISSING, [answer], CONTEXT);

      expect(outcome.sources).toStrictEqual({ a: 'sampler', b: 'sampler' });
      expect(outcome.populated).toStrictEqual({ a: 'str', b: 'string' });
    });
  });

  describe('GIVEN a list fixture whose missing paths start at an index', (): void => {
    let list: MissingFile;

    beforeAll(async (): Promise<void> => {
      list = await missingFixture('list');
    });

    it('WHEN salvaged without an answer THEN is a list with sampler values at each index and holes between', (): void => {
      const outcome = missingSalvage(list, [], CONTEXT);

      expect(JSON.stringify(outcome.populated)).toBe('[{"status":"draft"},null,{"status":"draft"}]');
      expect(outcome.sources).toStrictEqual({ '[0].status': 'sampler', '[2].status': 'sampler' });
    });

    it('WHEN the answer is a list THEN keeps its valid values', (): void => {
      const answer = [{ status: 'open' }, { status: 'x' }, { status: 'bad' }];

      const outcome = missingSalvage(list, [answer], CONTEXT);

      expect(JSON.stringify(outcome.populated)).toBe('[{"status":"open"},null,{"status":"draft"}]');
      expect(outcome.sources).toStrictEqual({ '[0].status': 'ai', '[2].status': 'sampler' });
    });

    it('WHEN the list answer sits in a wrapper key THEN unwraps it', (): void => {
      const items = [{ status: 'open' }, {}, { status: 'open' }];
      const answer = { missing: items };

      const outcome = missingSalvage(list, [answer], CONTEXT);

      expect(outcome.sources).toStrictEqual({ '[0].status': 'ai', '[2].status': 'ai' });
    });

    it('WHEN nothing can be filled THEN the empty fill is still a list', (): void => {
      const unsampleable: MissingFile = { ...list, dialect: 'openapi-31', schema: STRING_PROJECTION };

      const outcome = missingSalvage(unsampleable, [], CONTEXT);

      expect(outcome.populated).toStrictEqual([]);
    });
  });

  describe('GIVEN a projection the sampler cannot sample', (): void => {
    it('WHEN salvaged THEN marks every path unfilled instead of failing', (): void => {
      const outcome = missingSalvage(UNSAMPLEABLE, [], CONTEXT);

      expect(outcome.populated).toStrictEqual({});
      expect(outcome.sources).toStrictEqual({ code: 'unfilled' });
    });
  });
});
