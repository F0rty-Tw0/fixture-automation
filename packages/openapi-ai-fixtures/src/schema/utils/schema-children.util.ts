import { isSchemaRecord } from './schema-record.util.ts';

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
const ARRAY_KEYS = ['allOf', 'anyOf', 'oneOf', 'prefixItems'];
const MAP_KEYS = ['$defs', 'definitions', 'dependentSchemas', 'patternProperties', 'properties'];

function* schemaCollections(schema: Record<string, unknown>): Generator<unknown> {
  for (const key of MAP_KEYS) {
    const values = schema[key];
    const isRecord = isSchemaRecord(values);

    if (isRecord) yield* Object.values(values);
  }

  const dependencies = schema['dependencies'];
  const isDependenciesRecord = isSchemaRecord(dependencies);

  if (!isDependenciesRecord) return;

  for (const dependency of Object.values(dependencies)) {
    const isPropertyDependency = Array.isArray(dependency);

    if (!isPropertyDependency) yield dependency;
  }
}

export function* schemaChildren(schema: Record<string, unknown>): Generator<unknown> {
  for (const key of SINGULAR_KEYS) {
    const child = schema[key];
    const isBooleanAdditionalProperties = key === 'additionalProperties' && typeof child === 'boolean';

    if (child !== undefined && !isBooleanAdditionalProperties) yield child;
  }

  const items = schema['items'];
  const hasTupleItems = Array.isArray(items);

  if (hasTupleItems) yield* items;
  else if (items !== undefined) yield items;

  for (const key of ARRAY_KEYS) {
    const values = schema[key];
    const isArray = Array.isArray(values);

    if (isArray) yield* values;
  }

  yield* schemaCollections(schema);
}
