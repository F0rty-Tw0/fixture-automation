import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { listEndpoints } from './endpoint-list.util.ts';
import type { Endpoint } from '../../contract/common/studio-api.type.ts';
import { studioSpec } from '../../test/utils/studio-spec.spec.util.ts';

const endpointById = (endpoints: Endpoint[], id: string): Endpoint | undefined => {
  return endpoints.find((endpoint: Endpoint): boolean => endpoint.id === id);
};

describe('FEATURE: endpoint list', (): void => {
  describe('GIVEN the sample spec', (): void => {
    let endpoints: Endpoint[];

    beforeAll(async (): Promise<void> => {
      const spec = await studioSpec();

      endpoints = listEndpoints(spec);
    });

    it('WHEN listed THEN orders by path, then by HTTP method order, skipping non-method keys', (): void => {
      const ids = endpoints.map((endpoint: Endpoint): string => endpoint.id);

      expect(ids).toStrictEqual([
        'GET /v1/inline',
        'GET /v1/invoices',
        'POST /v1/invoices',
        'GET /v1/invoices/{id}',
        'GET /v1/report'
      ]);
    });

    it('WHEN the response is a named $ref THEN carries the schema name, summary and tags', (): void => {
      const endpoint = endpointById(endpoints, 'GET /v1/invoices/{id}');

      expect(endpoint).toStrictEqual({
        id: 'GET /v1/invoices/{id}',
        method: 'GET',
        path: '/v1/invoices/{id}',
        summary: 'Retrieve an invoice',
        tags: ['Invoices'],
        schemaName: 'invoice',
        unsupportedReason: undefined
      });
    });

    it('WHEN the response is an array of a named $ref THEN carries the item schema name and default tags', (): void => {
      const endpoint = endpointById(endpoints, 'GET /v1/invoices');

      expect(endpoint).toMatchObject({ schemaName: 'invoice', summary: undefined, tags: [] });
    });

    it('WHEN the response schema is inline THEN is unsupported with the reason', (): void => {
      const endpoint = endpointById(endpoints, 'GET /v1/inline');

      expect(endpoint).toMatchObject({ schemaName: null, unsupportedReason: 'GET /v1/inline has no named response schema' });
    });

    it('WHEN the response is not JSON THEN is unsupported with the reason', (): void => {
      const endpoint = endpointById(endpoints, 'GET /v1/report');

      expect(endpoint).toMatchObject({ schemaName: null, unsupportedReason: 'GET /v1/report has no named response schema' });
    });
  });

  describe('GIVEN operations with unusual shapes', (): void => {
    const refOperation = (target: string): Record<string, unknown> => {
      const schema = { $ref: target };
      const json = { schema };
      const content = { 'application/json': json };
      const success = { content };
      const responses = { '200': success };
      const operation = { responses };

      return operation;
    };

    const specWith = (paths: Record<string, unknown>): OpenApiSpec => {
      const spec: OpenApiSpec = { openapi: '3.0.0', paths };

      return spec;
    };

    it('WHEN a $ref points outside components.schemas THEN is unsupported instead of failing the list', (): void => {
      const get = refOperation('#/components/responses/A');
      const route = { get };
      const spec = specWith({ '/a': route });

      const [endpoint] = listEndpoints(spec);

      expect(endpoint).toMatchObject({
        schemaName: null,
        unsupportedReason: 'unsupported local schema reference "#/components/responses/A"'
      });
    });

    it('WHEN tags hold non-strings and the path item is not an object THEN keeps string tags and skips the item', (): void => {
      const reference = refOperation('#/components/schemas/a');
      const get = { ...reference, tags: ['A', 1, null] };
      const route = { get };
      const spec = specWith({ '/a': route, '/b': 'nope' });

      const endpoints = listEndpoints(spec);

      const ids = endpoints.map((endpoint: Endpoint): string => endpoint.id);
      const [endpoint] = endpoints;

      expect(ids).toStrictEqual(['GET /a']);
      expect(endpoint).toMatchObject({ tags: ['A'], schemaName: 'a' });
    });

    it('WHEN the spec has no paths THEN lists nothing', (): void => {
      const spec: OpenApiSpec = { openapi: '3.0.0' };

      const endpoints = listEndpoints(spec);

      expect(endpoints).toStrictEqual([]);
    });
  });
});
