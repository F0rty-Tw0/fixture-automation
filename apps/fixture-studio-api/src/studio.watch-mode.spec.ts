import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { DiffResult, GenerateResult, LoadedSpec, MergeResult } from './contract/common/studio-api.type.ts';
import { MOCK_AI } from './data-access/ai-mock.client.ts';
import { stripeInvoiceDocument, studioServer } from './test/utils/studio-spec.spec.util.ts';

const WATCH_REPORT_VARIABLE = 'WATCH_REPORT_DEPENDENCIES';
const ENDPOINT_ID = 'GET /v1/invoices/{invoice}';
const PARTIAL_INVOICE = { id: 'in_1', object: 'invoice' };

describe('FEATURE: a realistic spec on the dev server', (): void => {
  describe('GIVEN the Stripe invoice spec loaded into a server started by node --watch-path', (): void => {
    let fastify: FastifyInstance;
    let specId: string;

    const post = async (route: string, payload: object): Promise<LightMyRequestResponse> => {
      return fastify.inject({ method: 'POST', url: `/api/specs/${specId}/${route}`, payload });
    };

    beforeAll(async (): Promise<void> => {
      vi.stubEnv(WATCH_REPORT_VARIABLE, '1');
      fastify = await studioServer(MOCK_AI);

      const document = await stripeInvoiceDocument();
      const upload = { document };
      const response = await fastify.inject({ method: 'POST', url: '/api/specs', payload: upload });

      specId = response.json<LoadedSpec>().specId;
    });

    afterAll(async (): Promise<void> => {
      await fastify.close();
      vi.unstubAllEnvs();
    });

    it('WHEN json, stub and types are generated THEN answers 200 with all three, not the watch reports', async (): Promise<void> => {
      const body = { endpointIds: [ENDPOINT_ID], formats: ['json', 'stub', 'types'], requiredOnly: false };

      const response = await post('generate', body);

      const { fixtures } = response.json<GenerateResult>();
      const sources = JSON.stringify(fixtures);

      expect(response.statusCode).toBe(200);
      expect(fixtures).toMatchObject([{ endpointId: ENDPOINT_ID, schemaName: 'invoice' }]);
      expect(sources).toContain('account_country');
      expect(sources).toContain('export const INVOICE_STUB');
      expect(sources).toContain('invoice: {');
    });

    it('WHEN a partial invoice is diffed THEN answers 200 with its missing required paths', async (): Promise<void> => {
      const body = { endpointId: ENDPOINT_ID, fixture: PARTIAL_INVOICE, requiredOnly: true };

      const response = await post('diff', body);

      expect(response.statusCode).toBe(200);
      expect(response.json<DiffResult>().missingPaths).toContain('customer');
    });

    it('WHEN the partial invoice is merged with nothing THEN answers 200 with the schema violations', async (): Promise<void> => {
      const body = { endpointId: ENDPOINT_ID, fixture: PARTIAL_INVOICE, populated: {} };

      const response = await post('merge', body);

      const result = response.json<MergeResult>();

      expect(response.statusCode).toBe(200);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
