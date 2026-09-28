import { loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { BODY_LIMIT_BYTES } from './common/studio-server.const.ts';
import type { GenerateTask, SpecCompute, SpecStore } from './common/studio-server.type.ts';
import type { GenerateBody, GenerateResult, LoadSpecBody, LoadedSpec } from './contract/common/studio-api.type.ts';
import { API_ROUTES } from './contract/studio-api.const.ts';
import { generateBodySchema, loadSpecBodySchema, specParamsSchema } from './contract/studio-api.schema.ts';
import { abortOnDisconnect } from './data-access/disconnect-abort.client.ts';
import { computeInWorker } from './data-access/spec-compute.client.ts';
import { loadedSpec } from './utils/loaded-spec.util.ts';
import { openApiDocument } from './utils/openapi-document.util.ts';

type LoadSpecRoute = {
  readonly Body: LoadSpecBody;
};

type SpecParams = {
  readonly specId: string;
};

type GenerateRoute = {
  readonly Body: GenerateBody;
  readonly Params: SpecParams;
};

const loadSpecSchema = { body: loadSpecBodySchema };
const loadSpecOptions = { schema: loadSpecSchema, bodyLimit: BODY_LIMIT_BYTES };
const generateSchema = { body: generateBodySchema, params: specParamsSchema };
const generateOptions = { schema: generateSchema };

const specFrom = async (body: LoadSpecBody): Promise<OpenApiSpec> => {
  if ('url' in body) return loadSpec(body.url);

  return openApiDocument(body.document);
};

/** `POST /specs` loads and caches a spec; `POST /specs/:specId/generate` samples fixtures from a cached one. */
export const specsRoutes = (fastify: FastifyInstance, cache: SpecStore, compute: SpecCompute): void => {
  const router = fastify.withTypeProvider<ZodTypeProvider>();

  const loadSpecHandler = async (request: FastifyRequest<LoadSpecRoute>): Promise<LoadedSpec> => {
    const spec = await specFrom(request.body);
    const specId = cache.add(spec);

    return loadedSpec(specId, spec);
  };

  const generateHandler = async (request: FastifyRequest<GenerateRoute>, reply: FastifyReply): Promise<GenerateResult> => {
    const spec = cache.require(request.params.specId);
    const { signal } = abortOnDisconnect(reply.raw);
    const task: GenerateTask = { name: 'generate', spec, body: request.body };

    return computeInWorker(task, { ...compute, signal });
  };

  router.post(API_ROUTES.specs, loadSpecOptions, loadSpecHandler);
  router.post(API_ROUTES.generate, generateOptions, generateHandler);
};
