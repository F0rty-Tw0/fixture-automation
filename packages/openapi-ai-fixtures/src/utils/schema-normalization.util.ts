import { isSchemaRecord } from './schema-record.util.ts';
import { SCHEMA_IDENTIFIER } from '../common/schema-identifier.const.ts';
import type { SchemaDialect } from '../common/schema.type.ts';

type SchemaNormalizer = (schema: unknown, dialect: SchemaDialect) => unknown;

const ARRAY_KEYS = ['allOf', 'anyOf', 'oneOf', 'prefixItems'];
const MAP_KEYS = ['$defs', 'definitions', 'dependentSchemas', 'patternProperties', 'properties'];
const SINGULAR_KEYS = [
  'additionalItems',
  'additionalProperties',
  'contains',
  'contentSchema',
  'else',
  'if',
  'not',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties'
];

const normalizedMap = (
  values: Record<string, unknown>,
  dialect: SchemaDialect,
  normalize: SchemaNormalizer
): Record<string, unknown> => {
  const entries = Object.entries(values).map(([key, value]): [string, unknown] => {
    const normalizedValue = normalize(value, dialect);

    return [key, normalizedValue];
  });
  const normalized = Object.fromEntries(entries);

  return normalized;
};

const normalizedValue = (key: string, value: unknown, dialect: SchemaDialect, normalize: SchemaNormalizer): unknown => {
  const isSingular = SINGULAR_KEYS.includes(key);

  if (isSingular) return normalize(value, dialect);

  if (key === 'items') {
    if (Array.isArray(value)) return value.map((item) => normalize(item, dialect));

    return normalize(value, dialect);
  }

  const isArray = ARRAY_KEYS.includes(key);

  if (isArray && Array.isArray(value)) return value.map((item) => normalize(item, dialect));

  const isMap = MAP_KEYS.includes(key);

  if (isMap && isSchemaRecord(value)) return normalizedMap(value, dialect, normalize);

  if (key !== 'dependencies') return value;

  if (!isSchemaRecord(value)) return value;

  const entries = Object.entries(value).map(([dependency, schema]): [string, unknown] => {
    const isPropertyDependency = Array.isArray(schema);

    if (isPropertyDependency) return [dependency, schema];

    const normalizedSchema = normalize(schema, dialect);

    return [dependency, normalizedSchema];
  });
  const normalized = Object.fromEntries(entries);

  return normalized;
};

const normalizeNullable = (schema: Record<string, unknown>): Record<string, unknown> => {
  const hasNullable = Object.hasOwn(schema, 'nullable');

  if (!hasNullable) return schema;

  const entries = Object.entries(schema).filter(([key]) => key !== 'nullable');
  const normalized = Object.fromEntries(entries);
  const nullable = schema['nullable'];
  const type = schema['type'];
  const addsNullType = nullable === true && typeof type === 'string';

  if (addsNullType) normalized['type'] = [type, 'null'];

  return normalized;
};

export function normalizeSchema(schema: unknown, dialect: SchemaDialect): unknown {
  if (!isSchemaRecord(schema)) return schema;

  const reference = schema['$ref'];
  const ignoresSiblings = dialect !== 'openapi-31' && typeof reference === 'string';

  if (ignoresSiblings) {
    const normalizedReference = { $ref: reference };

    return normalizedReference;
  }

  const entries = Object.entries(schema).map(([key, value]): [string, unknown] => {
    const valueAfterNormalization = normalizedValue(key, value, dialect, normalizeSchema);

    return [key, valueAfterNormalization];
  });
  const normalized = Object.fromEntries(entries);

  if (dialect === 'openapi-30') return normalizeNullable(normalized);

  const usesOpenApiBaseDialect =
    dialect === 'openapi-31' && normalized['$schema'] === 'https://spec.openapis.org/oas/3.1/dialect/base';

  if (usesOpenApiBaseDialect) normalized['$schema'] = SCHEMA_IDENTIFIER['openapi-31'];

  return normalized;
}
