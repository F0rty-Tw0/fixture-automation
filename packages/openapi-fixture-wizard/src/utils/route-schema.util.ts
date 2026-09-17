import { FixtureError, referenceName, schemaSuggestion } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

const SUCCESS_STATUS = /^2\d\d$/;
const JSON_CONTENT = 'application/json';
const SCHEMA_FIX = 'answer the schema name instead, e.g. invoice';
const ROUTE_FIX = `check the verb and path, or ${SCHEMA_FIX}`;

const operationOf = (spec: OpenApiSpec, path: string, verb: string): Record<string, unknown> | undefined => {
  const route = spec.paths?.[path];

  if (!isRecord(route)) return undefined;

  const operation = route[verb];

  if (!isRecord(operation)) return undefined;

  return operation;
};

const successResponse = (responses: Record<string, unknown>): unknown => {
  const status = Object.keys(responses).find((key: string): boolean => SUCCESS_STATUS.test(key));

  return responses[status ?? 'default'];
};

const responseSchema = (operation: Record<string, unknown>): unknown => {
  const { responses } = operation;

  if (!isRecord(responses)) return undefined;

  const response = successResponse(responses);

  if (!isRecord(response)) return undefined;

  const { content } = response;

  if (!isRecord(content)) return undefined;

  const json = content[JSON_CONTENT];

  if (!isRecord(json)) return undefined;

  return json['schema'];
};

// ponytail: $ref and items.$ref only; oneOf/allOf responses → answer the schema name
const schemaReference = (schema: unknown): string | undefined => {
  if (!isRecord(schema)) return undefined;

  const reference = schema['$ref'];

  if (typeof reference === 'string') return reference;

  const { items } = schema;

  if (!isRecord(items)) return undefined;

  const itemsReference = items['$ref'];

  if (typeof itemsReference === 'string') return itemsReference;

  return undefined;
};

const routeSchemaName = (spec: OpenApiSpec, method: string, target: string): string => {
  const verb = method.trim().toLowerCase();
  const path = `/${target.trim().replace(/^\/+/, '')}`;
  const route = `${verb.toUpperCase()} ${path}`;
  const operation = operationOf(spec, path, verb);

  if (operation === undefined) throw new FixtureError(`route not found in the spec: ${route}`, ROUTE_FIX);

  const reference = schemaReference(responseSchema(operation));

  if (reference === undefined) throw new FixtureError(`${route} has no named response schema`, SCHEMA_FIX);

  return referenceName(reference);
};

/** With a method, the route's response `$ref` under `paths`; without one, a schema name checked against `components.schemas`. */
export const resolveTarget = (spec: OpenApiSpec, method: string | undefined, target: string): string => {
  if (method !== undefined) return routeSchemaName(spec, method, target);

  const trimmed = target.trim();
  const schemas = spec.components?.schemas ?? {};
  const isDeclared = Object.hasOwn(schemas, trimmed);

  if (!isDeclared) throw new FixtureError(`schema not found: ${trimmed}`, schemaSuggestion(Object.keys(schemas), trimmed));

  return trimmed;
};
