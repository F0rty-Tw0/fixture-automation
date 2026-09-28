import { FixtureError } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import { listEndpoints } from './endpoint-list.util.ts';
import type { Endpoint } from '../contract/common/studio-api.type.ts';

const PICK_FIX = 'pick an endpoint from the list the spec was loaded with';

/** The response schema an endpoint id resolves to; unknown and unsupported endpoints fail with a `FixtureError`. */
export const endpointSchemaName = (spec: OpenApiSpec, endpointId: string): string => {
  const endpoints = listEndpoints(spec);
  const endpoint = endpoints.find((candidate: Endpoint): boolean => candidate.id === endpointId);

  if (endpoint === undefined) throw new FixtureError(`unknown endpoint: ${endpointId}`, PICK_FIX);

  const { schemaName, unsupportedReason } = endpoint;

  if (schemaName === null) throw new FixtureError(`${endpointId} cannot be generated: ${unsupportedReason ?? 'no schema'}`, PICK_FIX);

  return schemaName;
};
