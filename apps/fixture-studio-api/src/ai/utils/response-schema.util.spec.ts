import { isRecord } from '@fixture-automation/shared';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { beforeAll, describe, expect, it } from 'vitest';

import { responseSchema } from './response-schema.util.ts';
import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { missingFixture } from '../../test/utils/studio-spec.spec.util.ts';
import { schemaKeywords, schemaReferences } from '../test/utils/schema-references.spec.util.ts';

const JSON_SCHEMA_2020 = 'https://json-schema.org/draft/2020-12/schema';
const OPENAPI_KEYWORDS = ['discriminator', 'example', 'examples', 'externalDocs', 'nullable', 'readOnly', 'writeOnly', 'xml'];
const EMPTY: Record<string, unknown> = {};

const pointerName = (reference: string): string => reference.slice('#/$defs/'.length).replaceAll('~1', '/');

const recordAt = (value: unknown, key: string): Record<string, unknown> => {
  if (!isRecord(value)) return EMPTY;

  const child = value[key];

  if (!isRecord(child)) return EMPTY;

  return child;
};

const isBundledIn = (schema: Record<string, unknown>): ((reference: string) => boolean) => {
  const defs = recordAt(schema, '$defs');

  return (reference: string): boolean => Object.hasOwn(defs, pointerName(reference));
};

const strictValidator = (): Ajv2020 => new Ajv2020({ strict: true, allowUnionTypes: true, validateFormats: false });

describe('FEATURE: response schema', (): void => {
  let references: MissingFile;
  let annotated: MissingFile;

  beforeAll(async (): Promise<void> => {
    references = await missingFixture('references');
    annotated = await missingFixture('annotated');
  });

  describe('GIVEN a missing projection referencing components', (): void => {
    it('WHEN built THEN declares JSON Schema 2020-12, keeps the projection at the root and bundles the components', (): void => {
      const schema = responseSchema(references);

      const defNames = Object.keys(recordAt(schema, '$defs'));

      expect(schema).toMatchObject({ $schema: JSON_SCHEMA_2020, type: 'object', required: ['customer'] });
      expect(defNames).toStrictEqual(['customer', 'address', 'a/b']);
    });

    it('WHEN built THEN every component pointer moves to #/$defs and resolves to a bundled schema', (): void => {
      const schema = responseSchema(references);

      const local = schemaReferences(schema).filter((reference: string): boolean => reference.startsWith('#'));

      expect(local).toStrictEqual(['#/$defs/customer', '#/$defs/address', '#/$defs/a~1b']);
      expect(local.every(isBundledIn(schema))).toBe(true);
    });

    it('WHEN built THEN the projection root accepts only the missing keys', (): void => {
      const schema = responseSchema(references);

      expect(schema['additionalProperties']).toBe(false);
    });

    it('WHEN a reference is not a component pointer THEN it is left as it was', (): void => {
      const schema = responseSchema(references);

      expect(schemaReferences(schema)).toContain('https://example.com/other.json');
    });

    it('WHEN built THEN the input is not mutated', (): void => {
      const before = JSON.stringify(references);

      responseSchema(references);

      expect(JSON.stringify(references)).toBe(before);
    });
  });

  describe('GIVEN an OpenAPI 3.0 projection with annotations and extensions', (): void => {
    it('WHEN built THEN no OpenAPI, annotation, extension or nested $schema keyword remains', (): void => {
      const schema = responseSchema(annotated);

      const keywords = schemaKeywords(schema);
      const extensions = keywords.filter((keyword: string): boolean => keyword.startsWith('x-'));
      const schemaDeclarations = keywords.filter((keyword: string): boolean => keyword === '$schema');

      expect(keywords.filter((keyword: string): boolean => OPENAPI_KEYWORDS.includes(keyword))).toStrictEqual([]);
      expect(extensions).toStrictEqual([]);
      expect(schemaDeclarations).toHaveLength(1);
    });

    it('WHEN built THEN properties named like dropped keywords survive', (): void => {
      const schema = responseSchema(annotated);

      const propertyNames = Object.keys(recordAt(schema, 'properties'));

      expect(propertyNames).toStrictEqual(['customer', 'total', 'example', 'x-rate']);
    });

    it('WHEN built THEN nullable becomes a null type union', (): void => {
      const schema = responseSchema(annotated);

      const example = recordAt(recordAt(schema, 'properties'), 'example');
      const address = recordAt(recordAt(schema, '$defs'), 'address');

      expect(example).toStrictEqual({ type: ['string', 'null'] });
      expect(address['type']).toStrictEqual(['object', 'null']);
    });

    it('WHEN built THEN draft-04 boolean exclusive bounds become numeric ones', (): void => {
      const schema = responseSchema(annotated);

      const total = recordAt(recordAt(schema, 'properties'), 'total');

      expect(total).toStrictEqual({ type: 'integer', exclusiveMinimum: 0, maximum: 100 });
    });

    it('WHEN built THEN every reference resolves inside the document', (): void => {
      const schema = responseSchema(annotated);

      const local = schemaReferences(schema);

      expect(local.length).toBeGreaterThan(0);
      expect(local.every(isBundledIn(schema))).toBe(true);
    });

    it('WHEN compiled by a strict Ajv 2020-12 validator THEN it compiles and enforces the converted rules', (): void => {
      const schema = responseSchema(annotated);
      const person = { kind: 'person' };
      const valid = { customer: person, total: 1, example: null, 'x-rate': 1.5 };
      const atExclusiveBound = { ...valid, total: 0 };

      const validate = strictValidator().compile(schema);

      expect(validate(valid)).toBe(true);
      expect(validate(atExclusiveBound)).toBe(false);
    });
  });

  describe('GIVEN a property literally named $ref', (): void => {
    it('WHEN built THEN the references inside its schema are rewritten too', (): void => {
      const property = { $ref: '#/components/schemas/customer' };
      const properties = { $ref: property };
      const schema = { type: 'object', properties };
      const shaped: MissingFile = { ...references, schema };

      const built = responseSchema(shaped);

      expect(schemaReferences(built['properties'])).toStrictEqual(['#/$defs/customer']);
    });
  });

  describe('GIVEN formats Chrome does and does not accept', (): void => {
    it('WHEN built THEN keeps only the formats Chrome accepts on a string', (): void => {
      const currency = { type: 'string', format: 'currency' };
      const created = { type: 'integer', format: 'unix-time' };
      const due = { type: ['string', 'null'], format: 'date-time' };
      const format = { type: 'string' };
      const properties = { currency, created, due, format };
      const schema = { type: 'object', properties };
      const shaped: MissingFile = { ...references, schema };
      const plainCurrency = { type: 'string' };
      const plainCreated = { type: 'integer' };

      const built = recordAt(responseSchema(shaped), 'properties');

      expect(built).toStrictEqual({ currency: plainCurrency, created: plainCreated, due, format });
    });
  });

  describe('GIVEN a projection that is not an object', (): void => {
    it('WHEN built THEN holds only $schema and $defs', (): void => {
      const shaped: MissingFile = { ...references, schema: true };

      const schema = responseSchema(shaped);

      expect(Object.keys(schema)).toStrictEqual(['$schema', '$defs']);
    });
  });
});
