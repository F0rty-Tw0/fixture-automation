import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import type { SpecStore } from './common/specs.type.ts';
import { generateHandler } from './feature/generate.handler.ts';
import { loadSpecHandler } from './feature/load-spec.handler.ts';
import { API_ROUTES } from '../contract/common/studio-api.const.ts';
import { generateBodySchema, loadSpecBodySchema, specParamsSchema } from '../contract/common/studio-api.schema.ts';
import { BODY_LIMIT_BYTES } from '../shared/http/common/http.const.ts';
import type { SpecCompute } from '../spec-compute/common/spec-compute.type.ts';

const loadSpecSchema = { body: loadSpecBodySchema };
const loadSpecOptions = { schema: loadSpecSchema, bodyLimit: BODY_LIMIT_BYTES };
const generateSchema = { body: generateBodySchema, params: specParamsSchema };
const generateOptions = { schema: generateSchema };

/** `POST /specs` loads and caches a spec; `POST /specs/:specId/generate` samples fixtures from a cached one. */
export const specsRoutes = (fastify: FastifyInstance, cache: SpecStore, compute: SpecCompute): void => {
  const router = fastify.withTypeProvider<ZodTypeProvider>();
  const loadSpec = loadSpecHandler(cache);
  const generate = generateHandler(cache, compute);

  router.post(API_ROUTES.specs, loadSpecOptions, loadSpec);
  router.post(API_ROUTES.generate, generateOptions, generate);
};
