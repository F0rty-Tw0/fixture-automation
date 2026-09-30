import type { AiMissingFactory } from '@fixture-automation/openapi-ai-fixtures';
import { isRecord } from '@fixture-automation/shared';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StudioAi } from './common/ai.type.ts';
import { MOCK_AI } from './data-access/ai-mock.client.ts';
import type { AiFillBody, DiffBody, MergeResult, MissingFile } from '../contract/common/studio-api.type.ts';
import { studioAiMock } from '../test/mocks/studio-ai.mock.ts';
import { ndjsonLines } from './test/utils/ndjson.spec.util.ts';
import { diffedMissing, loadStudioSpec, studioServer } from '../test/utils/studio-spec.spec.util.ts';

const ENDPOINT_ID = 'GET /v1/invoices/{id}';
const CUSTOMER = { id: 'cus_9' };
const NESTED_INVOICE = { id: 'in_9', amount_due: 5, status: 'open', memo: 'm', customer: CUSTOMER };
const DIFF_BODY: DiffBody = { endpointId: ENDPOINT_ID, fixture: NESTED_INVOICE, requiredOnly: false };
const HUGE_INVOICE = { ...NESTED_INVOICE, memo: 'm'.repeat(1100 * 1024) };
const OVERSIZE_NOTE = 'its prompt alone exceeds the 1 MiB CLI input limit; 1 value filled from the schema.';
const FAILED_NOTE = 'codex failed: codex exited 1; 1 value filled from the schema.';
const SAMPLED_SOURCES = { 'customer.address': 'sampler' };
const REJECTED_NOTE = "codex's answer did not match the schema; 1 value filled from the schema.";
const LIST_ENDPOINT_ID = 'GET /v1/invoices';
const LIST_FIXTURE = [
  { id: 'in_a', amount_due: 1 },
  { id: 'in_b', amount_due: 2, status: 'open' }
];
const LIST_DIFF_BODY: DiffBody = { endpointId: LIST_ENDPOINT_ID, fixture: LIST_FIXTURE, requiredOnly: true };
const LIST_SOURCES = { '[0].status': 'sampler' };

describe('FEATURE: AI fill route salvage', (): void => {
  let fastify: FastifyInstance;
  let specId: string;
  let missing: MissingFile;

  const start = async (ai: StudioAi = MOCK_AI): Promise<void> => {
    fastify = await studioServer(ai);
    specId = await loadStudioSpec(fastify);
    missing = await diffedMissing(fastify, specId, DIFF_BODY);
  };

  const post = async (route: string, payload: object): Promise<LightMyRequestResponse> => {
    return fastify.inject({ method: 'POST', url: `/api/specs/${specId}/${route}`, payload });
  };

  const fillBody = (): AiFillBody => {
    const body: AiFillBody = { endpointId: ENDPOINT_ID, fixture: NESTED_INVOICE, missing, tool: 'codex' };

    return body;
  };

  afterEach(async (): Promise<void> => {
    await fastify.close();
  });

  describe('GIVEN the mock AI and a scenario asking it for a bad answer', (): void => {
    it('WHEN filled THEN the result is salvaged from the schema, says so, and merges valid', async (): Promise<void> => {
      await start();
      const base = fillBody();
      const body: AiFillBody = { ...base, scenario: 'overdue [mock:salvage]' };

      const response = await post('ai-fill', body);

      const result = ndjsonLines(response.body).at(-1);
      const populated = isRecord(result) ? result['populated'] : undefined;
      const merged = await post('merge', { endpointId: ENDPOINT_ID, fixture: NESTED_INVOICE, populated });

      expect(result).toMatchObject({ type: 'result', sources: SAMPLED_SOURCES, notes: [REJECTED_NOTE] });
      expect(merged.json<MergeResult>()).toMatchObject({ valid: true, filled: ['customer.address'] });
    });
  });

  describe('GIVEN a list fixture from a list endpoint whose missing paths start at an index', (): void => {
    const listFill = async (): Promise<unknown> => {
      const listMissing = await diffedMissing(fastify, specId, LIST_DIFF_BODY);
      const body: AiFillBody = { endpointId: LIST_ENDPOINT_ID, fixture: LIST_FIXTURE, missing: listMissing, tool: 'codex' };
      const response = await post('ai-fill', body);

      return ndjsonLines(response.body).at(-1);
    };

    const mergedList = async (populated: unknown): Promise<MergeResult> => {
      const merged = await post('merge', { endpointId: LIST_ENDPOINT_ID, fixture: LIST_FIXTURE, populated });

      return merged.json<MergeResult>();
    };

    it('WHEN the mock AI fills it THEN the result is a list that merges valid into the fixture', async (): Promise<void> => {
      await start();

      const result = await listFill();

      const populated = isRecord(result) ? result['populated'] : undefined;
      const merged = await mergedList(populated);

      expect(populated).toStrictEqual([{ status: 'draft' }]);
      expect(merged).toMatchObject({ valid: true, filled: ['[0].status'] });
    });

    it('WHEN the CLI run fails THEN the salvaged list merges valid into the fixture', async (): Promise<void> => {
      const ai = studioAiMock();
      const failing: AiMissingFactory = async (): Promise<Record<string, unknown>> => Promise.reject(new Error('codex exited 1'));

      vi.mocked(ai.fill).mockReturnValue(failing);
      await start(ai);

      const result = await listFill();

      const populated = isRecord(result) ? result['populated'] : undefined;
      const merged = await mergedList(populated);

      expect(result).toMatchObject({ type: 'result', sources: LIST_SOURCES });
      expect(merged).toMatchObject({ valid: true, filled: ['[0].status'] });
    });
  });

  describe('GIVEN one missing field whose prompt alone exceeds 1 MiB', (): void => {
    it('WHEN filled THEN no CLI starts and the field is filled from the schema, with a note why', async (): Promise<void> => {
      const ai = studioAiMock();
      const enrich = vi.fn<AiMissingFactory>();

      vi.mocked(ai.fill).mockReturnValue(enrich);
      await start(ai);
      const base = fillBody();
      const body: AiFillBody = { ...base, fixture: HUGE_INVOICE };

      const response = await post('ai-fill', body);

      const result = ndjsonLines(response.body).at(-1);

      expect(result).toMatchObject({ type: 'result', sources: SAMPLED_SOURCES, notes: [OVERSIZE_NOTE] });
      expect(enrich).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a fill that fails', (): void => {
    it('WHEN filled THEN the stream ends with a salvaged result that merges valid', async (): Promise<void> => {
      const ai = studioAiMock();
      const failing: AiMissingFactory = async (): Promise<Record<string, unknown>> => Promise.reject(new Error('codex exited 1'));

      vi.mocked(ai.fill).mockReturnValue(failing);
      await start(ai);

      const response = await post('ai-fill', fillBody());

      const result = ndjsonLines(response.body).at(-1);
      const populated = isRecord(result) ? result['populated'] : undefined;
      const merged = await post('merge', { endpointId: ENDPOINT_ID, fixture: NESTED_INVOICE, populated });

      expect(response.statusCode).toBe(200);
      expect(result).toMatchObject({ type: 'result', sources: SAMPLED_SOURCES, notes: [FAILED_NOTE] });
      expect(merged.json<MergeResult>()).toMatchObject({ valid: true, filled: ['customer.address'] });
    });
  });
});
