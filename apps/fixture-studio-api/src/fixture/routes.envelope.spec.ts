import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MOCK_AI } from '../ai/data-access/ai-mock.client.ts';
import type { DiffBody, DiffResult, MergeBody, MergeResult } from '../contract/common/studio-api.type.ts';
import { loadStudioSpec, studioServer } from '../test/utils/studio-spec.spec.util.ts';

const ENDPOINT_ID = 'GET /v1/invoices/{id}';
const PAGE = { page: 1 };
const UNPLACED_FIXTURE = { meta: PAGE, total: 3 };
const AI_FILL = { id: 'in_7', amount_due: 7, status: 'open' };
const DIFF_WARNING =
  'The fixture has no "data" property and nothing in it looks like the payload, so nothing was compared or filled in.';
const MERGE_ERROR = 'The fixture has no "data" property and nothing in it looks like the payload, so nothing was merged.';

describe('FEATURE: fixture routes over a fixture without its envelope', (): void => {
  let fastify: FastifyInstance;
  let specId: string;

  beforeEach(async (): Promise<void> => {
    fastify = await studioServer(MOCK_AI);
    specId = await loadStudioSpec(fastify);
  });

  afterEach(async (): Promise<void> => {
    await fastify.close();
  });

  describe('GIVEN an envelope key the fixture lacks and nothing in it that looks like the payload', (): void => {
    it('WHEN diffed THEN answers 200 with nothing to fill, the fixture unchanged and a warning', async (): Promise<void> => {
      const body: DiffBody = { endpointId: ENDPOINT_ID, fixture: UNPLACED_FIXTURE, requiredOnly: false, objectShape: 'data' };

      const response = await fastify.inject({ method: 'POST', url: `/api/specs/${specId}/diff`, payload: body });

      const result = response.json<DiffResult>();

      expect(response.statusCode).toBe(200);
      expect(result).toMatchObject({ missingPaths: [], broken: [], warnings: [DIFF_WARNING] });
      expect(JSON.parse(result.completeJson)).toStrictEqual(UNPLACED_FIXTURE);
    });

    it('WHEN an AI fill is merged THEN answers 200 with the fixture unmerged, not valid, and a plain-language error', async (): Promise<void> => {
      const body: MergeBody = { endpointId: ENDPOINT_ID, fixture: UNPLACED_FIXTURE, populated: AI_FILL, objectShape: 'data' };

      const response = await fastify.inject({ method: 'POST', url: `/api/specs/${specId}/merge`, payload: body });

      const result = response.json<MergeResult>();

      expect(response.statusCode).toBe(200);
      expect(result).toMatchObject({ filled: [], valid: false, errors: [MERGE_ERROR] });
      expect(JSON.parse(result.mergedJson)).toStrictEqual(UNPLACED_FIXTURE);
    });
  });
});
