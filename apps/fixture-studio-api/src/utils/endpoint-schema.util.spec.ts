import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { endpointSchemaName } from './endpoint-schema.util.ts';
import { studioSpec } from '../test/utils/studio-spec.spec.util.ts';

const PICK_FIX = 'pick an endpoint from the list the spec was loaded with';

describe('FEATURE: endpoint schema name', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = await studioSpec();
  });

  describe('GIVEN the sample spec', (): void => {
    it.each(['GET /v1/invoices/{id}', 'GET /v1/invoices', 'POST /v1/invoices'])(
      'WHEN %s is looked up THEN resolves to invoice',
      (endpointId: string): void => {
        const schemaName = endpointSchemaName(spec, endpointId);

        expect(schemaName).toBe('invoice');
      }
    );

    it('WHEN the id is unknown THEN fails naming it', (): void => {
      expect((): string => endpointSchemaName(spec, 'GET /v1/nope')).toThrow(
        expect.objectContaining({ message: 'unknown endpoint: GET /v1/nope', fix: PICK_FIX })
      );
    });

    it('WHEN the endpoint is unsupported THEN fails with its reason', (): void => {
      expect((): string => endpointSchemaName(spec, 'GET /v1/inline')).toThrow(
        'GET /v1/inline cannot be generated: GET /v1/inline has no named response schema'
      );
    });
  });
});
