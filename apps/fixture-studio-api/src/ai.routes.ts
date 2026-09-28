import type { AiFixtureOptions, AiMissingRequest, MissingValidator, MissingVerdict } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { BODY_LIMIT_BYTES } from './common/studio-server.const.ts';
import type { AiFillJob, ChunkedFillRun, SpecCompute, SpecStore, StudioAi, ValidateMissingTask } from './common/studio-server.type.ts';
import type {
  AiFillBody,
  AiModelsQuery,
  AiModelsResult,
  AiPromptBody,
  AiPromptResult,
  AiToolsResult,
  MissingFile
} from './contract/common/studio-api.type.ts';
import { API_ROUTES } from './contract/studio-api.const.ts';
import {
  aiFillBodySchema,
  aiModelsQuerySchema,
  aiPromptBodySchema,
  aiToolsResultSchema,
  specParamsSchema
} from './contract/studio-api.schema.ts';
import { chunkedFill } from './data-access/ai-chunked-fill.client.ts';
import { aiFillStream } from './data-access/ai-fill-stream.client.ts';
import { CliRunSlots } from './data-access/cli-run-slots.store.ts';
import { abortOnDisconnect } from './data-access/disconnect-abort.client.ts';
import { computeInWorker } from './data-access/spec-compute.client.ts';
import { aiPrompt, missingScenario } from './utils/ai-prompt.util.ts';
import { endpointSchemaName } from './utils/endpoint-schema.util.ts';
import { statusError } from './utils/status-error.util.ts';

type SpecParams = {
  readonly specId: string;
};

type AiPromptRoute = {
  readonly Body: AiPromptBody;
  readonly Params: SpecParams;
};

type AiFillRoute = {
  readonly Body: AiFillBody;
  readonly Params: SpecParams;
};

type AiModelsRoute = {
  readonly Querystring: AiModelsQuery;
};

const MODELS_TIMEOUT_MS = 120_000;
const DISCOVERY_FIX = 'check that the CLI is installed and logged in, or type the model name';
const promptSchema = { body: aiPromptBodySchema, params: specParamsSchema };
const promptOptions = { schema: promptSchema, bodyLimit: BODY_LIMIT_BYTES };
const fillSchema = { body: aiFillBodySchema, params: specParamsSchema };
const fillOptions = { schema: fillSchema, bodyLimit: BODY_LIMIT_BYTES };
const modelsSchema = { querystring: aiModelsQuerySchema };
const modelsOptions = { schema: modelsSchema };
const toolsResponse = { 200: aiToolsResultSchema };
const toolsSchema = { response: toolsResponse };
const toolsOptions = { schema: toolsSchema };

const endpointMissing = (spec: OpenApiSpec, endpointId: string, missing: MissingFile): string => {
  const schemaName = endpointSchemaName(spec, endpointId);
  const isSameSchema = missing.schemaName === schemaName;

  if (!isSameSchema) {
    throw new FixtureError(
      `missing was diffed against schema "${missing.schemaName}", not "${schemaName}"`,
      'run the diff again for this endpoint'
    );
  }

  return schemaName;
};

/** Validates the model's fill in a spec worker, so a backtracking `pattern` ends in a 422 instead of stalling the event loop. */
const workerValidator = (compute: SpecCompute, signal: AbortSignal): MissingValidator => {
  const validate = async (missing: MissingFile, value: unknown): Promise<MissingVerdict> => {
    const task: ValidateMissingTask = { name: 'validate-missing', missing, value };

    return computeInWorker(task, { ...compute, signal });
  };

  return validate;
};

type FillRun = {
  readonly ai: StudioAi;
  readonly slots: CliRunSlots;
  readonly compute: SpecCompute;
};

/** The fill run, chunked when its prompt is too big for one answer; it releases its CLI slot however it ends. */
const fillJob = (run: FillRun, schemaName: string, body: AiFillBody): AiFillJob => {
  const { ai, compute, slots } = run;
  const scenario = missingScenario(body.scenario);

  const job: AiFillJob = async (signal, onProgress) => {
    const validate = workerValidator(compute, signal);
    const request: AiMissingRequest = { fixture: body.fixture, missing: body.missing, scenario, validate };
    let options: AiFixtureOptions = { tool: body.tool, signal, onProgress };

    if (body.model !== undefined) options = { ...options, model: body.model };

    try {
      // Compiles the projection before the paid CLI run; the verdict on `undefined` is irrelevant, only a compile error matters.
      await validate(body.missing, undefined);

      const enrich = ai.fill(options);
      const fill: ChunkedFillRun = { enrich, schemaName, request, signal, onProgress };

      return await chunkedFill(fill);
    } finally {
      slots.release();
    }
  };

  return job;
};

/**
 * Prompt building for an on-device model, the CLI install check, CLI model discovery, and the streamed CLI fill
 * (`application/x-ndjson`), split into sequential chunks when its prompt is large; at most 2 CLI runs at once, and
 * the install check runs none.
 */
export const aiRoutes = (fastify: FastifyInstance, cache: SpecStore, ai: StudioAi, compute: SpecCompute): void => {
  const router = fastify.withTypeProvider<ZodTypeProvider>();
  const slots = new CliRunSlots();
  const run: FillRun = { ai, slots, compute };

  const promptHandler = (request: FastifyRequest<AiPromptRoute>): AiPromptResult => {
    const { endpointId, fixture, missing, paths, scenario } = request.body;
    const spec = cache.require(request.params.specId);

    endpointMissing(spec, endpointId, missing);

    return aiPrompt(fixture, missing, scenario, paths);
  };

  const modelsHandler = async (request: FastifyRequest<AiModelsRoute>, reply: FastifyReply): Promise<AiModelsResult> => {
    const controller = abortOnDisconnect(reply.raw);
    const discoveryOptions = { signal: controller.signal, timeoutMs: MODELS_TIMEOUT_MS };

    slots.claim();

    try {
      const discovery = await ai.discover(request.query.tool, discoveryOptions);
      const result: AiModelsResult = { models: discovery.models, source: discovery.source };

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'model discovery failed';

      throw statusError(502, message, DISCOVERY_FIX);
    } finally {
      slots.release();
    }
  };

  const toolsHandler = async (): Promise<AiToolsResult> => {
    const tools = await ai.detect();
    const result: AiToolsResult = { tools, mock: ai.isMock };

    return result;
  };

  const fillHandler = (request: FastifyRequest<AiFillRoute>, reply: FastifyReply): FastifyReply => {
    const { endpointId, missing } = request.body;
    const spec = cache.require(request.params.specId);
    const schemaName = endpointMissing(spec, endpointId, missing);
    const job = fillJob(run, schemaName, request.body);

    slots.claim();

    const controller = abortOnDisconnect(reply.raw);
    const stream = aiFillStream(job, controller);

    return reply.type('application/x-ndjson').send(stream);
  };

  router.post(API_ROUTES.aiPrompt, promptOptions, promptHandler);
  router.get(API_ROUTES.aiModels, modelsOptions, modelsHandler);
  router.get(API_ROUTES.aiTools, toolsOptions, toolsHandler);
  router.post(API_ROUTES.aiFill, fillOptions, fillHandler);
};
