import { describe, expect, it } from 'vitest';

import { missingEntries } from './missing-walk.util.ts';
import type { MissingEntry } from '../common/missing.type.ts';
import type { SpecSchema, SpecSchemas } from '../common/schema.type.ts';

const TEXT: SpecSchema = { type: 'string' };
const PARTY_REF: SpecSchema = { $ref: '#/components/schemas/party' };
const CUSTOMER_REF: SpecSchema = { $ref: '#/components/schemas/customer' };
const LINE_REF: SpecSchema = { $ref: '#/components/schemas/line' };
const SUPPLIER_REF: SpecSchema = { $ref: '#/components/schemas/supplier' };
const ORDER_REF: SpecSchema = { $ref: '#/components/schemas/order' };
const PARTY_PROPERTIES = { name: TEXT, country: TEXT };
const PARTY: SpecSchema = { type: 'object', required: ['name'], properties: PARTY_PROPERTIES };
const CUSTOMER_PROPERTIES = { email: TEXT, vat: TEXT };
const CUSTOMER_EXTRA: SpecSchema = { type: 'object', required: ['email'], properties: CUSTOMER_PROPERTIES };
const CUSTOMER: SpecSchema = { allOf: [PARTY_REF, CUSTOMER_EXTRA] };
const SUPPLIER_PROPERTIES = { supplierId: TEXT, region: TEXT };
const SUPPLIER: SpecSchema = { type: 'object', required: ['supplierId'], properties: SUPPLIER_PROPERTIES };
const SOURCE: SpecSchema = { anyOf: [TEXT, SUPPLIER_REF] };
const LINE_PROPERTIES = { sku: TEXT, source: SOURCE };
const LINE: SpecSchema = { type: 'object', required: ['sku', 'source'], properties: LINE_PROPERTIES };
const LINES: SpecSchema = { type: 'array', items: LINE_REF };
const ORDER_PROPERTIES = { id: TEXT, note: TEXT, customer: CUSTOMER_REF, lines: LINES, parent: ORDER_REF, flag: true };
const ORDER: SpecSchema = { type: 'object', required: ['id', 'customer', 'lines'], properties: ORDER_PROPERTIES };
const BARE_LIST: SpecSchema = { type: 'array' };
const BARE_OBJECT: SpecSchema = { type: 'object' };
const SCHEMAS: SpecSchemas = { party: PARTY, customer: CUSTOMER, supplier: SUPPLIER, line: LINE, order: ORDER };
const COMPLETE_CUSTOMER = { name: 'Ada', country: 'NL', email: 'ada@example.com', vat: 'NL01' };
const COMPLETE_LINE = { sku: 'sku_1', source: 'internal' };
const COMPLETE_ORDER = { id: 'or_1', customer: COMPLETE_CUSTOMER, lines: [COMPLETE_LINE] };
const PARENT_PATHS = ['parent.id', 'parent.note', 'parent.customer', 'parent.lines'];
const FIRST_SOURCE: SpecSchema = { anyOf: [TEXT] };
const REGIONAL_SOURCE = { region: 'eu' };

const walked = (schema: SpecSchema, value: unknown, requiredOnly: boolean, ancestry: string[] = []): MissingEntry[] => {
  return missingEntries({ schema, value, path: '', schemas: SCHEMAS, requiredOnly, ancestry });
};

const pathOf = (entry: MissingEntry): string => entry.path;

describe('FEATURE: missing-field schema walk', (): void => {
  describe('GIVEN a value holding every required field', (): void => {
    it('WHEN walking required fields only THEN nothing is missing', (): void => {
      const entries = walked(ORDER, COMPLETE_ORDER, true);

      expect(entries).toStrictEqual([]);
    });

    it('WHEN walking every field THEN the optional fields are missing and the boolean property is skipped', (): void => {
      const entries = walked(ORDER, COMPLETE_ORDER, false);

      expect(entries.map(pathOf)).toStrictEqual(['note', 'parent']);
    });
  });

  describe('GIVEN a value missing a required top-level field', (): void => {
    it('WHEN walking required fields only THEN the path is the bare key', (): void => {
      const value = { customer: COMPLETE_CUSTOMER, lines: [COMPLETE_LINE] };

      const entries = walked(ORDER, value, true);

      expect(entries).toStrictEqual([{ path: 'id', schema: TEXT }]);
    });
  });

  describe('GIVEN a nested object missing a field from each allOf member', (): void => {
    it('WHEN walking required fields only THEN the paths are dotted under the parent key', (): void => {
      const value = { ...COMPLETE_ORDER, customer: {} };

      const entries = walked(ORDER, value, true);

      expect(entries.map(pathOf)).toStrictEqual(['customer.name', 'customer.email']);
    });
  });

  describe('GIVEN an array element missing an anyOf property', (): void => {
    it('WHEN walking THEN the path carries the index and the schema keeps only the first member', (): void => {
      const lines = [COMPLETE_LINE, { sku: 'sku_2' }];
      const value = { ...COMPLETE_ORDER, lines };
      const expected: MissingEntry[] = [{ path: 'lines[1].source', schema: FIRST_SOURCE }];

      const entries = walked(ORDER, value, true);

      expect(entries).toStrictEqual(expected);
    });
  });

  describe('GIVEN an anyOf value shaped like its object member', (): void => {
    it('WHEN walking THEN the member fields it lacks are missing under the property path', (): void => {
      const lines = [{ sku: 'sku_1', source: REGIONAL_SOURCE }];
      const value = { ...COMPLETE_ORDER, lines };

      const entries = walked(ORDER, value, true);

      expect(entries.map(pathOf)).toStrictEqual(['lines[0].source.supplierId']);
    });
  });

  describe('GIVEN a cyclic property bottomed out as an empty object', (): void => {
    it('WHEN walking every field THEN its fields are missing but the cycle itself is not', (): void => {
      const value = { ...COMPLETE_ORDER, note: 'n', parent: {} };

      const entries = walked(ORDER, value, false);

      expect(entries.map(pathOf)).toStrictEqual(PARENT_PATHS);
    });
  });

  describe('GIVEN an array whose item schema is already being expanded', (): void => {
    it('WHEN walking THEN the elements are neither walked nor missing', (): void => {
      const entries = walked(LINES, [{}], true, ['line']);

      expect(entries).toStrictEqual([]);
    });
  });

  describe('GIVEN an array schema without items', (): void => {
    it('WHEN walking THEN nothing is missing', (): void => {
      const entries = walked(BARE_LIST, [{}], true);

      expect(entries).toStrictEqual([]);
    });
  });

  describe('GIVEN an object schema without properties', (): void => {
    it('WHEN walking THEN nothing is missing', (): void => {
      const entries = walked(BARE_OBJECT, {}, false);

      expect(entries).toStrictEqual([]);
    });
  });

  describe('GIVEN a primitive value against an object schema', (): void => {
    it('WHEN walking THEN nothing is missing', (): void => {
      const entries = walked(ORDER, 'or_1', false);

      expect(entries).toStrictEqual([]);
    });
  });
});
