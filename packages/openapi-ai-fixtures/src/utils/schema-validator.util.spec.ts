import { describe, expect, it } from 'vitest';

import { compileFixtureSchema } from './schema-validator.util.ts';
import { SCHEMA_IDENTIFIER } from '../common/schema-identifier.const.ts';

const EMAIL_SCHEMA = { type: 'string', format: 'email' };
const CUSTOM_FORMAT_SCHEMA = { type: 'string', format: 'x-money' };
const EXCLUSIVE_DRAFT4_SCHEMA = { type: 'integer', maximum: 5, exclusiveMaximum: true };
const TUPLE_PREFIX = [{ type: 'string' }];
const TUPLE_SCHEMA = { type: 'array', prefixItems: TUPLE_PREFIX, items: false };
const STRICT_SCHEMA = { type: 'object', required: ['id', 'name'], additionalProperties: false };
const CUSTOM_SCHEMAS = { money: CUSTOM_FORMAT_SCHEMA };
const CUSTOM_COMPONENTS = { schemas: CUSTOM_SCHEMAS };
const CUSTOM_DOCUMENT = {
  $schema: SCHEMA_IDENTIFIER['openapi-31'],
  $ref: '#/components/schemas/money',
  components: CUSTOM_COMPONENTS
};

describe('FEATURE: fixture schema compilation', (): void => {
  describe('GIVEN a draft-07 schema with a standard format', (): void => {
    describe('WHEN validating', (): void => {
      const validate = compileFixtureSchema(EMAIL_SCHEMA, 'draft-07');

      it('THEN accepts a value in that format', (): void => {
        expect(validate('dev@example.com')).toBe(true);
      });

      it('THEN rejects a value outside that format', (): void => {
        expect(validate('not-an-email')).toBe(false);
      });
    });
  });

  describe('GIVEN an openapi-30 schema using draft-04 boolean exclusiveMaximum', (): void => {
    describe('WHEN validating', (): void => {
      const validate = compileFixtureSchema(EXCLUSIVE_DRAFT4_SCHEMA, 'openapi-30');

      it('THEN rejects the maximum itself', (): void => {
        expect(validate(5)).toBe(false);
      });

      it('THEN accepts a value below the maximum', (): void => {
        expect(validate(4)).toBe(true);
      });
    });
  });

  describe('GIVEN an openapi-31 schema using prefixItems', (): void => {
    describe('WHEN validating', (): void => {
      const validate = compileFixtureSchema(TUPLE_SCHEMA, 'openapi-31');

      it('THEN accepts the declared tuple', (): void => {
        expect(validate(['a'])).toBe(true);
      });

      it('THEN rejects extra tuple entries', (): void => {
        expect(validate(['a', 1])).toBe(false);
      });
    });
  });

  describe('GIVEN a document whose component declares an unknown format', (): void => {
    it('WHEN validating THEN treats the format as a pass-through', (): void => {
      const validate = compileFixtureSchema(CUSTOM_DOCUMENT, 'openapi-31');

      expect(validate('anything')).toBe(true);
    });
  });

  describe('GIVEN a schema that a value violates twice', (): void => {
    it('WHEN validating THEN reports every error', (): void => {
      const validate = compileFixtureSchema(STRICT_SCHEMA, 'draft-07');

      validate({ extra: true });

      expect(validate.errors).toHaveLength(3);
    });
  });

  describe('GIVEN a numeric schema', (): void => {
    it('WHEN validating a string number THEN rejects without coercion', (): void => {
      const validate = compileFixtureSchema({ type: 'number' }, 'draft-07');

      expect(validate('1')).toBe(false);
    });
  });
});
