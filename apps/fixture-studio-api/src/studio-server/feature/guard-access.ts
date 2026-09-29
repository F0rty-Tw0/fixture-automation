import type { FastifyReply, FastifyRequest } from 'fastify';

import type { RequestAccess, RequestIdentity } from '../common/studio-server.type.ts';
import { requestRejection } from '../utils/request-guard.util.ts';

type AccessGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply | undefined>;

export const accessGuard = (access: RequestAccess): AccessGuard => {
  const guard = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | undefined> => {
    const { host, origin } = request.headers;
    const identity: RequestIdentity = { host, origin, fetchSite: request.headers['sec-fetch-site'] };
    const rejection = requestRejection(identity, access);

    if (rejection === undefined) return undefined;

    return reply.code(403).send(rejection);
  };

  return guard;
};
