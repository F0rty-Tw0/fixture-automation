import { beforeAll, describe, expect, it } from 'vitest';

import { normalizedAnswer } from './answer-shape.util.ts';
import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { missingFixture } from '../../test/utils/studio-spec.spec.util.ts';

const STATUS = { status: 'open' };
const STATUS_SCHEMA = { type: 'string' };
const STATUS_PROPERTIES = { status: STATUS_SCHEMA };
const INNER_SCHEMA = { type: 'object', required: ['status'], properties: STATUS_PROPERTIES };
const DATA_PROPERTIES = { data: INNER_SCHEMA };
const DATA_SCHEMA = { type: 'object', required: ['data'], properties: DATA_PROPERTIES };
const EMPTY_SCHEMAS: Record<string, unknown> = {};
const EMPTY_COMPONENTS = { schemas: EMPTY_SCHEMAS };
const DATA_MISSING: MissingFile = {
  schemaName: 'invoice',
  dialect: 'openapi-30',
  paths: ['data.status'],
  schema: DATA_SCHEMA,
  components: EMPTY_COMPONENTS
};
const CUSTOMER = { id: 'cus_1' };
const CUSTOMER_FILL = { status: 'draft', customer: CUSTOMER };

describe('FEATURE: answer shape', (): void => {
  let missing: MissingFile;

  beforeAll(async (): Promise<void> => {
    missing = await missingFixture('customer');
  });

  describe('GIVEN an answer shaped like the projection', (): void => {
    it('WHEN normalized THEN is returned as it is', (): void => {
      const answer = normalizedAnswer(CUSTOMER_FILL, missing);

      expect(answer).toBe(CUSTOMER_FILL);
    });
  });

  describe('GIVEN an answer wrapped in one extra key', (): void => {
    it.each(['missing', 'data', 'result', 'anything'])('WHEN wrapped in %s THEN the wrapper is removed', (key: string): void => {
      const wrapped = { [key]: CUSTOMER_FILL };

      const answer = normalizedAnswer(wrapped, missing);

      expect(answer).toStrictEqual(CUSTOMER_FILL);
    });
  });

  describe('GIVEN a projection under one object-shape key', (): void => {
    it('WHEN the answer omits that key THEN it is wrapped in it', (): void => {
      const answer = normalizedAnswer(STATUS, DATA_MISSING);

      expect(answer).toStrictEqual({ data: STATUS });
    });

    it('WHEN the answer already has that key THEN is returned as it is', (): void => {
      const shaped = { data: STATUS };

      const answer = normalizedAnswer(shaped, DATA_MISSING);

      expect(answer).toBe(shaped);
    });

    it('WHEN the answer sits under another key instead THEN it is moved under the object-shape key', (): void => {
      const wrapped = { result: STATUS };

      const answer = normalizedAnswer(wrapped, DATA_MISSING);

      expect(answer).toStrictEqual({ data: STATUS });
    });
  });

  describe('GIVEN an answer that matches no missing path in any shape', (): void => {
    it.each<unknown>(['text', null, [1], { other: 1 }])('WHEN %j is normalized THEN is returned as it is', (value: unknown): void => {
      const answer = normalizedAnswer(value, missing);

      expect(answer).toBe(value);
    });
  });
});
