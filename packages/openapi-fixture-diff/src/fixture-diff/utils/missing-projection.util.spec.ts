import { describe, expect, it } from 'vitest';

import { missingProjection } from './missing-projection.util.ts';
import type { MissingEntry } from '../common/missing.type.ts';

const TEXT_SCHEMA = { type: 'string' } as const;
const COUNT_SCHEMA = { type: 'integer' } as const;

const EMAIL_PROPERTIES = { email: TEXT_SCHEMA };
const CUSTOMER_SCHEMA = { type: 'object', required: ['email'], properties: EMAIL_PROPERTIES };
const LINE_PROPERTIES = { sku: TEXT_SCHEMA, quantity: COUNT_SCHEMA };
const LINE_ITEMS = { type: 'object', required: ['sku', 'quantity'], properties: LINE_PROPERTIES };
const LINES_SCHEMA = { type: 'array', items: LINE_ITEMS };
const ROOT_PROPERTIES = { id: TEXT_SCHEMA, customer: CUSTOMER_SCHEMA, lines: LINES_SCHEMA };
const PROJECTION = { type: 'object', required: ['id', 'customer', 'lines'], properties: ROOT_PROPERTIES };

const EMPTY_PROJECTION = { type: 'object', required: [], properties: {} };

const entries: MissingEntry[] = [
  { path: 'id', schema: TEXT_SCHEMA },
  { path: 'customer.email', schema: TEXT_SCHEMA },
  { path: 'lines[0].sku', schema: TEXT_SCHEMA },
  { path: 'lines[2].quantity', schema: COUNT_SCHEMA }
];

describe('FEATURE: missing-field schema projection', (): void => {
  describe('GIVEN missing entries at the top level, inside an object and across array indices', (): void => {
    it('WHEN projecting THEN the nested schema unions the array keys and requires every missing key', (): void => {
      const projection = missingProjection(entries);

      expect(projection).toStrictEqual(PROJECTION);
    });
  });

  describe('GIVEN no missing entries', (): void => {
    it('WHEN projecting THEN the schema is an object without properties', (): void => {
      const projection = missingProjection([]);

      expect(projection).toStrictEqual(EMPTY_PROJECTION);
    });
  });
});
