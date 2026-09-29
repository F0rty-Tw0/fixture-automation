import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AiModelsQuery, AiModelsResult } from '../../contract/common/studio-api.type.ts';
import { abortOnDisconnect } from '../../shared/http/feature/abort-on-disconnect.ts';
import type { FillRun } from '../common/ai.type.ts';
import { discoverCliModels } from '../domain-logic/model-discovery.ts';

type AiModelsRoute = {
  readonly Querystring: AiModelsQuery;
};

type AiModelsHandler = (request: FastifyRequest<AiModelsRoute>, reply: FastifyReply) => Promise<AiModelsResult>;

export const aiModelsHandler = (run: FillRun): AiModelsHandler => {
  const handler = async (request: FastifyRequest<AiModelsRoute>, reply: FastifyReply): Promise<AiModelsResult> => {
    const controller = abortOnDisconnect(reply.raw);

    return discoverCliModels(run, request.query.tool, controller.signal);
  };

  return handler;
};
