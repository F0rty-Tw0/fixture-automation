import { prepareSchema, schemaDialect } from '@fixture-automation/openapi-ai-fixtures';
import { reachableSchemas } from '@fixture-automation/openapi-fixtures';
import { selectFixtureShape } from '@fixture-automation/shared';

import type { FixtureDiff, FixtureDiffRequest, MissingEntry } from '../common/missing.type.ts';
import type { SchemaComponents, SpecSchema } from '../common/schema.type.ts';
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

const wrappedPath = (objectShape: string, path: string): string => {
  const isArrayPath = path.startsWith('[');

  if (isArrayPath) return `${objectShape}${path}`;

  return `${objectShape}.${path}`;
};

const wrappedProjection = (objectShape: string, projection: SpecSchema): SpecSchema => {
  const properties = { [objectShape]: projection };
  const schema: SpecSchema = {
    type: 'object',
    required: [objectShape],
    properties
  };

  return schema;
};

/**
 * Compare a fixture against its schema and project every absent property into one Missing schema.
 *
 * `components` lists only the schemas reachable from that projection, so a diff over a large
 * spec stays small enough to hand to the AI step.
 */
export const diffFixture = (request: FixtureDiffRequest): FixtureDiff => {
  const { spec, schemaName, fixture, requiredOnly, objectShape: objectShapeInput } = request;
  const trimmedShape = objectShapeInput?.trim();
  const objectShape = trimmedShape === '' ? undefined : trimmedShape;
  const selectedFixture = selectFixtureShape(fixture, objectShape);
  const dialect = schemaDialect(spec.openapi, spec.jsonSchemaDialect);
  const prepared = prepareSchema(spec, schemaName);
  const components = contextComponents(prepared.context);
  const sourceSchema = components.schemas[schemaName];

  if (sourceSchema === undefined) throw new Error(`schema "${schemaName}" is unavailable`);

  const walked = missingEntries({
    schema: sourceSchema,
    value: selectedFixture,
    path: '',
    schemas: components.schemas,
    requiredOnly,
    ancestry: []
  });
  const entries = uniqueEntries(walked);
  const innerPaths = entries.map((entry) => entry.path);
  const projection = missingProjection(entries);
  let paths = innerPaths;
  let schema = projection;

  if (objectShape !== undefined) {
    paths = innerPaths.map((path) => wrappedPath(objectShape, path));
    schema = wrappedProjection(objectShape, projection);
  }

  const schemas = reachableSchemas(projection, components.schemas);
  const reachable: SchemaComponents = { schemas };
  const diff: FixtureDiff = { schemaName, dialect, paths, schema, components: reachable };

  return diff;
};
