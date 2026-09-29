import { describe, expect, it } from 'vitest';

import { schemaDialect } from './schema-dialect.util.ts';

const OAS_BASE_DIALECT = 'https://spec.openapis.org/oas/3.1/dialect/base';
const DRAFT_2020_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

describe('FEATURE: schema dialect detection', (): void => {
  describe('GIVEN no openapi version', (): void => {
    it('WHEN detecting THEN falls back to draft-07', (): void => {
      expect(schemaDialect(undefined, undefined)).toBe('draft-07');
    });
  });

  describe('GIVEN an OpenAPI 3.0 version', (): void => {
    it('WHEN detecting THEN returns openapi-30', (): void => {
      expect(schemaDialect('3.0.3', undefined)).toBe('openapi-30');
    });

    it('WHEN a JSON Schema dialect is declared THEN ignores it', (): void => {
      expect(schemaDialect('3.0.0', 'http://json-schema.org/draft-07/schema#')).toBe('openapi-30');
    });
  });

  describe('GIVEN an OpenAPI 3.1 version', (): void => {
    it.each([
      ['no dialect', undefined],
      ['the OAS base dialect', OAS_BASE_DIALECT],
      ['the draft 2020-12 dialect', DRAFT_2020_DIALECT]
    ])('WHEN the spec declares %s THEN returns openapi-31', (_case: string, dialect: string | undefined): void => {
      expect(schemaDialect('3.1.1', dialect)).toBe('openapi-31');
    });

    it('WHEN the spec declares another dialect THEN throws naming it', (): void => {
      const detect = (): unknown => schemaDialect('3.1.0', 'http://json-schema.org/draft-07/schema#');

      expect(detect).toThrow('unsupported JSON Schema dialect "http://json-schema.org/draft-07/schema#"');
    });
  });

  describe('GIVEN an unsupported OpenAPI version', (): void => {
    it.each([
      ['a Swagger 2.0 version', '2.0'],
      ['a future major version', '4.0.0'],
      ['a version without a patch number', '3.1']
    ])('WHEN the spec declares %s THEN throws naming the version', (_case: string, version: string): void => {
      expect((): unknown => schemaDialect(version, undefined)).toThrow(`unsupported OpenAPI version "${version}"`);
    });
  });
});
