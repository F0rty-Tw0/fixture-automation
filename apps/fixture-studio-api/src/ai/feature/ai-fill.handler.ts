import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AiFillBody } from '../../contract/common/studio-api.type.ts';
import { abortOnDisconnect } from '../../shared/http/feature/abort-on-disconnect.ts';
import type { SpecParams, SpecStore } from '../../specs/common/specs.type.ts';
import type { FillRun } from '../common/ai.type.ts';
import { claimAiFillJob } from '../domain-logic/ai-fill-job.ts';
import { aiFillStream } from '../domain-logic/ai-fill-stream.ts';

type AiFillRoute = {
  readonly Body: AiFillBody;
  readonly Params: SpecParams;
};

type AiFillHandler = (request: FastifyRequest<AiFillRoute>, reply: FastifyReply) => FastifyReply;

export const aiFillHandler = (run: FillRun, cache: SpecStore): AiFillHandler => {
  const handler = (request: FastifyRequest<AiFillRoute>, reply: FastifyReply): FastifyReply => {
    const job = claimAiFillJob(run, cache, request.params.specId, request.body);
    const controller = abortOnDisconnect(reply.raw);
    const stream = aiFillStream(job, controller);

    return reply.type('application/x-ndjson').send(stream);
  };

  return handler;
};
