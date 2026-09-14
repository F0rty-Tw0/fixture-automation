import { prepareSchema, schemaDialect } from '@fixture-automation/openapi-ai-fixtures';
import { reachableSchemas } from '@fixture-automation/openapi-fixtures';

import type { FixtureDiff, FixtureDiffRequest, MissingEntry } from '../common/missing.type.ts';
import type { SchemaComponents } from '../common/schema.type.ts';
import { missingProjection } from '../utils/missing-projection.util.ts';
import { missingEntries } from '../utils/missing-walk.util.ts';
import { contextComponents } from '../utils/prepared-context.util.ts';

const uniqueEntries = (entries: MissingEntry[]): MissingEntry[] => {
  const seen = new Set<string>();
  const unique: MissingEntry[] = [];

  for (const entry of entries) {
    const isSeen = seen.has(entry.path);

    if (isSeen) continue;

    seen.add(entry.path);
    unique.push(entry);
  }

  return unique;
};

/**
 * Compare a fixture against its schema and project every absent property into one Missing schema.
 *
 * `components` lists only the schemas reachable from that projection, so a diff over a large
 * spec stays small enough to hand to the AI step.
 */
export const diffFixture = (request: FixtureDiffRequest): FixtureDiff => {
  const { spec, schemaName, fixture, requiredOnly } = request;
  const dialect = schemaDialect(spec.openapi, spec.jsonSchemaDialect);
  const prepared = prepareSchema(spec, schemaName);
  const components = contextComponents(prepared.context);
  const schema = components.schemas[schemaName];

  if (schema === undefined) throw new Error(`schema "${schemaName}" is unavailable`);

  const walked = missingEntries({ schema, value: fixture, path: '', schemas: components.schemas, requiredOnly, ancestry: [] });
  const entries = uniqueEntries(walked);
  const paths = entries.map((entry) => entry.path);
  const projection = missingProjection(entries);
  const schemas = reachableSchemas(projection, components.schemas);
  const reachable: SchemaComponents = { schemas };
  const diff: FixtureDiff = { schemaName, dialect, paths, schema: projection, components: reachable };

  return diff;
};
