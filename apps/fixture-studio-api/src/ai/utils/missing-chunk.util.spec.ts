import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { missingChunk } from './missing-chunk.util.ts';
import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { missingFixture } from '../../test/utils/studio-spec.spec.util.ts';

const LISTED_PATHS = 'id, customer.email, lines[0].sku, lines[1].tax, lines[2].quantity';
const TEXT_SCHEMA = { type: 'string' };
const COUNT_SCHEMA = { type: 'integer' };
const EMAIL_REFERENCE = { $ref: '#/components/schemas/email' };
const TAX_REFERENCE = { $ref: '#/components/schemas/tax' };
const QUANTITY_PROPERTIES = { quantity: COUNT_SCHEMA };
const QUANTITY_ITEMS = { type: 'object', required: ['quantity'], properties: QUANTITY_PROPERTIES };
const QUANTITY_LINES = { type: 'array', items: QUANTITY_ITEMS };
const ID_QUANTITY_PROPERTIES = { id: TEXT_SCHEMA, lines: QUANTITY_LINES };
const ID_QUANTITY_SCHEMA = { type: 'object', required: ['id', 'lines'], properties: ID_QUANTITY_PROPERTIES };
const EMAIL_PROPERTIES = { email: EMAIL_REFERENCE };
const EMAIL_CUSTOMER = { type: 'object', required: ['email'], properties: EMAIL_PROPERTIES };
const CUSTOMER_PROPERTIES = { customer: EMAIL_CUSTOMER };
const CUSTOMER_SCHEMA = { type: 'object', required: ['customer'], properties: CUSTOMER_PROPERTIES };
const TAX_PROPERTIES = { tax: TAX_REFERENCE };
const TAX_ITEMS = { type: 'object', required: ['tax'], properties: TAX_PROPERTIES };
const TAX_LINES = { type: 'array', items: TAX_ITEMS };
const TAX_ROOT_PROPERTIES = { lines: TAX_LINES };
const TAX_SCHEMA = { type: 'object', required: ['lines'], properties: TAX_ROOT_PROPERTIES };
const TAX_ENVELOPE_PROPERTIES = { data: TAX_SCHEMA };
const TAX_ENVELOPE = { type: 'object', required: ['data'], properties: TAX_ENVELOPE_PROPERTIES };
const HOLDING_REFERENCE = { $ref: '#/components/schemas/holding' };
const HOLDING_PROPERTIES = { isin: TEXT_SCHEMA, sustainable_selection_type: TEXT_SCHEMA };
const HOLDING_SCHEMA = { type: 'object', required: ['isin', 'sustainable_selection_type'], properties: HOLDING_PROPERTIES };
const HOLDING_SCHEMAS = { holding: HOLDING_SCHEMA };
const HOLDING_COMPONENTS = { schemas: HOLDING_SCHEMAS };
const HOLDINGS_SCHEMA = { type: 'array', items: HOLDING_REFERENCE };
const HOLDINGS_PROPERTIES = { holdings: HOLDINGS_SCHEMA };
const ACCOUNT_SCHEMA = { type: 'object', required: ['holdings'], properties: HOLDINGS_PROPERTIES };
const ACCOUNTS_SCHEMA = { type: 'array', items: ACCOUNT_SCHEMA };
const ACCOUNTS_PROPERTIES = { accounts: ACCOUNTS_SCHEMA };
const HOLDINGS_ROOT = { type: 'object', required: ['accounts'], properties: ACCOUNTS_PROPERTIES };
const SELECTION_PATH = 'accounts[1].holdings[0].sustainable_selection_type';
const HOLDING_PATHS = ['accounts[0].holdings', SELECTION_PATH];
const SELECTION_PROPERTIES = { sustainable_selection_type: TEXT_SCHEMA };
const SELECTION_SCHEMA = { type: 'object', required: ['sustainable_selection_type'], properties: SELECTION_PROPERTIES };
const SELECTION_HOLDINGS = { type: 'array', items: SELECTION_SCHEMA };
const SELECTION_HOLDINGS_PROPERTIES = { holdings: SELECTION_HOLDINGS };
const SELECTION_ACCOUNT = { type: 'object', required: ['holdings'], properties: SELECTION_HOLDINGS_PROPERTIES };
const SELECTION_ACCOUNTS = { type: 'array', items: SELECTION_ACCOUNT };
const SELECTION_ACCOUNTS_PROPERTIES = { accounts: SELECTION_ACCOUNTS };
const SELECTION_ROOT = { type: 'object', required: ['accounts'], properties: SELECTION_ACCOUNTS_PROPERTIES };
const ANY_OF_HOLDING = { anyOf: [HOLDING_REFERENCE] };
const ONE_OF_HOLDING = { oneOf: [HOLDING_REFERENCE] };
const ALL_OF_HOLDING = { allOf: [HOLDING_REFERENCE] };
const CYCLE_REFERENCE = { $ref: '#/components/schemas/cycle' };
const CYCLE_SCHEMA = { anyOf: [CYCLE_REFERENCE] };
const GHOST_REFERENCE = { $ref: '#/components/schemas/ghost' };
const OBJECT_TYPE = { type: 'object' };
const LOOP_A_REFERENCE = { $ref: '#/components/schemas/loopA' };
const LOOP_B_REFERENCE = { $ref: '#/components/schemas/loopB' };
const LOOP_A_SCHEMA = { allOf: [OBJECT_TYPE], anyOf: [LOOP_B_REFERENCE] };
const LOOP_B_SCHEMA = { allOf: [OBJECT_TYPE], anyOf: [LOOP_A_REFERENCE] };
const LOOP_SCHEMAS = { loopA: LOOP_A_SCHEMA, loopB: LOOP_B_SCHEMA };
const DIAMOND_DEPTH = 40;

/** `depth` levels whose members carry `allOf` and branch twice into the next level, which never has the key. */
const diamondSchemas = (depth: number): Record<string, unknown> => {
  const schemas: Record<string, unknown> = { [`level${depth}`]: OBJECT_TYPE };

  for (let level = 0; level < depth; level++) {
    const next = { $ref: `#/components/schemas/level${level + 1}` };
    const twin = { $ref: `#/components/schemas/level${level + 1}` };

    schemas[`level${level}`] = { allOf: [OBJECT_TYPE], anyOf: [next, twin] };
  }

  return schemas;
};

const envelopeMissing = (missing: MissingFile): MissingFile => {
  const paths = missing.paths.map((path: string): string => `data.${path}`);
  const properties = { data: missing.schema };
  const schema = { type: 'object', required: ['data'], properties };
  const envelope: MissingFile = { ...missing, paths, schema };

  return envelope;
};

/** The accounts/holdings missing file with the whole-path `holdings` items replaced by `items`. */
const holdingsMissing = (missing: MissingFile, items: unknown, schemas: Record<string, unknown>): MissingFile => {
  const holdings = { type: 'array', items };
  const properties = { holdings };
  const account = { type: 'object', required: ['holdings'], properties };
  const accounts = { type: 'array', items: account };
  const rootProperties = { accounts };
  const schema = { type: 'object', required: ['accounts'], properties: rootProperties };
  const components = { schemas };
  const collapsed: MissingFile = { ...missing, paths: HOLDING_PATHS, schema, components };

  return collapsed;
};

describe('FEATURE: missing chunk', (): void => {
  let missing: MissingFile;

  beforeAll(async (): Promise<void> => {
    missing = await missingFixture('lines');
  });

  describe('GIVEN a subset of top-level and array index paths', (): void => {
    it('WHEN chunked THEN the paths keep the missing order', (): void => {
      const chunk = missingChunk(missing, ['lines[2].quantity', 'id']);

      expect(chunk.paths).toStrictEqual(['id', 'lines[2].quantity']);
    });

    it('WHEN chunked THEN the schema projects only those paths, the array index collapsing into items', (): void => {
      const chunk = missingChunk(missing, ['lines[2].quantity', 'id']);

      expect(chunk.schema).toStrictEqual(ID_QUANTITY_SCHEMA);
    });

    it('WHEN chunked THEN no component survives and the schema name and dialect stay', (): void => {
      const chunk = missingChunk(missing, ['id']);

      expect(chunk.components.schemas).toStrictEqual({});
      expect(chunk.schemaName).toBe('invoice');
      expect(chunk.dialect).toBe('openapi-30');
    });
  });

  describe('GIVEN a nested object path', (): void => {
    it('WHEN chunked THEN the schema nests to it and keeps only the component it references', (): void => {
      const chunk = missingChunk(missing, ['customer.email']);

      expect(chunk.schema).toStrictEqual(CUSTOMER_SCHEMA);
      expect(Object.keys(chunk.components.schemas)).toStrictEqual(['email']);
    });
  });

  describe('GIVEN an array index path whose leaf references a component that references another', (): void => {
    it('WHEN chunked THEN both components are kept transitively', (): void => {
      const chunk = missingChunk(missing, ['lines[1].tax']);

      expect(chunk.schema).toStrictEqual(TAX_SCHEMA);
      expect(Object.keys(chunk.components.schemas).sort()).toStrictEqual(['rate', 'tax']);
    });
  });

  describe('GIVEN a missing file wrapped in an objectShape envelope', (): void => {
    it('WHEN chunked by a prefixed path THEN the envelope wraps the chunk', (): void => {
      const envelope = envelopeMissing(missing);

      const chunk = missingChunk(envelope, ['data.lines[1].tax']);

      expect(chunk.paths).toStrictEqual(['data.lines[1].tax']);
      expect(chunk.schema).toStrictEqual(TAX_ENVELOPE);
    });
  });

  describe('GIVEN a path the missing file does not list', (): void => {
    it('WHEN chunked THEN fails naming the path with a suggestion', (): void => {
      const chunking = (): MissingFile => missingChunk(missing, ['id', 'lines[0].skus']);

      expect(chunking).toThrow(FixtureError);
      expect(chunking).toThrow('"lines[0].skus" is not a missing path');
      expect(chunking).toThrow(expect.objectContaining({ fix: `available: ${LISTED_PATHS}` }));
    });
  });

  describe('GIVEN a path another index already lists whole, through a component reference', (): void => {
    it('WHEN chunked THEN the path schema resolves through the reference', (): void => {
      const collapsed: MissingFile = { ...missing, paths: HOLDING_PATHS, schema: HOLDINGS_ROOT, components: HOLDING_COMPONENTS };

      const chunk = missingChunk(collapsed, [SELECTION_PATH]);

      expect(chunk.schema).toStrictEqual(SELECTION_ROOT);
    });

    it.each([
      ['anyOf', ANY_OF_HOLDING],
      ['oneOf', ONE_OF_HOLDING],
      ['allOf', ALL_OF_HOLDING]
    ])(
      'WHEN the whole-path leaf wraps the reference in %s THEN the path schema resolves through it',
      (_kind: string, items: unknown): void => {
        const collapsed = holdingsMissing(missing, items, HOLDING_SCHEMAS);

        const chunk = missingChunk(collapsed, [SELECTION_PATH]);

        expect(chunk.schema).toStrictEqual(SELECTION_ROOT);
      }
    );

    it.each([
      ['a reference cycle', CYCLE_REFERENCE, { cycle: CYCLE_SCHEMA }],
      ['an unresolved reference', GHOST_REFERENCE, {}],
      ['a reference cycle whose members carry allOf', LOOP_A_REFERENCE, LOOP_SCHEMAS],
      ['a deep allOf diamond without the key', { $ref: '#/components/schemas/level0' }, diamondSchemas(DIAMOND_DEPTH)]
    ])(
      'WHEN the leaf holds %s THEN fails asking for a fresh diff',
      (_kind: string, items: unknown, schemas: Record<string, unknown>): void => {
        const collapsed = holdingsMissing(missing, items, schemas);

        const chunking = (): MissingFile => missingChunk(collapsed, [SELECTION_PATH]);

        expect(chunking).toThrow(FixtureError);
        expect(chunking).toThrow(`missing path "${SELECTION_PATH}" has no schema`);
      }
    );
  });

  describe('GIVEN a listed path its schema lacks', (): void => {
    it('WHEN chunked THEN fails asking for a fresh diff', (): void => {
      const broken: MissingFile = { ...missing, paths: ['ghost.name'] };

      const chunking = (): MissingFile => missingChunk(broken, ['ghost.name']);

      expect(chunking).toThrow('missing path "ghost.name" has no schema');
    });
  });

  describe('GIVEN a component that is not an object schema', (): void => {
    it('WHEN chunked THEN fails asking for a fresh diff', (): void => {
      const schemas = { ...missing.components.schemas, flag: true };
      const components = { schemas };
      const broken: MissingFile = { ...missing, components };

      const chunking = (): MissingFile => missingChunk(broken, ['id']);

      expect(chunking).toThrow('missing.components.schemas holds a non-object schema');
    });
  });
});
