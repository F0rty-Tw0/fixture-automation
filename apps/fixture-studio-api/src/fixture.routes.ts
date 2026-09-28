import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { BODY_LIMIT_BYTES } from './common/studio-server.const.ts';
import type { DiffTask, MergeTask, SpecCompute, SpecStore } from './common/studio-server.type.ts';
import type { DiffBody, DiffResult, MergeBody, MergeResult } from './contract/common/studio-api.type.ts';
import { API_ROUTES } from './contract/studio-api.const.ts';
import { diffBodySchema, mergeBodySchema, specParamsSchema } from './contract/studio-api.schema.ts';
import { abortOnDisconnect } from './data-access/disconnect-abort.client.ts';
import { computeInWorker } from './data-access/spec-compute.client.ts';
import { endpointSchemaName } from './utils/endpoint-schema.util.ts';

type SpecParams = {
  readonly specId: string;
};

type DiffRoute = {
  readonly Body: DiffBody;
  readonly Params: SpecParams;
};

type MergeRoute = {
  readonly Body: MergeBody;
  readonly Params: SpecParams;
};

const diffSchema = { body: diffBodySchema, params: specParamsSchema };
const diffOptions = { schema: diffSchema, bodyLimit: BODY_LIMIT_BYTES };
const mergeSchema = { body: mergeBodySchema, params: specParamsSchema };
const mergeOptions = { schema: mergeSchema, bodyLimit: BODY_LIMIT_BYTES };

/** `POST /specs/:specId/diff` reports what a fixture lacks; `POST /specs/:specId/merge` fills and validates it. */
export const fixtureRoutes = (fastify: FastifyInstance, cache: SpecStore, compute: SpecCompute): void => {
  const router = fastify.withTypeProvider<ZodTypeProvider>();

  const diffHandler = async (request: FastifyRequest<DiffRoute>, reply: FastifyReply): Promise<DiffResult> => {
    const spec = cache.require(request.params.specId);
    const schemaName = endpointSchemaName(spec, request.body.endpointId);
    const { signal } = abortOnDisconnect(reply.raw);
    const task: DiffTask = { name: 'diff', spec, schemaName, body: request.body };

    return computeInWorker(task, { ...compute, signal });
  };

  const mergeHandler = async (request: FastifyRequest<MergeRoute>, reply: FastifyReply): Promise<MergeResult> => {
    const spec = cache.require(request.params.specId);
    const schemaName = endpointSchemaName(spec, request.body.endpointId);
    const { signal } = abortOnDisconnect(reply.raw);
    const task: MergeTask = { name: 'merge', spec, schemaName, body: request.body };

    return computeInWorker(task, { ...compute, signal });
  };

  router.post(API_ROUTES.diff, diffOptions, diffHandler);
  router.post(API_ROUTES.merge, mergeOptions, mergeHandler);
};
