import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ApiErrorBody } from '../../contract/common/studio-api.type.ts';

export const sendNotFound = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const body: ApiErrorBody = { message: `route not found: ${request.method} ${request.url}`, fix: undefined };

  return reply.code(404).send(body);
};
