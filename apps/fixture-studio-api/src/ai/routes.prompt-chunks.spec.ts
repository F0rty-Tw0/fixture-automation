import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MOCK_AI } from './data-access/ai-mock.client.ts';
import { aiPrompt } from './utils/ai-prompt.util.ts';
import type { AiPromptResult, ApiErrorBody, DiffResult, MissingFile } from '../contract/common/studio-api.type.ts';
import { loadStudioSpec, studioServer } from '../test/utils/studio-spec.spec.util.ts';

const ENDPOINT_ID = 'GET /v1/invoices/{id}';
const CUSTOMER = { id: 'cus_9' };
const SPARSE_INVOICE = { id: 'in_9', customer: CUSTOMER };
/** The diff spawns a spec worker (1-3 s under load); the 10 s hook default is too tight beside the full suite. */
const DIFF_HOOK_TIMEOUT_MS = 30_000;

describe('FEATURE: AI prompt chunks', (): void => {
  describe('GIVEN a sparse invoice diffed on the studio spec', (): void => {
    let fastify: FastifyInstance;
    let specId: string;
    let missing: MissingFile;

    const promptFor = async (paths: unknown): Promise<LightMyRequestResponse> => {
      const payload = { endpointId: ENDPOINT_ID, fixture: SPARSE_INVOICE, missing, paths };

      return fastify.inject({ method: 'POST', url: `/api/specs/${specId}/ai-prompt`, payload });
    };

    beforeAll(async (): Promise<void> => {
      fastify = await studioServer(MOCK_AI);
      specId = await loadStudioSpec(fastify);

      const diffBody = { endpointId: ENDPOINT_ID, fixture: SPARSE_INVOICE, requiredOnly: false };
      const diff = await fastify.inject({ method: 'POST', url: `/api/specs/${specId}/diff`, payload: diffBody });

      missing = diff.json<DiffResult>().missing;
    }, DIFF_HOOK_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      await fastify.close();
    });

    it('WHEN diffed THEN several paths are missing', (): void => {
      expect(missing.paths).toStrictEqual(['amount_due', 'status', 'memo', 'customer.address']);
    });

    describe('WHEN a chunk of one nested path is asked', (): void => {
      it('THEN answers 200 with a response schema requiring only that path', async (): Promise<void> => {
        const response = await promptFor(['customer.address']);

        expect(response.statusCode).toBe(200);
        expect(response.json<AiPromptResult>().responseSchema).toMatchObject({ required: ['customer'] });
      });

      it('THEN the prompt is smaller than the full one', async (): Promise<void> => {
        const full = aiPrompt(SPARSE_INVOICE, missing, undefined);

        const response = await promptFor(['customer.address']);

        expect(response.json<AiPromptResult>().prompt.length).toBeLessThan(full.prompt.length);
      });
    });

    it('WHEN a path outside the missing file is asked THEN answers 400 naming it', async (): Promise<void> => {
      const response = await promptFor(['customer.name']);

      expect(response.statusCode).toBe(400);
      expect(response.json<ApiErrorBody>().message).toBe('"customer.name" is not a missing path');
    });

    it('WHEN an empty path list is sent THEN answers 400', async (): Promise<void> => {
      const response = await promptFor([]);

      expect(response.statusCode).toBe(400);
    });

    it('WHEN paths are omitted THEN answers the full prompt unchanged', async (): Promise<void> => {
      const full = aiPrompt(SPARSE_INVOICE, missing, undefined);

      const response = await promptFor(undefined);

      expect(response.statusCode).toBe(200);
      expect(response.json<AiPromptResult>()).toStrictEqual(full);
    });
  });
});
