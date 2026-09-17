import { describe, expect, it } from 'vitest';

import { schemaDocument } from './schema-document.util.ts';
import { SCHEMA_IDENTIFIER } from '../common/schema-identifier.const.ts';
import type { SchemaDialect } from '../common/schema.type.ts';

const STRING = { type: 'string' };
const INVOICE_PROPERTIES = { id: STRING };
const INVOICE = { type: 'object', properties: INVOICE_PROPERTIES };
const EXTENSIBLE_ENUM = { type: 'string', format: 'x-extensible-enum', enum: ['paid'] };
const NORMALIZED_ENUM = { type: 'string', format: 'x-extensible-enum' };
const UNKNOWN_KEYWORD = { type: 'string', maxWords: 3 };
const NESTED_UNKNOWN_PROPERTIES = { note: UNKNOWN_KEYWORD };
const NESTED_UNKNOWN = { type: 'object', properties: NESTED_UNKNOWN_PROPERTIES };
const REFERENCE_WITH_SIBLINGS = { $ref: '#/components/schemas/Invoice', maxWords: 3 };
const OAS_BASE_DIALECT = 'https://spec.openapis.org/oas/3.1/dialect/base';

const build = (schema: unknown, dialect: SchemaDialect): unknown => schemaDocument({ Target: schema }, 'Target', dialect);

describe('FEATURE: schema validation document', (): void => {
  describe('GIVEN valid component schemas', (): void => {
    describe('WHEN building the document', (): void => {
      const document = schemaDocument({ Invoice: INVOICE, Status: EXTENSIBLE_ENUM }, 'Invoice', 'openapi-31');

      it('THEN points at the target under the dialect identifier', (): void => {
        expect(document).toMatchObject({ $schema: SCHEMA_IDENTIFIER['openapi-31'], $ref: '#/components/schemas/Invoice' });
      });

      it('THEN carries every schema normalized', (): void => {
        const expectedSchemas = { Invoice: INVOICE, Status: NORMALIZED_ENUM };
        const expectedComponents = { schemas: expectedSchemas };

        expect(document).toMatchObject({ components: expectedComponents });
      });

      it('THEN leaves the source schemas untouched', (): void => {
        expect(EXTENSIBLE_ENUM).toStrictEqual({ type: 'string', format: 'x-extensible-enum', enum: ['paid'] });
      });
    });

    it('WHEN the target name needs escaping THEN escapes the pointer', (): void => {
      const document = schemaDocument({ 'a/b~c d': INVOICE }, 'a/b~c d', 'draft-07');

      expect(document).toMatchObject({ $ref: '#/components/schemas/a~1b~0c%20d' });
    });

    it('WHEN there are no schemas THEN still builds the document', (): void => {
      const expectedComponents = { schemas: {} };

      expect(schemaDocument({}, 'Missing', 'draft-07')).toMatchObject({ components: expectedComponents });
    });

    it('WHEN a schema uses an x- extension keyword THEN accepts it', (): void => {
      expect((): unknown => build({ type: 'string', 'x-note': 1 }, 'openapi-30')).not.toThrow();
    });
  });

  describe('GIVEN a non-object schema', (): void => {
    it('WHEN the schema is a string THEN skips validation', (): void => {
      expect((): unknown => build('string', 'openapi-30')).not.toThrow();
    });

    it('WHEN a boolean schema appears under draft-07 THEN accepts it', (): void => {
      expect((): unknown => build(true, 'draft-07')).not.toThrow();
    });

    it('WHEN a boolean schema appears under openapi-30 THEN throws', (): void => {
      expect((): unknown => build(false, 'openapi-30')).toThrow('OpenAPI 3.0 schema positions require Schema Objects');
    });
  });

  describe('GIVEN an unsupported keyword', (): void => {
    it.each<[SchemaDialect, string]>([
      ['draft-07', 'JSON Schema draft-07'],
      ['openapi-30', 'OpenAPI 3.0'],
      ['openapi-31', 'OpenAPI 3.1']
    ])('WHEN the dialect is %s THEN names the dialect and keyword', (dialect: SchemaDialect, name: string): void => {
      expect((): unknown => build(UNKNOWN_KEYWORD, dialect)).toThrow(`${name} does not support "maxWords"`);
    });

    it('WHEN the keyword sits below properties THEN still throws', (): void => {
      expect((): unknown => build(NESTED_UNKNOWN, 'openapi-31')).toThrow('does not support "maxWords"');
    });

    it('WHEN it sits beside a $ref under draft-07 THEN ignores the sibling', (): void => {
      expect((): unknown => build(REFERENCE_WITH_SIBLINGS, 'draft-07')).not.toThrow();
    });

    it('WHEN it sits beside a $ref under openapi-31 THEN throws', (): void => {
      expect((): unknown => build(REFERENCE_WITH_SIBLINGS, 'openapi-31')).toThrow('does not support "maxWords"');
    });
  });

  describe('GIVEN a declared $schema resource dialect', (): void => {
    it('WHEN it matches the dialect identifier THEN accepts it', (): void => {
      const schema = { $schema: SCHEMA_IDENTIFIER['draft-07'], type: 'string' };

      expect((): unknown => build(schema, 'draft-07')).not.toThrow();
    });

    it('WHEN it is the OAS base dialect under openapi-31 THEN accepts it', (): void => {
      const schema = { $schema: OAS_BASE_DIALECT, type: 'string' };

      expect((): unknown => build(schema, 'openapi-31')).not.toThrow();
    });

    it('WHEN it is another dialect THEN throws naming it', (): void => {
      const schema = { $schema: SCHEMA_IDENTIFIER['draft-07'], type: 'string' };

      expect((): unknown => build(schema, 'openapi-31')).toThrow(
        `unsupported schema resource dialect "${SCHEMA_IDENTIFIER['draft-07']}"`
      );
    });

    it('WHEN it is not a string THEN throws', (): void => {
      expect((): unknown => build({ $schema: 7 }, 'draft-07')).toThrow('schema $schema dialect must be a string');
    });
  });

  describe('GIVEN openapi-30 value rules', (): void => {
    it.each([
      ['a type list', { type: ['string', 'null'] }, 'OpenAPI 3.0 schema type must be a string'],
      ['a null type', { type: 'null' }, 'OpenAPI 3.0 uses nullable rather than a null type'],
      ['a non-boolean nullable', { type: 'string', nullable: 'yes' }, 'OpenAPI 3.0 nullable must be a boolean'],
      ['an array without items', { type: 'array' }, 'OpenAPI 3.0 array schemas require an items object']
    ])('WHEN a schema has %s THEN throws', (_case: string, schema: unknown, message: string): void => {
      expect((): unknown => build(schema, 'openapi-30')).toThrow(message);
    });

    it('WHEN a nullable array has an items object THEN accepts it', (): void => {
      const schema = { type: 'array', items: STRING, nullable: true };

      expect((): unknown => build(schema, 'openapi-30')).not.toThrow();
    });
  });

  describe('GIVEN an openapi-31 schema with nullable', (): void => {
    it('WHEN building THEN throws the nullable message', (): void => {
      expect((): unknown => build({ type: 'string', nullable: true }, 'openapi-31')).toThrow(
        'OpenAPI 3.1 does not support nullable; use a null type instead'
      );
    });
  });

  describe('GIVEN a format keyword', (): void => {
    it('WHEN it is a string THEN accepts it', (): void => {
      expect((): unknown => build({ type: 'string', format: 'uuid' }, 'openapi-31')).not.toThrow();
    });

    it('WHEN it is not a string THEN throws', (): void => {
      expect((): unknown => build({ type: 'string', format: 1 }, 'openapi-31')).toThrow('schema format must be a string');
    });
  });
});
