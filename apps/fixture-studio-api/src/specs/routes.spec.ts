import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MOCK_AI } from '../ai/data-access/ai-mock.client.ts';
import type { ApiErrorBody, Endpoint, GenerateBody, GenerateResult, LoadedSpec } from '../contract/common/studio-api.type.ts';
import { studioServer, studioSpec } from '../test/utils/studio-spec.spec.util.ts';

const GENERATE_BODY: GenerateBody = { endpointIds: ['GET /v1/invoices/{id}'], formats: ['json'], requiredOnly: false };

const PICK_FIX = 'pick an endpoint from the list the spec was loaded with';
const SPEC_NOT_FOUND: ApiErrorBody = {
  message: 'spec not found',
  fix: 'load the spec again; the API keeps only the last few in memory'
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const endpointId = (endpoint: Endpoint): string => endpoint.id;

describe('FEATURE: specs routes', (): void => {
  let spec: OpenApiSpec;
  let fastify: FastifyInstance;

  const postSpec = async (payload: object): Promise<LightMyRequestResponse> => {
    return fastify.inject({ method: 'POST', url: '/api/specs', payload });
  };

  const loadStudioSpec = async (): Promise<LoadedSpec> => {
    const upload = { document: spec };
    const response = await postSpec(upload);

    return response.json<LoadedSpec>();
  };

  const generate = async (specId: string, payload: object): Promise<LightMyRequestResponse> => {
    return fastify.inject({ method: 'POST', url: `/api/specs/${specId}/generate`, payload });
  };

  beforeAll(async (): Promise<void> => {
    spec = await studioSpec();
  });

  beforeEach(async (): Promise<void> => {
    fastify = await studioServer(MOCK_AI);
  });

  afterEach(async (): Promise<void> => {
    await fastify.close();
  });

  describe('SCENARIO: POST /api/specs', (): void => {
    describe('GIVEN an uploaded OpenAPI document', (): void => {
      it('WHEN posted THEN answers the spec id, info and endpoint list', async (): Promise<void> => {
        const upload = { document: spec };

        const response = await postSpec(upload);

        const loaded = response.json<LoadedSpec>();
        const ids = loaded.endpoints.map(endpointId);

        expect(response.statusCode).toBe(200);
        expect(loaded).toMatchObject({ title: 'Studio API', version: '2.1.0' });
        expect(loaded.specId).toMatch(UUID);
        expect(ids).toContain('GET /v1/invoices/{id}');
      });

      it('WHEN it is not OpenAPI THEN answers 400 with message and fix', async (): Promise<void> => {
        const document = { hello: 'world' };
        const upload = { document };

        const response = await postSpec(upload);

        expect(response.statusCode).toBe(400);
        expect(response.json()).toStrictEqual({
          message: 'the uploaded document is not an OpenAPI spec',
          fix: 'upload the JSON document with openapi and paths or components'
        });
      });
    });

    describe('GIVEN a spec URL', (): void => {
      it('WHEN it is a file:// URL THEN answers 400 without reading the file', async (): Promise<void> => {
        const upload = { url: 'file:///etc/passwd' };

        const response = await postSpec(upload);

        expect(response.statusCode).toBe(400);
        expect(response.json<ApiErrorBody>().message).toContain('body');
      });
    });

    describe('GIVEN five loaded specs', (): void => {
      it('WHEN a sixth is loaded THEN the first answers 404 because it was evicted', async (): Promise<void> => {
        const first = await loadStudioSpec();

        for (const upload of [2, 3, 4, 5, 6]) {
          const loaded = await loadStudioSpec();

          expect(loaded.specId, `upload ${upload}`).not.toBe(first.specId);
        }

        const response = await generate(first.specId, GENERATE_BODY);

        expect(response.statusCode).toBe(404);
        expect(response.json()).toStrictEqual(SPEC_NOT_FOUND);
      });
    });
  });

  describe('SCENARIO: POST /api/specs/:specId/generate', (): void => {
    describe('GIVEN a loaded spec', (): void => {
      it('WHEN a known endpoint is generated THEN answers the fixtures', async (): Promise<void> => {
        const { specId } = await loadStudioSpec();

        const response = await generate(specId, GENERATE_BODY);

        const [fixture] = response.json<GenerateResult>().fixtures;

        expect(response.statusCode).toBe(200);
        expect(fixture).toMatchObject({ endpointId: 'GET /v1/invoices/{id}', schemaName: 'invoice' });
        expect(fixture?.json).toContain('"in_123"');
      });

      it('WHEN the endpoint id is unknown THEN answers 400 with message and fix', async (): Promise<void> => {
        const { specId } = await loadStudioSpec();
        const body = { ...GENERATE_BODY, endpointIds: ['GET /v1/nope'] };

        const response = await generate(specId, body);

        expect(response.statusCode).toBe(400);
        expect(response.json()).toStrictEqual({ message: 'unknown endpoint: GET /v1/nope', fix: PICK_FIX });
      });

      it('WHEN the body has no formats THEN answers 400', async (): Promise<void> => {
        const { specId } = await loadStudioSpec();
        const body = { ...GENERATE_BODY, formats: [] };

        const response = await generate(specId, body);

        expect(response.statusCode).toBe(400);
      });
    });

    describe('GIVEN no loaded spec', (): void => {
      it('WHEN an unknown spec id is generated from THEN answers 404', async (): Promise<void> => {
        const response = await generate('missing', GENERATE_BODY);

        expect(response.statusCode).toBe(404);
        expect(response.json()).toStrictEqual(SPEC_NOT_FOUND);
      });
    });
  });
});
