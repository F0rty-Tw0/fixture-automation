import { normalizeSchema } from '@fixture-automation/openapi-ai-fixtures';
import { isRecord } from '@fixture-automation/shared';

import { closedProjection } from './closed-projection.util.ts';
import type { MissingFile } from '../contract/common/studio-api.type.ts';

const JSON_SCHEMA_2020 = 'https://json-schema.org/draft/2020-12/schema';
const COMPONENT_POINTER = '#/components/schemas/';
const DEFS_POINTER = '#/$defs/';
/** OpenAPI-only or annotation-only keywords; `nullable` is already folded into `type` by `normalizeSchema`. */
const DROPPED_KEYWORDS = ['$schema', 'discriminator', 'example', 'examples', 'externalDocs', 'nullable', 'readOnly', 'writeOnly', 'xml'];
/**
 * The string formats Chrome 153's `responseConstraint` accepts (probed live); any other `format` on a string makes the
 * whole prompt fail with `NotSupportedError`, and on other types it is ignored, so every other value is dropped.
 */
const CHROME_FORMATS = ['date', 'date-time', 'duration', 'email', 'hostname', 'ipv4', 'ipv6', 'time', 'uri', 'uuid'];
const SCHEMA_MAP_KEYWORDS = ['$defs', 'definitions', 'dependencies', 'dependentSchemas', 'patternProperties', 'properties'];
const SCHEMA_KEYWORDS = [
  'additionalItems',
  'additionalProperties',
  'allOf',
  'anyOf',
  'contains',
  'contentSchema',
  'else',
  'if',
  'items',
  'not',
  'oneOf',
  'prefixItems',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties'
];
const EXCLUSIVE_BOUNDS: [string, string][] = [
  ['exclusiveMinimum', 'minimum'],
  ['exclusiveMaximum', 'maximum']
];

type SchemaTransform = (schema: unknown) => unknown;

const isDroppedKeyword = (key: string): boolean => DROPPED_KEYWORDS.includes(key) || key.startsWith('x-');

const isRefusedFormat = (key: string, value: unknown): boolean => key === 'format' && !CHROME_FORMATS.includes(String(value));

const withoutKey = (schema: Record<string, unknown>, key: string): Record<string, unknown> => {
  const entries = Object.entries(schema).filter(([entryKey]): boolean => entryKey !== key);

  return Object.fromEntries(entries);
};

const mappedSchemas = (schemas: Record<string, unknown>, transform: SchemaTransform): Record<string, unknown> => {
  const entries = Object.entries(schemas).map(([name, schema]): [string, unknown] => [name, transform(schema)]);

  return Object.fromEntries(entries);
};

const referenceValue = (key: string, value: unknown): unknown => {
  if (key !== '$ref' || typeof value !== 'string') return value;

  const isComponentReference = value.startsWith(COMPONENT_POINTER);

  if (!isComponentReference) return value;

  const name = value.slice(COMPONENT_POINTER.length);

  return `${DEFS_POINTER}${name}`;
};

/** Draft-04 boolean `exclusiveMinimum: true` + `minimum: n` becomes the numeric `exclusiveMinimum: n`; `false` is dropped. */
const numericBound = (schema: Record<string, unknown>, exclusiveKey: string, limitKey: string): Record<string, unknown> => {
  const flag = schema[exclusiveKey];

  if (typeof flag !== 'boolean') return schema;

  const withoutFlag = withoutKey(schema, exclusiveKey);
  const limit = schema[limitKey];
  const isExclusiveLimit = flag && typeof limit === 'number';

  if (!isExclusiveLimit) return withoutFlag;

  const withoutLimit = withoutKey(withoutFlag, limitKey);
  const bounded = { ...withoutLimit, [exclusiveKey]: limit };

  return bounded;
};

function constraintSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(constraintSchema);

  if (!isRecord(schema)) return schema;

  let constrained: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    const isMapKeyword = SCHEMA_MAP_KEYWORDS.includes(key);
    const isNestedSchema = SCHEMA_KEYWORDS.includes(key);
    const isAnnotation = isDroppedKeyword(key);
    const isRefused = isRefusedFormat(key, value);
    const isDropped = isAnnotation || isRefused;

    if (isDropped) continue;

    if (isMapKeyword && isRecord(value)) constrained[key] = mappedSchemas(value, constraintSchema);
    else if (isNestedSchema) constrained[key] = constraintSchema(value);
    else constrained[key] = referenceValue(key, value);
  }

  for (const [exclusiveKey, limitKey] of EXCLUSIVE_BOUNDS) constrained = numericBound(constrained, exclusiveKey, limitKey);

  return constrained;
}

/**
 * The missing projection as one self-contained JSON Schema 2020-12 document for the Prompt API's `responseConstraint`.
 * It reuses `normalizeSchema` (OpenAPI 3.0 `nullable` → `type: [t, 'null']`), drops OpenAPI and annotation keywords
 * and every `format` Chrome refuses, turns draft-04 boolean exclusive bounds numeric, bundles the components under `$defs` and points every
 * `#/components/schemas/<name>` reference at `#/$defs/<name>`. Objects on the missing paths accept only the missing keys.
 */
export const responseSchema = (missing: MissingFile): Record<string, unknown> => {
  const normalize = (schema: unknown): unknown => constraintSchema(normalizeSchema(schema, missing.dialect));
  const closed = closedProjection(missing.schema, missing.paths);
  const root = normalize(closed);
  const defs = mappedSchemas(missing.components.schemas, normalize);

  if (!isRecord(root)) {
    const defsOnly = { $schema: JSON_SCHEMA_2020, $defs: defs };

    return defsOnly;
  }

  const schema = { $schema: JSON_SCHEMA_2020, ...root, $defs: defs };

  return schema;
};
