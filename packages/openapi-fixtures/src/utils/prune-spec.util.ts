import { reachableSchemas } from './reachable-schemas.util.ts';
import { schemaSuggestion } from './schema-suggestion.util.ts';
import { FixtureError } from '../common/fixture.error.ts';
import type { OpenApiSpec } from '../common/openapi.type.ts';

/** The document-level keys a pruned spec keeps; `paths` and everything else is dropped. */
const header = (spec: OpenApiSpec): OpenApiSpec => {
  let kept: OpenApiSpec = {};

  if (spec.openapi !== undefined) kept = { ...kept, openapi: spec.openapi };

  if (spec.info !== undefined) kept = { ...kept, info: spec.info };

  if (spec.jsonSchemaDialect !== undefined) kept = { ...kept, jsonSchemaDialect: spec.jsonSchemaDialect };

  return kept;
};

/**
 * Reduce a spec to one root schema plus the component schemas it reaches through `$ref`.
 *
 * The root name is recorded as `x-root-schema`, so every later tool can default its
 * schema name from the pruned document instead of asking for it again.
 */
export const pruneSpec = (spec: OpenApiSpec, schemaName: string): OpenApiSpec => {
  const all = spec.components?.schemas ?? {};
  const schema = all[schemaName];

  if (!schema) throw new FixtureError(`schema not found: ${schemaName}`, schemaSuggestion(Object.keys(all), schemaName));

  const reachable = reachableSchemas(schema, all);
  const schemas = { [schemaName]: schema, ...reachable };
  const components = { schemas };
  const kept = header(spec);
  const pruned: OpenApiSpec = { ...kept, 'x-root-schema': schemaName, components };

  return pruned;
};
