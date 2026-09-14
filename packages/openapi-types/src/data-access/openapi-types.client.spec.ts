import { describe, expect, it } from 'vitest';

import { generateTypes } from '@fixture-automation/openapi-types';

import { specUrl } from '../test/utils/spec-url.spec.util.ts';

describe('FEATURE: OpenAPI type generation', (): void => {
  describe('GIVEN an invoice endpoint and schema in a JSON spec file', (): void => {
    it('WHEN generating declarations THEN includes the endpoint and schema types', async (): Promise<void> => {
      const types = await generateTypes(specUrl());

      expect(types).toContain('"/v1/invoices/{invoice}"');
      expect(types).toContain('invoice: {');
      expect(types).toContain('amount_due: number');
    });
  });

  describe('GIVEN an in-memory OpenAPI document rather than a URL', (): void => {
    it('WHEN generating declarations THEN includes the component schema types', async (): Promise<void> => {
      const id = { type: 'string' };
      const properties = { id };
      const thing = { type: 'object', required: ['id'], properties };
      const schemas = { thing };
      const components = { schemas };
      const info = { title: 't', version: '0' };
      const document = { openapi: '3.1.0', info, components };

      const types = await generateTypes(document);

      expect(types).toContain('export interface components');
      expect(types).toContain('thing:');
    });
  });

  describe('GIVEN a bare filesystem path instead of a spec URL', (): void => {
    it('WHEN generating declarations THEN it rejects the path as an invalid URL', async (): Promise<void> => {
      await expect(generateTypes('invoice.json')).rejects.toThrow(TypeError);
    });
  });

  describe('GIVEN an object without the OpenAPI version and info fields', (): void => {
    it('WHEN generating declarations THEN it rejects the document', async (): Promise<void> => {
      const schemas = {};
      const components = { schemas };
      const document = { components };

      await expect(generateTypes(document)).rejects.toThrow(/openapi and info/);
    });
  });
});
