import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { fixtureDiffHandler } from './feature/fixture-diff.handler.ts';
import { fixtureEnvelopeHandler } from './feature/fixture-envelope.handler.ts';
import { fixtureMergeHandler } from './feature/fixture-merge.handler.ts';
import { API_ROUTES } from '../contract/common/studio-api.const.ts';
import { diffBodySchema, envelopeBodySchema, mergeBodySchema, specParamsSchema } from '../contract/common/studio-api.schema.ts';
import { BODY_LIMIT_BYTES } from '../shared/http/common/http.const.ts';
import type { SpecCompute } from '../spec-compute/common/spec-compute.type.ts';
import type { SpecStore } from '../specs/common/specs.type.ts';

const diffSchema = { body: diffBodySchema, params: specParamsSchema };
const diffOptions = { schema: diffSchema, bodyLimit: BODY_LIMIT_BYTES };
const envelopeSchema = { body: envelopeBodySchema, params: specParamsSchema };
const envelopeOptions = { schema: envelopeSchema, bodyLimit: BODY_LIMIT_BYTES };
const mergeSchema = { body: mergeBodySchema, params: specParamsSchema };
const mergeOptions = { schema: mergeSchema, bodyLimit: BODY_LIMIT_BYTES };

/**
 * `POST /specs/:specId/diff` reports what a fixture lacks, `POST /specs/:specId/envelope` names the property most
 * likely to hold its payload, and `POST /specs/:specId/merge` fills and validates it.
 */
export const fixtureRoutes = (fastify: FastifyInstance, cache: SpecStore, compute: SpecCompute): void => {
  const router = fastify.withTypeProvider<ZodTypeProvider>();
  const diff = fixtureDiffHandler(cache, compute);
  const envelope = fixtureEnvelopeHandler(cache, compute);
  const merge = fixtureMergeHandler(cache, compute);

  router.post(API_ROUTES.diff, diffOptions, diff);
  router.post(API_ROUTES.envelope, envelopeOptions, envelope);
  router.post(API_ROUTES.merge, mergeOptions, merge);
};
