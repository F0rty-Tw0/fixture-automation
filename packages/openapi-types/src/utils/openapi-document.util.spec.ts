import { describe, expect, it } from 'vitest';

import { isOpenApiDocument } from './openapi-document.util.ts';

describe('FEATURE: OpenAPI document detection', (): void => {
  describe('GIVEN an object with a string openapi field and an object info field', (): void => {
    it('WHEN checked THEN accepts it', (): void => {
      const info = { title: 't', version: '0' };
      const document = { openapi: '3.1.0', info };

      expect(isOpenApiDocument(document)).toBe(true);
    });
  });

  describe.each([null, 42, 'openapi', []])('GIVEN the non-object value %s', (value): void => {
    it('WHEN checked THEN rejects it', (): void => {
      expect(isOpenApiDocument(value)).toBe(false);
    });
  });

  describe('GIVEN an object missing the openapi field', (): void => {
    it('WHEN checked THEN rejects it', (): void => {
      const info = { title: 't', version: '0' };
      const document = { info };

      expect(isOpenApiDocument(document)).toBe(false);
    });
  });

  describe('GIVEN an object whose info field is null', (): void => {
    it('WHEN checked THEN rejects it', (): void => {
      const document = { openapi: '3.1.0', info: null };

      expect(isOpenApiDocument(document)).toBe(false);
    });
  });
});
