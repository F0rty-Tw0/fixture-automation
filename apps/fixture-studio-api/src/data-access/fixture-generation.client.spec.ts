import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { generateFixtures } from './fixture-generation.client.ts';
import type { GenerateBody, GeneratedFixture } from '../contract/common/studio-api.type.ts';
import { studioSpec } from '../test/utils/studio-spec.spec.util.ts';

const ADDRESS = { city: 'Oslo' };
const CUSTOMER = { id: 'cus_1', address: ADDRESS };
const INVOICE = { id: 'in_123', amount_due: 0, status: 'draft', memo: 'string', customer: CUSTOMER };
const REQUIRED_INVOICE = { id: 'in_123', amount_due: 0, status: 'draft' };

const request = (endpointIds: string[], formats: GenerateBody['formats'], requiredOnly = false): GenerateBody => {
  const body: GenerateBody = { endpointIds, formats, requiredOnly };

  return body;
};

describe('FEATURE: fixture generation', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = await studioSpec();
  });

  describe('GIVEN an endpoint with a named response schema', (): void => {
    it('WHEN json is requested THEN returns the pretty-printed sample with a trailing newline and nothing else', async (): Promise<void> => {
      const json = `${JSON.stringify(INVOICE, null, 2)}\n`;
      const fixture: GeneratedFixture = {
        endpointId: 'GET /v1/invoices/{id}',
        schemaName: 'invoice',
        json,
        stub: undefined,
        types: undefined
      };

      const result = await generateFixtures(spec, request(['GET /v1/invoices/{id}'], ['json']));

      expect(result.fixtures).toStrictEqual([fixture]);
    });

    it('WHEN json is requested with requiredOnly THEN drops the optional fields', async (): Promise<void> => {
      const result = await generateFixtures(spec, request(['GET /v1/invoices/{id}'], ['json'], true));

      expect(result.fixtures[0]?.json).toBe(`${JSON.stringify(REQUIRED_INVOICE, null, 2)}\n`);
    });

    it('WHEN stub is requested THEN returns a typed stub importing the sibling .d.ts', async (): Promise<void> => {
      const result = await generateFixtures(spec, request(['GET /v1/invoices/{id}'], ['stub']));

      const stub = result.fixtures[0]?.stub;

      expect(stub).toContain('import type { components } from "./invoice.d.ts";');
      expect(stub).toContain('export const INVOICE_STUB: components["schemas"]["invoice"] = {');
      expect(result.fixtures[0]?.json).toBeUndefined();
    });

    it('WHEN types are requested THEN returns the declarations of the pruned spec', async (): Promise<void> => {
      const result = await generateFixtures(spec, request(['GET /v1/invoices/{id}'], ['types']));

      const types = result.fixtures[0]?.types;

      expect(types).toContain('invoice: {');
      expect(types).toContain('amount_due: number;');
      expect(result.fixtures[0]?.stub).toBeUndefined();
    });
  });

  describe('GIVEN two endpoints sharing one schema', (): void => {
    it('WHEN both are requested THEN each gets the same sources under its own id', async (): Promise<void> => {
      const result = await generateFixtures(spec, request(['GET /v1/invoices', 'POST /v1/invoices'], ['json', 'stub']));

      const [first, second] = result.fixtures;
      const expectedSecond = { ...first, endpointId: 'POST /v1/invoices' };

      expect(first?.endpointId).toBe('GET /v1/invoices');
      expect(second).toStrictEqual(expectedSecond);
    });
  });

  describe('GIVEN an endpoint that cannot be generated', (): void => {
    it('WHEN its id is unknown THEN fails naming it', async (): Promise<void> => {
      const generation = generateFixtures(spec, request(['GET /v1/nope'], ['json']));

      await expect(generation).rejects.toThrow(
        expect.objectContaining({
          message: 'unknown endpoint: GET /v1/nope',
          fix: 'pick an endpoint from the list the spec was loaded with'
        })
      );
    });

    it('WHEN it has no named schema THEN fails with the unsupported reason', async (): Promise<void> => {
      const generation = generateFixtures(spec, request(['GET /v1/inline'], ['json']));

      await expect(generation).rejects.toThrow('GET /v1/inline cannot be generated: GET /v1/inline has no named response schema');
    });
  });
});
