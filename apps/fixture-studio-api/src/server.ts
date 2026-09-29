import server from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { aiRoutes } from './ai/routes.ts';
import { API_PREFIX } from './contract/common/studio-api.const.ts';
import { fixtureRoutes } from './fixture/routes.ts';
import { SpecWorkers } from './spec-compute/data-access/spec-workers.store.ts';
import { SpecCache } from './specs/data-access/spec-cache.store.ts';
import { specsRoutes } from './specs/routes.ts';
import type { StudioServerOptions } from './studio-server/common/studio-server.type.ts';
import { sendError } from './studio-server/feature/error.handler.ts';
import { accessGuard } from './studio-server/feature/guard-access.ts';
import { sendNotFound } from './studio-server/feature/not-found.handler.ts';

/** The Fixture Studio API without a listener, so tests can `inject` requests. */
export const buildServer = (options: StudioServerOptions): FastifyInstance => {
  const fastify = server({ logger: options.logger });
  const guard = accessGuard(options);
  const cache = new SpecCache();
  const workers = new SpecWorkers();
  const compute = { workers, timeoutMs: options.computeTimeoutMs };
  const routesOptions = { prefix: API_PREFIX };
  const closeWorkers = async (): Promise<void> => workers.close();

  const apiRoutes = (api: FastifyInstance): void => {
    specsRoutes(api, cache, compute);
    fixtureRoutes(api, cache, compute);
    aiRoutes(api, cache, options.ai, compute);
  };

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);
  fastify.addHook('onRequest', guard);
  fastify.setErrorHandler(sendError);
  fastify.setNotFoundHandler(sendNotFound);
  fastify.addHook('onClose', closeWorkers);
  void fastify.register(apiRoutes, routesOptions);

  if (options.warmSpecWorker) workers.warm();

  return fastify;
};
