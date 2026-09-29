import { isSchema, missingProjection, parsePath } from '@fixture-automation/openapi-fixture-diff';
import type { MissingEntry, PathToken, SpecSchema, SpecSchemas } from '@fixture-automation/openapi-fixture-diff';
import { FixtureError, reachableSchemas, schemaSuggestion } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import type { MissingFile } from '../../contract/common/studio-api.type.ts';

const isSpecSchemas = (schemas: Record<string, unknown>): schemas is SpecSchemas => {
  const values = Object.values(schemas);

  return values.every(isSchema);
};

/** One step down the missing projection: an object key enters `properties`, an array index enters `items`. */
const childSchema = (schema: unknown, token: PathToken): unknown => {
  if (!isRecord(schema)) return undefined;

  if (typeof token === 'number') return schema['items'];

  const properties = schema['properties'];

  if (!isRecord(properties)) return undefined;

  return properties[token];
};

const missingEntry = (missing: MissingFile, path: string): MissingEntry => {
  let schema = missing.schema;

  for (const token of parsePath(path)) schema = childSchema(schema, token);

  if (!isSchema(schema)) throw new FixtureError(`missing path "${path}" has no schema`, 'run the diff again for this fixture');

  const entry: MissingEntry = { path, schema };

  return entry;
};

const assertListed = (missing: MissingFile, paths: string[]): void => {
  for (const path of paths) {
    const isListed = missing.paths.includes(path);

    if (isListed) continue;

    const fix = schemaSuggestion(missing.paths, path);

    throw new FixtureError(`"${path}" is not a missing path`, fix);
  }
};

const reachableComponents = (projection: SpecSchema, missing: MissingFile): SpecSchemas => {
  const schemas = missing.components.schemas;

  if (!isSpecSchemas(schemas)) {
    throw new FixtureError('missing.components.schemas holds a non-object schema', 'run the diff again for this fixture');
  }

  return reachableSchemas(projection, schemas);
};

/**
 * The part of `missing` covering only `paths`, in `missing.paths` order: the projection is rebuilt from those
 * paths' leaf schemas and `components` keeps only the schemas that projection reaches.
 */
export const missingChunk = (missing: MissingFile, paths: string[]): MissingFile => {
  assertListed(missing, paths);

  const selected = missing.paths.filter((path: string): boolean => paths.includes(path));
  const entries = selected.map((path: string): MissingEntry => missingEntry(missing, path));
  const schema = missingProjection(entries);
  const schemas = reachableComponents(schema, missing);
  const components = { schemas };
  const chunk: MissingFile = { ...missing, paths: selected, schema, components };

  return chunk;
};
