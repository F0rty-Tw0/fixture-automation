import { readFile } from 'node:fs/promises';

import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { resolveTarget } from './route-schema.util.ts';

const SPEC_URL = new URL('../test/fixtures/invoice/spec.json', import.meta.url);

describe('FEATURE: wizard target resolution', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = JSON.parse(await readFile(SPEC_URL, 'utf8')) as OpenApiSpec;
  });

  describe('GIVEN a schema name', (): void => {
    it('WHEN it is declared THEN returns it', (): void => {
      expect(resolveTarget(spec, 'invoice')).toBe('invoice');
    });

    it('WHEN it is unknown THEN fails with a suggestion', (): void => {
      expect((): string => resolveTarget(spec, 'invoic')).toThrow(
        expect.objectContaining({ message: 'schema not found: invoic', fix: 'did you mean invoice?' })
      );
    });
  });

  describe('GIVEN a route', (): void => {
    it('WHEN its JSON response references a schema THEN returns the schema name', (): void => {
      expect(resolveTarget(spec, 'GET /v1/invoices/{id}')).toBe('invoice');
    });

    it('WHEN it lists items referencing a schema THEN returns the schema name', (): void => {
      expect(resolveTarget(spec, 'get /v1/invoices')).toBe('invoice');
    });

    it('WHEN its response schema is inline THEN asks for the schema name instead', (): void => {
      expect((): string => resolveTarget(spec, 'GET /v1/inline')).toThrow(
        expect.objectContaining({
          message: 'GET /v1/inline has no named response schema',
          fix: 'answer the schema name instead, e.g. invoice'
        })
      );
    });

    it('WHEN the route is unknown THEN names it', (): void => {
      expect((): string => resolveTarget(spec, 'POST /v1/invoices')).toThrow('route not found in the spec: POST /v1/invoices');
    });
  });
});
