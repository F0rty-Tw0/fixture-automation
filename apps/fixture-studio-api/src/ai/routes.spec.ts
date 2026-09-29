import type { AiToolInstall, ModelDiscovery } from '@fixture-automation/openapi-ai-fixtures';
import { isRecord } from '@fixture-automation/shared';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StudioAi } from './common/ai.type.ts';
import { MOCK_AI } from './data-access/ai-mock.client.ts';
import type {
  AiModelsResult,
  AiPromptResult,
  AiToolsResult,
  ApiErrorBody,
  DiffBody,
  MissingFile
} from '../contract/common/studio-api.type.ts';
import { studioAiMock } from '../test/mocks/studio-ai.mock.ts';
import { schemaReferences } from './test/utils/schema-references.spec.util.ts';
import { diffedMissing, loadStudioSpec, studioServer } from '../test/utils/studio-spec.spec.util.ts';

const ENDPOINT_ID = 'GET /v1/invoices/{id}';
const DISCOVERY: ModelDiscovery = { models: ['gpt-x'], source: 'codex-cli' };
const CUSTOMER = { id: 'cus_9' };
const NESTED_INVOICE = { id: 'in_9', amount_due: 5, status: 'open', memo: 'm', customer: CUSTOMER };
const DIFF_BODY: DiffBody = { endpointId: ENDPOINT_ID, fixture: NESTED_INVOICE, requiredOnly: false };
const MODELS_URL = '/api/ai/cli/models?tool=codex';
const TOOLS_URL = '/api/ai/cli/tools';
const CLAUDE_INSTALL: AiToolInstall = { tool: 'claude', installed: true };
const CODEX_INSTALL: AiToolInstall = { tool: 'codex', installed: false };
const INSTALLS: AiToolInstall[] = [CLAUDE_INSTALL, CODEX_INSTALL];

describe('FEATURE: AI routes', (): void => {
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

  afterEach(async (): Promise<void> => {
    await fastify.close();
  });

  describe('SCENARIO: POST ai-prompt', (): void => {
    describe('GIVEN a diffed fixture', (): void => {
      it('WHEN a prompt is built THEN the response schema bundles every reference it uses', async (): Promise<void> => {
        await start();
        const body = { endpointId: ENDPOINT_ID, fixture: NESTED_INVOICE, missing };

        const response = await post('ai-prompt', body);

        const result = response.json<AiPromptResult>();
        const defs = result.responseSchema['$defs'];
        const references = schemaReferences(result.responseSchema);
        const isBundled = (reference: string): boolean => isRecord(defs) && Object.hasOwn(defs, reference.slice('#/$defs/'.length));

        expect(response.statusCode).toBe(200);
        expect(references).toStrictEqual(['#/$defs/address']);
        expect(references.every(isBundled)).toBe(true);
        expect(result.prompt).toContain('"baseline"');
      });
    });

    describe('GIVEN a missing file of another schema', (): void => {
      it('WHEN a prompt is built THEN answers 400', async (): Promise<void> => {
        await start();
        const otherMissing = { ...missing, schemaName: 'customer' };
        const body = { endpointId: ENDPOINT_ID, fixture: NESTED_INVOICE, missing: otherMissing };

        const response = await post('ai-prompt', body);

        expect(response.statusCode).toBe(400);
        expect(response.json<ApiErrorBody>().message).toBe('missing was diffed against schema "customer", not "invoice"');
      });
    });
  });

  describe('SCENARIO: GET ai/cli', (): void => {
    describe('GIVEN a working discovery', (): void => {
      it('WHEN models are listed THEN answers them, discovering with the timeout and an open signal', async (): Promise<void> => {
        const ai = studioAiMock();
        let signalOpenDuringDiscovery = false;

        vi.mocked(ai.discover).mockImplementation(async (_tool, options): Promise<ModelDiscovery> => {
          signalOpenDuringDiscovery = options.signal?.aborted === false;

          return Promise.resolve(DISCOVERY);
        });
        await start(ai);

        const response = await fastify.inject({ method: 'GET', url: MODELS_URL });

        const options = vi.mocked(ai.discover).mock.calls[0]?.[1];

        expect(response.json<AiModelsResult>()).toStrictEqual(DISCOVERY);
        expect(options).toMatchObject({ timeoutMs: 120_000 });
        expect(signalOpenDuringDiscovery).toBe(true);
      });
    });

    describe('GIVEN a failing discovery', (): void => {
      it('WHEN models are listed THEN answers 502 with its message', async (): Promise<void> => {
        const ai = studioAiMock();

        vi.mocked(ai.discover).mockRejectedValue(new Error('codex model discovery failed: not logged in'));
        await start(ai);

        const response = await fastify.inject({ method: 'GET', url: MODELS_URL });

        expect(response.statusCode).toBe(502);
        expect(response.json<ApiErrorBody>().message).toBe('codex model discovery failed: not logged in');
      });
    });

    describe('GIVEN an unknown tool', (): void => {
      it('WHEN models are listed THEN answers 400', async (): Promise<void> => {
        await start();

        const response = await fastify.inject({ method: 'GET', url: '/api/ai/cli/models?tool=clippy' });

        expect(response.statusCode).toBe(400);
      });
    });
  });
  describe('SCENARIO: GET ai/cli/tools', (): void => {
    describe('GIVEN the CLI setup', (): void => {
      it('WHEN tools are listed THEN answers which are installed and that no mock answers', async (): Promise<void> => {
        const ai = studioAiMock();

        vi.mocked(ai.detect).mockResolvedValue(INSTALLS);
        await start(ai);

        const response = await fastify.inject({ method: 'GET', url: TOOLS_URL });

        const expected: AiToolsResult = { tools: INSTALLS, mock: false };

        expect(response.statusCode).toBe(200);
        expect(response.json<AiToolsResult>()).toStrictEqual(expected);
      });

      it('WHEN every CLI slot is taken THEN still answers, claiming no slot', async (): Promise<void> => {
        const ai = studioAiMock();
        let finishDiscovery: (discovery: ModelDiscovery) => void = (): void => undefined;
        const discovery = new Promise<ModelDiscovery>((resolve): void => {
          finishDiscovery = resolve;
        });
        const isDiscovering = (): void => {
          expect(ai.discover).toHaveBeenCalledTimes(2);
        };

        vi.mocked(ai.discover).mockReturnValue(discovery);
        vi.mocked(ai.detect).mockResolvedValue(INSTALLS);
        await start(ai);
        const listings = [fastify.inject({ method: 'GET', url: MODELS_URL }), fastify.inject({ method: 'GET', url: MODELS_URL })];

        await vi.waitFor(isDiscovering);

        const response = await fastify.inject({ method: 'GET', url: TOOLS_URL });

        finishDiscovery(DISCOVERY);
        await Promise.all(listings);

        expect(response.statusCode).toBe(200);
      });
    });

    describe('GIVEN the mock AI', (): void => {
      it('WHEN tools are listed THEN answers every tool installed and flags the mock', async (): Promise<void> => {
        await start();

        const response = await fastify.inject({ method: 'GET', url: TOOLS_URL });

        const result = response.json<AiToolsResult>();
        const installed = result.tools.map((status) => status.installed);

        expect(result.mock).toBe(true);
        expect(installed).toStrictEqual([true, true, true, true, true]);
      });
    });
  });
});
