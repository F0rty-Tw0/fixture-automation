import { isSchema, missingProjection, resolveSchema } from '@fixture-automation/openapi-fixture-diff';
import type { MissingEntry, SpecSchema, SpecSchemas } from '@fixture-automation/openapi-fixture-diff';
import { FixtureError, reachableSchemas, schemaSuggestion } from '@fixture-automation/openapi-fixtures';
import { isRecord, parsePath } from '@fixture-automation/shared';
import type { PathToken } from '@fixture-automation/shared';

import type { MissingFile } from '../../contract/common/studio-api.type.ts';

const isSpecSchemas = (schemas: Record<string, unknown>): schemas is SpecSchemas => {
  const values = Object.values(schemas);

  return values.every(isSchema);
};

/** The child the projection names directly: an object key enters `properties`, an array index enters `items`. */
const directChild = (schema: SpecSchema, token: PathToken): unknown => {
  if (typeof token === 'number') return schema.items;

  const properties = schema.properties;

  if (!isRecord(properties)) return undefined;

  return properties[token];
};

/** `schema` with `$ref` and `allOf` resolved, or `undefined` when its references are unresolved or circular. */
const resolvedSchema = (schema: SpecSchema, schemas: SpecSchemas): SpecSchema | undefined => {
  try {
    return resolveSchema(schema, schemas);
  } catch {
    return undefined;
  }
};

/** A `$ref` is visited by its target, so twin references to one component count once; anything else by identity. */
const visitKey = (schema: SpecSchema): unknown => {
  const reference = schema.$ref;

  if (typeof reference === 'string') return reference;

  return schema;
};

/**
 * One step down the missing projection. A path listed whole at another index collapses into the same node as a
 * spec schema, so its `$ref`, `allOf` and `anyOf`/`oneOf` members are entered too. `seen` holds each visited schema
 * before it is resolved (`resolveSchema` returns a fresh object for `allOf`), so cyclic or fanned-out members stay linear.
 */
function childSchema(schema: unknown, token: PathToken, schemas: SpecSchemas, seen = new Set<unknown>()): unknown {
  if (!isSchema(schema)) return undefined;

  const key = visitKey(schema);
  const isSeen = seen.has(key);

  if (isSeen) return undefined;

  seen.add(key);

  const resolved = resolvedSchema(schema, schemas);

  if (resolved === undefined) return undefined;

  const child = directChild(resolved, token);

  if (child !== undefined) return child;

  const anyOf = resolved.anyOf ?? [];
  const oneOf = resolved.oneOf ?? [];

  for (const branch of [...anyOf, ...oneOf]) {
    const branchChild = childSchema(branch, token, schemas, seen);

    if (branchChild !== undefined) return branchChild;
  }

  return undefined;
}

const missingEntry = (missing: MissingFile, schemas: SpecSchemas, path: string): MissingEntry => {
  let schema: unknown = missing.schema;

  for (const token of parsePath(path)) schema = childSchema(schema, token, schemas);

  if (!isSchema(schema)) throw new FixtureError(`missing path "${path}" has no schema`, 'run the diff again for this fixture');

  const entry: MissingEntry = { path, schema };

  return entry;
};

const assertListed = (missing: MissingFile, paths: string[]): void => {
  const listed = new Set(missing.paths);

  for (const path of paths) {
    const isListed = listed.has(path);

    if (isListed) continue;

    const fix = schemaSuggestion(missing.paths, path);

    throw new FixtureError(`"${path}" is not a missing path`, fix);
  }
};

const componentSchemas = (missing: MissingFile): SpecSchemas => {
  const schemas = missing.components.schemas;

  if (!isSpecSchemas(schemas)) {
    throw new FixtureError('missing.components.schemas holds a non-object schema', 'run the diff again for this fixture');
  }

  return schemas;
};

/**
 * The part of `missing` covering only `paths`, in `missing.paths` order: the projection is rebuilt from those
 * paths' leaf schemas and `components` keeps only the schemas that projection reaches.
 */
export const missingChunk = (missing: MissingFile, paths: string[]): MissingFile => {
  assertListed(missing, paths);

  const allSchemas = componentSchemas(missing);
  const wanted = new Set(paths);
  const selected = missing.paths.filter((path: string): boolean => wanted.has(path));
  const entries = selected.map((path: string): MissingEntry => missingEntry(missing, allSchemas, path));
  const schema = missingProjection(entries);
  const schemas = reachableSchemas(schema, allSchemas);
  const components = { schemas };
  const chunk: MissingFile = { ...missing, paths: selected, schema, components };

  return chunk;
};
