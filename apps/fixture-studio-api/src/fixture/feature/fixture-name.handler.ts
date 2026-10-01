import type { FastifyRequest } from 'fastify';

import type { FixtureNameQuery, FixtureNameResult } from '../../contract/common/studio-api.type.ts';
import { fixtureFileName } from '../utils/fixture-name.util.ts';

type FixtureNameRoute = {
  readonly Querystring: FixtureNameQuery;
};

export const fixtureNameHandler = (request: FastifyRequest<FixtureNameRoute>): FixtureNameResult => {
  return fixtureFileName(request.query);
};
