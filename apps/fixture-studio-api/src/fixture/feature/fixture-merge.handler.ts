import type { FastifyReply, FastifyRequest } from 'fastify';

import type { MergeBody, MergeResult } from '../../contract/common/studio-api.type.ts';
import { abortOnDisconnect } from '../../shared/http/feature/abort-on-disconnect.ts';
import type { SpecCompute, SpecComputeOptions } from '../../spec-compute/common/spec-compute.type.ts';
import type { SpecParams, SpecStore } from '../../specs/common/specs.type.ts';
import { mergeInWorker } from '../domain-logic/fixture-compute.ts';

type MergeRoute = {
  readonly Body: MergeBody;
  readonly Params: SpecParams;
};

type MergeHandler = (request: FastifyRequest<MergeRoute>, reply: FastifyReply) => Promise<MergeResult>;

export const fixtureMergeHandler = (cache: SpecStore, compute: SpecCompute): MergeHandler => {
  const handler = async (request: FastifyRequest<MergeRoute>, reply: FastifyReply): Promise<MergeResult> => {
    const { signal } = abortOnDisconnect(reply.raw);
    const options: SpecComputeOptions = { ...compute, signal };

    return mergeInWorker(cache, request.params.specId, request.body, options);
  };

  return handler;
};
