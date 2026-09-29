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

const envelopeMissing = (missing: MissingFile): MissingFile => {
  const paths = missing.paths.map((path: string): string => `data.${path}`);
  const properties = { data: missing.schema };
  const schema = { type: 'object', required: ['data'], properties };
  const envelope: MissingFile = { ...missing, paths, schema };

  return envelope;
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
