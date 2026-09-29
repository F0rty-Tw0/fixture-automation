import { HTTP_METHODS } from '@fixture-automation/openapi-fixture-merge';
import { resolveTarget } from '@fixture-automation/openapi-fixture-wizard';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import type { Endpoint } from '../../contract/common/studio-api.type.ts';

type SchemaResolution = {
  readonly schemaName: string | null;
  readonly unsupportedReason: string | undefined;
};

const schemaResolution = (spec: OpenApiSpec, method: string, path: string): SchemaResolution => {
  try {
    const schemaName = resolveTarget(spec, method, path);
    const resolved: SchemaResolution = { schemaName, unsupportedReason: undefined };

    return resolved;
  } catch (error: unknown) {
    if (!(error instanceof Error)) throw error;

    const unsupported: SchemaResolution = { schemaName: null, unsupportedReason: error.message };

    return unsupported;
  }
};

const isString = (value: unknown): value is string => typeof value === 'string';

const tagsOf = (operation: Record<string, unknown>): string[] => {
  const { tags } = operation;

  if (!Array.isArray(tags)) return [];

  return tags.filter(isString);
};

const endpointOf = (spec: OpenApiSpec, path: string, method: string, operation: Record<string, unknown>): Endpoint => {
  const upperMethod = method.toUpperCase();
  const resolution = schemaResolution(spec, method, path);
  const { summary } = operation;
  const summaryText = isString(summary) ? summary : undefined;
  const tags = tagsOf(operation);
  const endpoint: Endpoint = {
    id: `${upperMethod} ${path}`,
    method: upperMethod,
    path,
    summary: summaryText,
    tags,
    ...resolution
  };

  return endpoint;
};

const routeEndpoints = (spec: OpenApiSpec, path: string, route: unknown): Endpoint[] => {
  if (!isRecord(route)) return [];

  const endpoints: Endpoint[] = [];

  for (const method of HTTP_METHODS) {
    const operation = route[method];

    if (!isRecord(operation)) continue;

    const endpoint = endpointOf(spec, path, method, operation);

    endpoints.push(endpoint);
  }

  return endpoints;
};

/**
 * Every operation under `paths`, sorted by path then by `HTTP_METHODS` order.
 * An operation whose success response is not a named JSON schema (or an array of one) carries `schemaName: null`
 * and the resolver's message as `unsupportedReason`.
 */
export const listEndpoints = (spec: OpenApiSpec): Endpoint[] => {
  const paths = spec.paths ?? {};
  const sortedPaths = Object.keys(paths).toSorted();
  const pathEndpoints = (path: string): Endpoint[] => routeEndpoints(spec, path, paths[path]);

  return sortedPaths.flatMap(pathEndpoints);
};
