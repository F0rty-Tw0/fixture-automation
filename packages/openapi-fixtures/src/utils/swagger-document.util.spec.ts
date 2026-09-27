import { describe, expect, it } from 'vitest';

import { refuseSwagger } from './swagger-document.util.ts';

const SWAGGER_FIX = 'convert it to OpenAPI 3 first, for example with https://converter.swagger.io';

describe('FEATURE: Swagger 2.0 refusal', (): void => {
  describe('GIVEN a document with a swagger version', (): void => {
    it('WHEN checked THEN names the Swagger version with a conversion fix', (): void => {
      const document = { swagger: '2.0', definitions: {} };
      const expected = { message: 'spec at file:///swagger.json is Swagger 2.0; only OpenAPI 3 is supported', fix: SWAGGER_FIX };

      expect((): void => refuseSwagger(document, 'spec at file:///swagger.json')).toThrow(expect.objectContaining(expected));
    });
  });

  describe.each([null, 42, { openapi: '3.1.0' }, { swagger: 2 }])('GIVEN the value %j', (value: unknown): void => {
    it('WHEN checked THEN passes', (): void => {
      expect((): void => refuseSwagger(value, 'spec')).not.toThrow();
    });
  });
});
