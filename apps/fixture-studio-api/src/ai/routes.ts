import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import type { FillRun, StudioAi } from './common/ai.type.ts';
import { CliRunSlots } from './data-access/cli-run-slots.store.ts';
import { aiFillHandler } from './feature/ai-fill.handler.ts';
import { aiModelsHandler } from './feature/ai-models.handler.ts';
import { aiPromptHandler } from './feature/ai-prompt.handler.ts';
import { aiToolsHandler } from './feature/ai-tools.handler.ts';
import { API_ROUTES } from '../contract/common/studio-api.const.ts';
import {
  aiFillBodySchema,
  aiModelsQuerySchema,
  aiPromptBodySchema,
  aiToolsResultSchema,
  specParamsSchema
} from '../contract/common/studio-api.schema.ts';
import { BODY_LIMIT_BYTES } from '../shared/http/common/http.const.ts';
import type { SpecCompute } from '../spec-compute/common/spec-compute.type.ts';
import type { SpecStore } from '../specs/common/specs.type.ts';

const promptSchema = { body: aiPromptBodySchema, params: specParamsSchema };
const promptOptions = { schema: promptSchema, bodyLimit: BODY_LIMIT_BYTES };
const fillSchema = { body: aiFillBodySchema, params: specParamsSchema };
const fillOptions = { schema: fillSchema, bodyLimit: BODY_LIMIT_BYTES };
const modelsSchema = { querystring: aiModelsQuerySchema };
const modelsOptions = { schema: modelsSchema };
const toolsResponse = { 200: aiToolsResultSchema };
const toolsSchema = { response: toolsResponse };
const toolsOptions = { schema: toolsSchema };

/**
 * Prompt building for an on-device model, the CLI install check, CLI model discovery, and the streamed CLI fill
 * (`application/x-ndjson`), split into sequential chunks when its prompt is large; at most 2 CLI runs at once, and
 * the install check runs none.
 */
export const aiRoutes = (fastify: FastifyInstance, cache: SpecStore, ai: StudioAi, compute: SpecCompute): void => {
  const router = fastify.withTypeProvider<ZodTypeProvider>();
  const slots = new CliRunSlots();
  const run: FillRun = { ai, slots, compute };
  const prompt = aiPromptHandler(cache);
  const models = aiModelsHandler(run);
  const tools = aiToolsHandler(ai);
  const fill = aiFillHandler(run, cache);

  router.post(API_ROUTES.aiPrompt, promptOptions, prompt);
  router.get(API_ROUTES.aiModels, modelsOptions, models);
  router.get(API_ROUTES.aiTools, toolsOptions, tools);
  router.post(API_ROUTES.aiFill, fillOptions, fill);
};
