import type { FastifyReply, FastifyRequest } from 'fastify';

import type { DiffBody, DiffResult } from '../../contract/common/studio-api.type.ts';
import { abortOnDisconnect } from '../../shared/http/feature/abort-on-disconnect.ts';
import type { SpecCompute, SpecComputeOptions } from '../../spec-compute/common/spec-compute.type.ts';
import type { SpecParams, SpecStore } from '../../specs/common/specs.type.ts';
import { diffInWorker } from '../domain-logic/fixture-compute.ts';

type DiffRoute = {
  readonly Body: DiffBody;
  readonly Params: SpecParams;
};

type DiffHandler = (request: FastifyRequest<DiffRoute>, reply: FastifyReply) => Promise<DiffResult>;

export const fixtureDiffHandler = (cache: SpecStore, compute: SpecCompute): DiffHandler => {
  const handler = async (request: FastifyRequest<DiffRoute>, reply: FastifyReply): Promise<DiffResult> => {
    const { signal } = abortOnDisconnect(reply.raw);
    const options: SpecComputeOptions = { ...compute, signal };

    return diffInWorker(cache, request.params.specId, request.body, options);
  };

  return handler;
};
