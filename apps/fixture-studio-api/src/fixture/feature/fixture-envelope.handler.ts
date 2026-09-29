import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EnvelopeBody, EnvelopeResult } from '../../contract/common/studio-api.type.ts';
import { abortOnDisconnect } from '../../shared/http/feature/abort-on-disconnect.ts';
import type { SpecCompute, SpecComputeOptions } from '../../spec-compute/common/spec-compute.type.ts';
import type { SpecParams, SpecStore } from '../../specs/common/specs.type.ts';
import { envelopeInWorker } from '../domain-logic/fixture-compute.ts';

type EnvelopeRoute = {
  readonly Body: EnvelopeBody;
  readonly Params: SpecParams;
};

type EnvelopeHandler = (request: FastifyRequest<EnvelopeRoute>, reply: FastifyReply) => Promise<EnvelopeResult>;

export const fixtureEnvelopeHandler = (cache: SpecStore, compute: SpecCompute): EnvelopeHandler => {
  const handler = async (request: FastifyRequest<EnvelopeRoute>, reply: FastifyReply): Promise<EnvelopeResult> => {
    const { signal } = abortOnDisconnect(reply.raw);
    const options: SpecComputeOptions = { ...compute, signal };

    return envelopeInWorker(cache, request.params.specId, request.body, options);
  };

  return handler;
};
