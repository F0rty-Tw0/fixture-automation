import { isRecord } from '@fixture-automation/shared';
import { sample } from 'openapi-sampler';

import { isSchema } from './schema-record.util.ts';
import { resolveSchema } from './schema-resolve.util.ts';
import type { ReplaceCandidate } from '../common/missing.type.ts';
import type { SpecSchema, SpecSchemas } from '../common/schema.type.ts';

type Primitive = string | number | boolean;

/** Keywords the sampler copies a value from; a value that came from one was written by the schema author. */
const AUTHOR_KEYWORDS = ['example', 'examples', 'const', 'enum', 'default'];
const SAMPLE_OPTIONS = { quiet: true };

const isPrimitive = (value: unknown): value is Primitive => {
  const type = typeof value;

  return type === 'string' || type === 'number' || type === 'boolean';
};

/** Follows the first oneOf/anyOf member, the only one the sampler enters. */
function hasAuthorValue(schema: SpecSchema, schemas: SpecSchemas): boolean {
  const resolved = resolveSchema(schema, schemas);
  const hasKeyword = AUTHOR_KEYWORDS.some((keyword: string): boolean => Object.hasOwn(resolved, keyword));

  if (hasKeyword) return true;

  const branches = resolved.oneOf ?? resolved.anyOf ?? [];
  const first = branches[0];

  if (!isSchema(first)) return false;

  return hasAuthorValue(first, schemas);
}

const sampled = (schema: SpecSchema, schemas: SpecSchemas): unknown => {
  const components = { schemas };
  const document = { components };

  return sample(schema, SAMPLE_OPTIONS, document);
};

/** Sampled under its own key: a uuid format is seeded by the property name. */
const sampledProperty = (key: string, schema: SpecSchema, schemas: SpecSchemas): unknown => {
  const properties = { [key]: schema };
  const holder: SpecSchema = { type: 'object', required: [key], properties };
  const value = sampled(holder, schemas);

  if (!isRecord(value)) return undefined;

  return value[key];
};

const hasPlaceholderElement = (schema: SpecSchema, value: unknown[], schemas: SpecSchemas): boolean => {
  const { items } = resolveSchema(schema, schemas);

  if (!isSchema(items)) return false;

  const isAuthored = hasAuthorValue(items, schemas);

  if (isAuthored) return false;

  const expected = sampled(items, schemas);
  const isDefault = (element: unknown): boolean => isPrimitive(element) && element === expected;

  return value.some(isDefault);
};

/**
 * Whether a present value is what openapi-sampler writes for its schema when the author gave no value:
 * `"string"`, `0`, `true`, `user@example.com`, a seeded uuid. An array counts when any primitive element is one.
 * `null` never counts; a valid null is a real answer.
 */
export const isPlaceholderValue = (candidate: ReplaceCandidate, schemas: SpecSchemas): boolean => {
  const { key, schema, value } = candidate;
  const isArray = Array.isArray(value);
  const isLeaf = isPrimitive(value);

  if (!isArray && !isLeaf) return false;

  const isAuthored = hasAuthorValue(schema, schemas);

  if (isAuthored) return false;

  if (Array.isArray(value)) return hasPlaceholderElement(schema, value, schemas);

  const expected = sampledProperty(key, schema, schemas);

  return expected === value;
};
