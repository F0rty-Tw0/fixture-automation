import server from 'fastify';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { aiRoutes } from './ai.routes.ts';
import type { RequestAccess, RequestIdentity, StudioServerOptions } from './common/studio-server.type.ts';
import type { ApiErrorBody } from './contract/common/studio-api.type.ts';
import { API_PREFIX } from './contract/studio-api.const.ts';
import { SpecCache } from './data-access/spec-cache.store.ts';
import { SpecWorkers } from './data-access/spec-workers.store.ts';
import { fixtureRoutes } from './fixture.routes.ts';
import { specsRoutes } from './specs.routes.ts';
import { errorReply } from './utils/error-reply.util.ts';
import { requestRejection } from './utils/request-guard.util.ts';

type AccessGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply | undefined>;

const accessGuard = (access: RequestAccess): AccessGuard => {
  const guard = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | undefined> => {
    const { host, origin } = request.headers;
    const identity: RequestIdentity = { host, origin, fetchSite: request.headers['sec-fetch-site'] };
    const rejection = requestRejection(identity, access);

    if (rejection === undefined) return undefined;

    return reply.code(403).send(rejection);
  };

  return guard;
};

const sendError = async (error: FastifyError, request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const { statusCode, body } = errorReply(error);

  if (statusCode >= 500) request.log.error({ err: error }, 'request failed');

  return reply.code(statusCode).send(body);
};

const sendNotFound = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const body: ApiErrorBody = { message: `route not found: ${request.method} ${request.url}`, fix: undefined };

  return reply.code(404).send(body);
};

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
