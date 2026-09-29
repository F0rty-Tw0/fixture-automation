import type { FastifyReply, FastifyRequest } from 'fastify';

import type { GenerateBody, GenerateResult } from '../../contract/common/studio-api.type.ts';
import { abortOnDisconnect } from '../../shared/http/feature/abort-on-disconnect.ts';
import type { SpecCompute, SpecComputeOptions } from '../../spec-compute/common/spec-compute.type.ts';
import type { SpecParams, SpecStore } from '../common/specs.type.ts';
import { generateInWorker } from '../domain-logic/spec-generation.ts';

type GenerateRoute = {
  readonly Body: GenerateBody;
  readonly Params: SpecParams;
};

type GenerateHandler = (request: FastifyRequest<GenerateRoute>, reply: FastifyReply) => Promise<GenerateResult>;

export const generateHandler = (cache: SpecStore, compute: SpecCompute): GenerateHandler => {
  const handler = async (request: FastifyRequest<GenerateRoute>, reply: FastifyReply): Promise<GenerateResult> => {
    const { signal } = abortOnDisconnect(reply.raw);
    const options: SpecComputeOptions = { ...compute, signal };

    return generateInWorker(cache, request.params.specId, request.body, options);
  };

  return handler;
};
