import { isSchemaRecord } from './schema-record.util.ts';
import type { MissingFile } from '../common/missing.type.ts';
import type { SchemaDialect } from '../common/schema.type.ts';

const isDialect = (value: unknown): value is SchemaDialect => {
  const dialects: string[] = ['draft-07', 'openapi-30', 'openapi-31'];
  const isKnown = typeof value === 'string' && dialects.includes(value);

  return isKnown;
};

const isStringList = (value: unknown): value is string[] => {
  if (!Array.isArray(value)) return false;

  const isTextOnly = value.every((entry: unknown): boolean => typeof entry === 'string');

  return isTextOnly;
};

/** Parse and validate a `missing.json` produced by `openapi-fixture-diff diff`. */
export const parseMissingFile = (text: string): MissingFile => {
  const parsed: unknown = JSON.parse(text);

  if (!isSchemaRecord(parsed)) throw new Error('missing.json must contain a JSON object');

  const schemaName = parsed['schemaName'];
  const dialect = parsed['dialect'];
  const paths = parsed['paths'];
  const schema = parsed['schema'];
  const components = parsed['components'];
  const hasName = typeof schemaName === 'string' && schemaName.length > 0;

  if (!hasName) throw new Error('missing.json requires a non-empty "schemaName"');

  if (!isDialect(dialect)) throw new Error('missing.json requires a "dialect" of draft-07, openapi-30, or openapi-31');

  if (!isStringList(paths)) throw new Error('missing.json requires a "paths" array of strings');

  if (!isSchemaRecord(schema)) throw new Error('missing.json requires an object "schema" projection');

  if (!isSchemaRecord(components)) throw new Error('missing.json requires a "components" object');

  const schemas = components['schemas'];

  if (!isSchemaRecord(schemas)) throw new Error('missing.json requires a "components.schemas" object');

  const missingComponents = { schemas };
  const file: MissingFile = { schemaName, dialect, paths, schema, components: missingComponents };

  return file;
};
