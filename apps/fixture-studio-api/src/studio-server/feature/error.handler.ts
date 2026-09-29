import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import { errorReply } from '../utils/error-reply.util.ts';

export const sendError = async (error: FastifyError, request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
  const { statusCode, body } = errorReply(error);

  if (statusCode >= 500) request.log.error({ err: error }, 'request failed');

  return reply.code(statusCode).send(body);
};
