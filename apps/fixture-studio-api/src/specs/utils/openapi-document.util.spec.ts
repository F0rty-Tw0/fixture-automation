import { describe, expect, it } from 'vitest';

import { openApiDocument } from './openapi-document.util.ts';

const NOT_OPENAPI = 'the uploaded document is not an OpenAPI spec';
const NOT_OPENAPI_FIX = 'upload the JSON document with openapi and paths or components';
const COMPONENTS = { schemas: {} };

describe('FEATURE: uploaded OpenAPI document', (): void => {
  describe('GIVEN an openapi version string', (): void => {
    it.each([
      ['paths', { openapi: '3.1.0', paths: {} }],
      ['components', { openapi: '3.0.0', components: COMPONENTS }]
    ])('WHEN it carries %s THEN returns the document unchanged', (_label: string, upload: Record<string, unknown>): void => {
      const spec = openApiDocument(upload);

      expect(spec).toBe(upload);
    });

    it('WHEN it has neither paths nor components THEN fails with a fix', (): void => {
      const upload = { openapi: '3.0.0', info: {} };

      expect((): unknown => openApiDocument(upload)).toThrow(expect.objectContaining({ message: NOT_OPENAPI, fix: NOT_OPENAPI_FIX }));
    });
  });

  describe('GIVEN a Swagger 2.0 document', (): void => {
    it('WHEN uploaded THEN names the Swagger version instead of the missing openapi field', (): void => {
      const upload = { swagger: '2.0', paths: {} };

      expect((): unknown => openApiDocument(upload)).toThrow('the uploaded document is Swagger 2.0; only OpenAPI 3 is supported');
    });
  });

  describe('GIVEN no openapi version string', (): void => {
    it.each([
      ['missing', { paths: {} }],
      ['a number', { openapi: 3, paths: {} }]
    ])('WHEN it is %s THEN fails', (_label: string, upload: Record<string, unknown>): void => {
      expect((): unknown => openApiDocument(upload)).toThrow(NOT_OPENAPI);
    });
  });
});
