import { describe, expect, it } from 'vitest';

import { normalizeSchema } from './schema-normalization.util.ts';

describe('FEATURE: schema normalization', (): void => {
  describe('GIVEN a schema whose format is x-extensible-enum', (): void => {
    it('WHEN normalizing THEN it drops the enum keyword and keeps the remaining keys', (): void => {
      const schema = { type: 'string', format: 'x-extensible-enum', enum: ['paid', 'open'] };
      const expected = { type: 'string', format: 'x-extensible-enum' };

      expect(normalizeSchema(schema, 'openapi-31')).toStrictEqual(expected);
    });
  });

  describe('GIVEN an enum schema carrying another format or no format', (): void => {
    it('WHEN normalizing THEN it keeps the enum keyword', (): void => {
      const formatted = { type: 'string', format: 'uuid', enum: ['a', 'b'] };
      const unformatted = { type: 'string', enum: ['a', 'b'] };

      expect(normalizeSchema(formatted, 'openapi-31')).toStrictEqual(formatted);
      expect(normalizeSchema(unformatted, 'openapi-31')).toStrictEqual(unformatted);
    });
  });

  describe('GIVEN x-extensible-enum schemas nested below properties and items', (): void => {
    it('WHEN normalizing THEN it drops the enum keyword at every level', (): void => {
      const status = { type: 'string', format: 'x-extensible-enum', enum: ['paid'] };
      const tag = { type: 'string', format: 'x-extensible-enum', enum: ['vip'] };
      const tags = { type: 'array', items: tag };
      const properties = { status, tags };
      const schema = { type: 'object', properties };
      const expectedStatus = { type: 'string', format: 'x-extensible-enum' };
      const expectedTag = { type: 'string', format: 'x-extensible-enum' };
      const expectedTags = { type: 'array', items: expectedTag };
      const expectedProperties = { status: expectedStatus, tags: expectedTags };
      const expected = { type: 'object', properties: expectedProperties };

      expect(normalizeSchema(schema, 'openapi-31')).toStrictEqual(expected);
    });
  });

  describe('GIVEN an openapi-30 nullable x-extensible-enum schema', (): void => {
    it('WHEN normalizing THEN it drops the enum keyword and widens the type with null', (): void => {
      const schema = { type: 'string', format: 'x-extensible-enum', enum: ['paid'], nullable: true };
      const expected = { type: ['string', 'null'], format: 'x-extensible-enum' };

      expect(normalizeSchema(schema, 'openapi-30')).toStrictEqual(expected);
    });
  });
});
