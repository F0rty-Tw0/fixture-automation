import { request as httpRequest } from 'node:http';
import type { IncomingMessage } from 'node:http';

import type { AiFixtureOptions, AiMissingFactory, ModelDiscovery } from '@fixture-automation/openapi-ai-fixtures';
import { isRecord } from '@fixture-automation/shared';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StudioAi } from './common/studio-server.type.ts';
import type { AiFillBody, ApiErrorBody, DiffBody, MergeResult, MissingFile } from './contract/common/studio-api.type.ts';
import { MOCK_AI } from './data-access/ai-mock.client.ts';
import { studioAiMock } from './test/mocks/studio-ai.mock.ts';
import { backtrackingDocument, backtrackingMissing } from './test/utils/hostile-spec.spec.util.ts';
import { ndjsonLines } from './test/utils/ndjson.spec.util.ts';
import { diffedMissing, loadDocumentSpec, loadStudioSpec, studioServer } from './test/utils/studio-spec.spec.util.ts';

const ENDPOINT_ID = 'GET /v1/invoices/{id}';
const DISCOVERY: ModelDiscovery = { models: ['gpt-x'], source: 'codex-cli' };
const CUSTOMER = { id: 'cus_9' };
const NESTED_INVOICE = { id: 'in_9', amount_due: 5, status: 'open', memo: 'm', customer: CUSTOMER };
const DIFF_BODY: DiffBody = { endpointId: ENDPOINT_ID, fixture: NESTED_INVOICE, requiredOnly: false };
const MODELS_URL = '/api/ai/cli/models?tool=codex';
const COMPUTE_TIMEOUT_MS = 1_000;
const TOO_EXPENSIVE = 'spec too expensive to sample/validate';
const BACKTRACKING_FILL = { name: `${'a'.repeat(34)}!` };
/** Every fill first compiles its projection in a spec worker, which takes 1-3 s to load from source. */
const WORKER_WAIT = { timeout: 15_000 };
const UNCOMPILABLE_NAME = { type: 'string', pattern: '(' };
const UNCOMPILABLE_PROPERTIES = { name: UNCOMPILABLE_NAME };
const UNCOMPILABLE_SCHEMA = { type: 'object', properties: UNCOMPILABLE_PROPERTIES };

const neverSettles = async (): Promise<Record<string, unknown>> => new Promise((): void => undefined);

describe('FEATURE: AI fill route', (): void => {
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

  describe('SCENARIO: POST ai-fill', (): void => {
    describe('GIVEN the mock AI', (): void => {
      it('WHEN filled THEN streams NDJSON progress, then a result that merges valid', async (): Promise<void> => {
        await start();

        const response = await post('ai-fill', fillBody());

        const events = ndjsonLines(response.body);
        const result = events.at(-1);
        const populated = isRecord(result) ? result['populated'] : undefined;
        const mergeBody = { endpointId: ENDPOINT_ID, fixture: NESTED_INVOICE, populated };
        const merged = await post('merge', mergeBody);

        expect(response.headers['content-type']).toContain('application/x-ndjson');
        expect(response.body.endsWith('\n')).toBe(true);
        expect(events.slice(0, -1)).toHaveLength(3);
        expect(result).toMatchObject({ type: 'result' });
        expect(merged.json<MergeResult>()).toMatchObject({ valid: true, filled: ['customer.address'] });
      });
    });

    describe('GIVEN a fill that fails', (): void => {
      it('WHEN filled THEN the stream ends with an error line', async (): Promise<void> => {
        const ai = studioAiMock();
        const failing: AiMissingFactory = async (): Promise<Record<string, unknown>> => Promise.reject(new Error('codex exited 1'));

        vi.mocked(ai.fill).mockReturnValue(failing);
        await start(ai);

        const response = await post('ai-fill', fillBody());

        expect(response.statusCode).toBe(200);
        expect(ndjsonLines(response.body)).toStrictEqual([{ type: 'error', message: 'codex exited 1' }]);
      });
    });

    describe('GIVEN a model and scenario', (): void => {
      it('WHEN filled THEN they reach the CLI options and request', async (): Promise<void> => {
        const ai = studioAiMock();
        const enrich = vi.fn<AiMissingFactory>(async (): Promise<Record<string, unknown>> => Promise.resolve({}));

        vi.mocked(ai.fill).mockReturnValue(enrich);
        await start(ai);
        const base = fillBody();
        const body: AiFillBody = { ...base, model: 'gpt-x', scenario: ' overdue ' };

        await post('ai-fill', body);

        const options = vi.mocked(ai.fill).mock.calls[0]?.[0];
        const request = enrich.mock.calls[0]?.[1];

        expect(options).toMatchObject({ tool: 'codex', model: 'gpt-x' });
        expect(request).toMatchObject({ scenario: 'overdue', fixture: NESTED_INVOICE });
      });
    });

    describe('GIVEN a model slug that starts with a dash', (): void => {
      it('WHEN filled THEN answers 400 and no CLI starts', async (): Promise<void> => {
        const ai = studioAiMock();

        await start(ai);
        const base = fillBody();
        const body = { ...base, model: '--dangerously-skip-permissions' };

        const response = await post('ai-fill', body);

        expect(response.statusCode).toBe(400);
        expect(ai.fill).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN CLI runs that finished every possible way', (): void => {
      it('WHEN two more fills hold slots THEN a third is refused, so each earlier run released exactly once', async (): Promise<void> => {
        const ai = studioAiMock();
        const finishers: (() => void)[] = [];
        const done: AiMissingFactory = async (): Promise<Record<string, unknown>> => Promise.resolve({});
        const failed: AiMissingFactory = async (): Promise<Record<string, unknown>> => Promise.reject(new Error('codex exited 1'));
        const held: AiMissingFactory = async (): Promise<Record<string, unknown>> => {
          const pending = new Promise<Record<string, unknown>>((resolve): void => {
            finishers.push((): void => resolve({}));
          });

          return pending;
        };

        vi.mocked(ai.fill).mockReturnValueOnce(done).mockReturnValueOnce(failed).mockReturnValue(held);
        vi.mocked(ai.discover).mockRejectedValueOnce(new Error('not logged in')).mockResolvedValue(DISCOVERY);
        await start(ai);
        const finishedWays = [
          await post('ai-fill', fillBody()),
          await post('ai-fill', fillBody()),
          await fastify.inject({ method: 'GET', url: MODELS_URL }),
          await fastify.inject({ method: 'GET', url: MODELS_URL })
        ];
        const statuses = finishedWays.map((response: LightMyRequestResponse): number => response.statusCode);
        const first = post('ai-fill', fillBody());
        const second = post('ai-fill', fillBody());

        await vi.waitFor((): void => {
          expect(finishers).toHaveLength(2);
        }, WORKER_WAIT);
        const third = await post('ai-fill', fillBody());

        for (const finish of finishers) finish();
        await Promise.all([first, second]);

        expect(statuses).toStrictEqual([200, 200, 502, 200]);
        expect(third.statusCode).toBe(429);
      });
    });

    describe('GIVEN two fills already running', (): void => {
      it('WHEN a third fill or a model lookup starts THEN answers 429 until a fill finishes', async (): Promise<void> => {
        const ai = studioAiMock();
        const finishers: (() => void)[] = [];
        const heldFill: AiMissingFactory = async (): Promise<Record<string, unknown>> => {
          const held = new Promise<Record<string, unknown>>((resolve): void => {
            finishers.push((): void => resolve({}));
          });

          return held;
        };

        vi.mocked(ai.fill).mockReturnValue(heldFill);
        vi.mocked(ai.discover).mockResolvedValue(DISCOVERY);
        await start(ai);
        const first = post('ai-fill', fillBody());
        const second = post('ai-fill', fillBody());

        await vi.waitFor((): void => {
          expect(finishers).toHaveLength(2);
        }, WORKER_WAIT);
        const third = await post('ai-fill', fillBody());
        const busyModels = await fastify.inject({ method: 'GET', url: MODELS_URL });

        for (const finish of finishers) finish();
        await Promise.all([first, second]);
        const freeModels = await fastify.inject({ method: 'GET', url: MODELS_URL });

        expect(third.statusCode).toBe(429);
        expect(third.json<ApiErrorBody>().message).toBe('too many AI CLI runs at once');
        expect(busyModels.statusCode).toBe(429);
        expect(freeModels.statusCode).toBe(200);
      });
    });

    describe('GIVEN a foreign origin', (): void => {
      it('WHEN filled THEN answers 403 before any CLI starts', async (): Promise<void> => {
        const ai = studioAiMock();

        await start(ai);
        const headers = { origin: 'https://evil.example' };

        const response = await fastify.inject({ method: 'POST', url: `/api/specs/${specId}/ai-fill`, headers, payload: fillBody() });

        expect(response.statusCode).toBe(403);
        expect(ai.fill).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN a missing pattern that backtracks catastrophically', (): void => {
      it('WHEN the fill matches it THEN validation leaves the event loop free and the stream ends with the 422 error', async (): Promise<void> => {
        const ai = studioAiMock();
        let isValidating = false;
        const backtrackingFill: AiMissingFactory = async (_name, request): Promise<Record<string, unknown>> => {
          isValidating = true;
          await request.validate?.(request.missing, BACKTRACKING_FILL);

          return BACKTRACKING_FILL;
        };

        vi.mocked(ai.fill).mockReturnValue(backtrackingFill);
        fastify = await studioServer(ai, COMPUTE_TIMEOUT_MS);
        specId = await loadDocumentSpec(fastify, backtrackingDocument());
        const body: AiFillBody = { endpointId: 'GET /named', fixture: {}, missing: backtrackingMissing(), tool: 'codex' };
        const started = Date.now();
        const filling = post('ai-fill', body);
        const pending = Promise.resolve('pending');

        await vi.waitUntil((): boolean => isValidating, WORKER_WAIT);
        const health = await fastify.inject({ method: 'GET', url: '/api/ai/cli/models' });
        const fillAtHealth = await Promise.race([filling, pending]);
        const response = await filling;

        expect(health.statusCode).toBe(400);
        expect(fillAtHealth).toBe('pending');
        expect(ndjsonLines(response.body)).toMatchObject([{ type: 'error', message: TOO_EXPENSIVE }]);
        expect(response.body).toContain('STUDIO_COMPUTE_TIMEOUT_MS');
        expect(Date.now() - started).toBeLessThan(COMPUTE_TIMEOUT_MS + 10_000);
      });
    });

    describe('GIVEN a missing projection AJV cannot compile', (): void => {
      it('WHEN filled three times THEN each stream ends with the compile error, no CLI starts, and no slot leaks', async (): Promise<void> => {
        const ai = studioAiMock();

        fastify = await studioServer(ai);
        specId = await loadDocumentSpec(fastify, backtrackingDocument());
        const base = backtrackingMissing();
        const uncompilable: MissingFile = { ...base, schema: UNCOMPILABLE_SCHEMA };
        const body: AiFillBody = { endpointId: 'GET /named', fixture: {}, missing: uncompilable, tool: 'codex' };

        const responses = [await post('ai-fill', body), await post('ai-fill', body), await post('ai-fill', body)];

        const statuses = responses.map((response: LightMyRequestResponse): number => response.statusCode);
        const last = responses[2]?.body ?? '';

        expect(statuses).toStrictEqual([200, 200, 200]);
        expect(ndjsonLines(last)).toMatchObject([{ type: 'error' }]);
        expect(last).toContain('Invalid regular expression');
        expect(ai.fill).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN a slow fill over a real connection', (): void => {
      it('WHEN the client disconnects THEN the CLI signal aborts', async (): Promise<void> => {
        const ai = studioAiMock();
        let fillSignal: AbortSignal | undefined;

        vi.mocked(ai.fill).mockImplementation((options: AiFixtureOptions): AiMissingFactory => {
          fillSignal = options.signal;
          options.onProgress?.({ stream: 'status', text: 'started\n' });

          return neverSettles;
        });
        await start(ai);
        await fastify.listen({ host: '127.0.0.1', port: 0 });
        const port = fastify.addresses()[0]?.port ?? 0;
        const headers = { 'content-type': 'application/json', host: 'localhost:80' };
        const request = httpRequest({ host: '127.0.0.1', port, method: 'POST', path: `/api/specs/${specId}/ai-fill`, headers });
        const firstChunk = new Promise<string>((resolve): void => {
          const onResponse = (response: IncomingMessage): void => {
            response.once('data', (chunk: Buffer): void => resolve(chunk.toString()));
          };

          request.on('response', onResponse);
        });

        request.on('error', (): void => undefined);
        request.end(JSON.stringify(fillBody()));
        const first = await firstChunk;

        request.destroy();

        await vi.waitFor((): void => {
          expect(fillSignal?.aborted).toBe(true);
        });
        expect(first).toContain('started');
      });
    });
  });
});
