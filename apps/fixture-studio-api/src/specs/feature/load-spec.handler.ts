import type { FastifyRequest } from 'fastify';

import type { LoadSpecBody, LoadedSpec } from '../../contract/common/studio-api.type.ts';
import type { SpecStore } from '../common/specs.type.ts';
import { cacheLoadedSpec } from '../domain-logic/spec-loading.ts';

type LoadSpecRoute = {
  readonly Body: LoadSpecBody;
};

type LoadSpecHandler = (request: FastifyRequest<LoadSpecRoute>) => Promise<LoadedSpec>;

export const loadSpecHandler = (cache: SpecStore): LoadSpecHandler => {
  const handler = async (request: FastifyRequest<LoadSpecRoute>): Promise<LoadedSpec> => cacheLoadedSpec(cache, request.body);

  return handler;
};
