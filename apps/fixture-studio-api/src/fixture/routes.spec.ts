import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MOCK_AI } from '../ai/data-access/ai-mock.client.ts';
import type {
  ApiErrorBody,
  BrokenValue,
  DiffBody,
  DiffResult,
  EnvelopeBody,
  EnvelopeResult,
  MergeBody,
  MergeResult
} from '../contract/common/studio-api.type.ts';
import { backtrackingDocument, fanOutDocument } from '../test/utils/hostile-spec.spec.util.ts';
import { loadDocumentSpec, loadStudioSpec, studioServer } from '../test/utils/studio-spec.spec.util.ts';
import { isInsertionOnly } from './test/utils/text-diff.spec.util.ts';

const ENDPOINT_ID = 'GET /v1/invoices/{id}';
const PARTIAL_INVOICE = { id: 'in_9', amount_due: 5 };
const PLACEHOLDER_INVOICE = { id: 'in_9', amount_due: 0, status: 'open', memo: 'string' };
const ADDRESS = { city: 'Berlin' };
const REAL_CUSTOMER = { id: 'cus_9', address: ADDRESS };
const REAL_ANSWER = { amount_due: 4200, memo: 'Net 30', customer: REAL_CUSTOMER };
const DIFF_BODY: DiffBody = { endpointId: ENDPOINT_ID, fixture: PARTIAL_INVOICE, requiredOnly: false };
const TOO_EXPENSIVE = 'spec too expensive to sample/validate';
const BACKTRACKING_NAME = `${'a'.repeat(34)}!`;
const PAGE = { page: 1 };
const ENVELOPED_INVOICE = { meta: PAGE, data: PARTIAL_INVOICE };
const LARGE_INVOICE = { ...PARTIAL_INVOICE, memo: 'm'.repeat(5 * 1024 * 1024) };
const AMOUNT_PLACEHOLDER: BrokenValue = { path: 'amount_due', value: 0, reason: 'openapi-sampler placeholder' };
const MEMO_PLACEHOLDER: BrokenValue = { path: 'memo', value: 'string', reason: 'openapi-sampler placeholder' };
const PLACEHOLDERS_BROKEN = [AMOUNT_PLACEHOLDER, MEMO_PLACEHOLDER];
const AMOUNT_BROKEN: BrokenValue = { path: 'data.amount_due', value: 'five', reason: 'must be integer' };

describe('FEATURE: fixture routes', (): void => {
  let fastify: FastifyInstance;
  let specId: string;

  const post = async (route: string, payload: object): Promise<LightMyRequestResponse> => {
    return fastify.inject({ method: 'POST', url: `/api/specs/${specId}/${route}`, payload });
  };

  beforeEach(async (): Promise<void> => {
    fastify = await studioServer(MOCK_AI);
    specId = await loadStudioSpec(fastify);
  });

  afterEach(async (): Promise<void> => {
    await fastify.close();
  });

  describe('SCENARIO: POST /api/specs/:specId/diff', (): void => {
    describe('GIVEN a fixture missing fields', (): void => {
      it('WHEN diffed THEN answers the missing file, its paths and the completed JSON', async (): Promise<void> => {
        const response = await post('diff', DIFF_BODY);

        const result = response.json<DiffResult>();

        expect(response.statusCode).toBe(200);
        expect(result.missingPaths).toStrictEqual(['status', 'memo', 'customer']);
        expect(result.missing).toMatchObject({ schemaName: 'invoice', dialect: 'openapi-30', paths: result.missingPaths });
        expect(isInsertionOnly(`${JSON.stringify(PARTIAL_INVOICE, null, 2)}\n`, result.completeJson)).toBe(true);
      });
    });

    describe('GIVEN a fixture holding sampler placeholders', (): void => {
      it('WHEN diffed THEN answers the replaced paths and the baseline without them', async (): Promise<void> => {
        const body: DiffBody = { ...DIFF_BODY, fixture: PLACEHOLDER_INVOICE };

        const response = await post('diff', body);

        const result = response.json<DiffResult>();

        expect(result.replacedPaths).toStrictEqual(['amount_due', 'memo']);
        expect(result.baseline).toStrictEqual({ id: 'in_9', status: 'open' });
      });

      it('WHEN the answer is merged onto the baseline THEN the fixture is valid and holds the answer', async (): Promise<void> => {
        const diffed = await post('diff', { ...DIFF_BODY, fixture: PLACEHOLDER_INVOICE });
        const { baseline } = diffed.json<DiffResult>();
        const body: MergeBody = { endpointId: ENDPOINT_ID, fixture: baseline, populated: REAL_ANSWER };

        const response = await post('merge', body);

        const result = response.json<MergeResult>();

        expect(result).toMatchObject({ valid: true, errors: [], filled: ['amount_due', 'memo', 'customer'] });
        expect(JSON.parse(result.mergedJson)).toStrictEqual({ ...PLACEHOLDER_INVOICE, ...REAL_ANSWER });
      });

      it('WHEN merged with the original fixture THEN each replaced key keeps its original place', async (): Promise<void> => {
        const diffed = await post('diff', { ...DIFF_BODY, fixture: PLACEHOLDER_INVOICE });
        const { baseline } = diffed.json<DiffResult>();
        const body: MergeBody = { endpointId: ENDPOINT_ID, fixture: baseline, populated: REAL_ANSWER, original: PLACEHOLDER_INVOICE };

        const response = await post('merge', body);

        const merged: unknown = JSON.parse(response.json<MergeResult>().mergedJson);

        expect(Object.keys(merged ?? {})).toStrictEqual(['id', 'amount_due', 'status', 'memo', 'customer']);
      });

      it('WHEN diffed with replacePlaceholders false THEN nothing is replaced', async (): Promise<void> => {
        const body: DiffBody = { ...DIFF_BODY, fixture: PLACEHOLDER_INVOICE, replacePlaceholders: false };

        const response = await post('diff', body);

        expect(response.json<DiffResult>()).toMatchObject({ replacedPaths: [], baseline: PLACEHOLDER_INVOICE });
      });

      it('WHEN diffed with replacePlaceholders false THEN the placeholders are still reported broken', async (): Promise<void> => {
        const body: DiffBody = { ...DIFF_BODY, fixture: PLACEHOLDER_INVOICE, replacePlaceholders: false };

        const response = await post('diff', body);

        expect(response.json<DiffResult>().broken).toStrictEqual(PLACEHOLDERS_BROKEN);
      });
    });

    describe('GIVEN a fixture over 4 MiB', (): void => {
      it('WHEN diffed THEN the body is accepted and answered', async (): Promise<void> => {
        const body: DiffBody = { ...DIFF_BODY, fixture: LARGE_INVOICE };

        const response = await post('diff', body);

        expect(response.statusCode).toBe(200);
        expect(response.json<DiffResult>().missingPaths).toStrictEqual(['status', 'customer']);
      });

      it('WHEN diffed THEN promptBytes counts the root string the trimmed prompt keeps', async (): Promise<void> => {
        const body: DiffBody = { ...DIFF_BODY, fixture: LARGE_INVOICE };

        const response = await post('diff', body);

        expect(response.json<DiffResult>().promptBytes).toBeGreaterThan(LARGE_INVOICE.memo.length);
      });
    });

    describe('GIVEN an enveloped fixture holding a schema-invalid value', (): void => {
      it('WHEN diffed THEN the broken value is reported under the envelope with the AJV message', async (): Promise<void> => {
        const payload = { ...PARTIAL_INVOICE, amount_due: 'five' };
        const fixture = { data: payload };
        const body: DiffBody = { ...DIFF_BODY, fixture, objectShape: 'data' };

        const response = await post('diff', body);

        expect(response.json<DiffResult>().broken).toStrictEqual([AMOUNT_BROKEN]);
      });
    });

    describe('GIVEN an envelope key the fixture lacks', (): void => {
      it('WHEN diffed THEN answers 400 with the object-shape fix', async (): Promise<void> => {
        const body: DiffBody = { ...DIFF_BODY, objectShape: 'data' };

        const response = await post('diff', body);

        expect(response.statusCode).toBe(400);
        expect(response.json<ApiErrorBody>().message).toBe('fixture has no own property "data" for object-shape');
      });
    });

    describe('GIVEN an endpoint the spec cannot sample', (): void => {
      it('WHEN diffed THEN answers 400', async (): Promise<void> => {
        const body: DiffBody = { ...DIFF_BODY, endpointId: 'GET /v1/inline' };

        const response = await post('diff', body);

        expect(response.statusCode).toBe(400);
      });
    });

    describe('GIVEN a body without requiredOnly', (): void => {
      it('WHEN diffed THEN answers 400', async (): Promise<void> => {
        const body = { endpointId: ENDPOINT_ID, fixture: PARTIAL_INVOICE };

        const response = await post('diff', body);

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('SCENARIO: POST /api/specs/:specId/envelope', (): void => {
    describe('GIVEN a fixture whose payload sits under an envelope key', (): void => {
      it('WHEN detected THEN answers that key as candidate and detected', async (): Promise<void> => {
        const body: EnvelopeBody = { endpointId: ENDPOINT_ID, fixture: ENVELOPED_INVOICE };

        const response = await post('envelope', body);

        expect(response.statusCode).toBe(200);
        expect(response.json<EnvelopeResult>()).toStrictEqual({ candidates: ['data', 'meta'], detected: 'data' });
      });
    });

    describe('GIVEN a fixture whose payload is the root', (): void => {
      it('WHEN detected THEN answers no detected key', async (): Promise<void> => {
        const body: EnvelopeBody = { endpointId: ENDPOINT_ID, fixture: REAL_ANSWER };

        const response = await post('envelope', body);

        expect(response.json<EnvelopeResult>()).toStrictEqual({ candidates: ['customer'] });
      });
    });

    describe('GIVEN an unknown endpoint', (): void => {
      it('WHEN detected THEN answers 400', async (): Promise<void> => {
        const body: EnvelopeBody = { endpointId: 'GET /nope', fixture: ENVELOPED_INVOICE };

        const response = await post('envelope', body);

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('SCENARIO: POST /api/specs/:specId/merge', (): void => {
    describe('GIVEN populated values that satisfy the schema', (): void => {
      it('WHEN merged THEN answers valid with the filled paths', async (): Promise<void> => {
        const populated = { status: 'open' };
        const body: MergeBody = { endpointId: ENDPOINT_ID, fixture: PARTIAL_INVOICE, populated };

        const response = await post('merge', body);

        expect(response.statusCode).toBe(200);
        expect(response.json<MergeResult>()).toMatchObject({ valid: true, errors: [], filled: ['status'] });
      });
    });

    describe('GIVEN populated values that violate the schema', (): void => {
      it('WHEN merged THEN answers 200 with valid false and the violations', async (): Promise<void> => {
        const populated = { status: 'closed' };
        const body: MergeBody = { endpointId: ENDPOINT_ID, fixture: PARTIAL_INVOICE, populated };

        const response = await post('merge', body);

        expect(response.statusCode).toBe(200);
        expect(response.json<MergeResult>()).toMatchObject({
          valid: false,
          errors: ['/status: must be equal to one of the allowed values']
        });
      });
    });

    describe('GIVEN an unknown spec id', (): void => {
      it('WHEN merged THEN answers 404', async (): Promise<void> => {
        specId = 'missing';
        const body: MergeBody = { endpointId: ENDPOINT_ID, fixture: PARTIAL_INVOICE, populated: {} };

        const response = await post('merge', body);

        expect(response.statusCode).toBe(404);
        expect(response.json<ApiErrorBody>().message).toBe('spec not found');
      });
    });
  });

  describe('SCENARIO: specs too expensive to compute', (): void => {
    beforeEach(async (): Promise<void> => {
      await fastify.close();
      fastify = await studioServer(MOCK_AI, 3_000);
    });

    describe('GIVEN a spec whose schema graph fans out', (): void => {
      it('WHEN diffed THEN answers 422 with a fix, and the server keeps answering', async (): Promise<void> => {
        specId = await loadDocumentSpec(fastify, fanOutDocument(8, 10));
        const body: DiffBody = { endpointId: 'GET /fan', fixture: {}, requiredOnly: false };

        const response = await post('diff', body);

        const health = await fastify.inject({ method: 'GET', url: '/api/ai/cli/models' });

        expect(response.statusCode).toBe(422);
        expect(response.json<ApiErrorBody>()).toMatchObject({ message: TOO_EXPENSIVE });
        expect(response.json<ApiErrorBody>().fix).toContain('STUDIO_COMPUTE_TIMEOUT_MS');
        expect(health.statusCode).toBe(400);
      });
    });

    describe('GIVEN a schema pattern that backtracks catastrophically', (): void => {
      it('WHEN merged THEN answers 422', async (): Promise<void> => {
        specId = await loadDocumentSpec(fastify, backtrackingDocument());
        const populated = { name: BACKTRACKING_NAME };
        const body: MergeBody = { endpointId: 'GET /named', fixture: {}, populated };

        const response = await post('merge', body);

        expect(response.statusCode).toBe(422);
        expect(response.json<ApiErrorBody>().message).toBe(TOO_EXPENSIVE);
      });
    });
  });
});
