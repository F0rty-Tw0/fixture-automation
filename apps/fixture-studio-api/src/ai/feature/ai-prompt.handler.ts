import type { FastifyRequest } from 'fastify';

import type { AiPromptBody, AiPromptResult } from '../../contract/common/studio-api.type.ts';
import type { SpecParams, SpecStore } from '../../specs/common/specs.type.ts';
import { endpointAiPrompt } from '../domain-logic/endpoint-ai-prompt.ts';

type AiPromptRoute = {
  readonly Body: AiPromptBody;
  readonly Params: SpecParams;
};

type AiPromptHandler = (request: FastifyRequest<AiPromptRoute>) => AiPromptResult;

export const aiPromptHandler = (cache: SpecStore): AiPromptHandler => {
  const handler = (request: FastifyRequest<AiPromptRoute>): AiPromptResult => {
    return endpointAiPrompt(cache, request.params.specId, request.body);
  };

  return handler;
};
