import { loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { resolveTarget } from './route-schema.util.ts';

const SPEC_URL = new URL('../test/fixtures/invoice/spec.json', import.meta.url);

describe('FEATURE: wizard target resolution', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = await loadSpec(SPEC_URL);
  });

  describe('GIVEN no method and a schema name', (): void => {
    it('WHEN it is declared THEN returns it', (): void => {
      expect(resolveTarget(spec, undefined, 'invoice')).toBe('invoice');
    });

    it('WHEN it is unknown THEN fails with a suggestion', (): void => {
      expect((): string => resolveTarget(spec, undefined, 'invoic')).toThrow(
        expect.objectContaining({ message: 'schema not found: invoic', fix: 'did you mean invoice?' })
      );
    });
  });

  describe('GIVEN a method and a route path', (): void => {
    it.each(['/v1/invoices/{id}', 'v1/invoices/{id}'])('WHEN the path is %s THEN returns the referenced schema name', (path): void => {
      expect(resolveTarget(spec, 'GET', path)).toBe('invoice');
    });

    it('WHEN it lists items referencing a schema THEN returns the schema name', (): void => {
      expect(resolveTarget(spec, 'get', '/v1/invoices')).toBe('invoice');
    });

    it('WHEN its response schema is inline THEN asks for the schema name instead', (): void => {
      expect((): string => resolveTarget(spec, 'get', 'v1/inline')).toThrow(
        expect.objectContaining({
          message: 'GET /v1/inline has no named response schema',
          fix: 'answer the schema name instead, e.g. invoice'
        })
      );
    });

    it('WHEN the route is unknown THEN names it', (): void => {
      expect((): string => resolveTarget(spec, 'post', 'v1/invoices')).toThrow('route not found in the spec: POST /v1/invoices');
    });
  });
});
