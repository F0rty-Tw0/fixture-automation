import type { AnySchema } from 'ajv';

import { schemaChildren } from './schema-children.util.ts';
import { normalizeSchema } from './schema-normalization.util.ts';
import { isSchemaRecord } from './schema-record.util.ts';
import { SCHEMA_IDENTIFIER } from '../common/schema-identifier.const.ts';
import { SCHEMA_KEYWORDS } from '../common/schema-keywords.const.ts';
import type { SchemaDialect } from '../common/schema.type.ts';

const pointerName = (name: string): string => {
  const escaped = name.replaceAll('~', '~0').replaceAll('/', '~1');

  return `#/components/schemas/${encodeURIComponent(escaped)}`;
};

function* schemaNodes(schema: unknown, dialect: SchemaDialect): Generator<Record<string, unknown>> {
  if (!isSchemaRecord(schema)) {
    const isBooleanSchema = typeof schema === 'boolean';

    if (dialect === 'openapi-30' && isBooleanSchema) throw new Error('OpenAPI 3.0 schema positions require Schema Objects');

    return;
  }

  const reference = schema['$ref'];
  const ignoresReferenceSiblings = dialect !== 'openapi-31' && typeof reference === 'string';

  if (ignoresReferenceSiblings) {
    const normalizedReference = { $ref: reference };

    yield normalizedReference;

    return;
  }

  yield schema;

  for (const child of schemaChildren(schema)) {
    yield* schemaNodes(child, dialect);
  }
}

const dialectName = (dialect: SchemaDialect): string => {
  if (dialect === 'draft-07') return 'JSON Schema draft-07';

  if (dialect === 'openapi-30') return 'OpenAPI 3.0';

  return 'OpenAPI 3.1';
};

const assertStringFormat = (schema: Record<string, unknown>): void => {
  const format = schema['format'];

  if (format === undefined) return;

  if (typeof format !== 'string') throw new Error('schema format must be a string');
};

const assertOpenApi30Values = (schema: Record<string, unknown>): void => {
  const type = schema['type'];
  const nullable = schema['nullable'];
  const hasArrayType = Array.isArray(type);

  if (hasArrayType) throw new Error('OpenAPI 3.0 schema type must be a string');

  if (type === 'null') throw new Error('OpenAPI 3.0 uses nullable rather than a null type');

  if (nullable !== undefined && typeof nullable !== 'boolean') throw new Error('OpenAPI 3.0 nullable must be a boolean');

  if (type !== 'array') return;

  const items = schema['items'];
  const hasSchemaItems = isSchemaRecord(items);

  if (!hasSchemaItems) throw new Error('OpenAPI 3.0 array schemas require an items object');
};

const assertResourceDialect = (schema: Record<string, unknown>, dialect: SchemaDialect): void => {
  const declaredDialect = schema['$schema'];

  if (declaredDialect === undefined) return;

  if (typeof declaredDialect !== 'string') throw new Error('schema $schema dialect must be a string');

  const expectedDialect = SCHEMA_IDENTIFIER[dialect];
  const isOpenApiBaseDialect = dialect === 'openapi-31' && declaredDialect === 'https://spec.openapis.org/oas/3.1/dialect/base';
  const isExpectedDialect = declaredDialect === expectedDialect || isOpenApiBaseDialect;

  if (!isExpectedDialect) throw new Error(`unsupported schema resource dialect "${declaredDialect}"`);
};

const assertSchema = (schema: Record<string, unknown>, dialect: SchemaDialect): void => {
  const keywords = SCHEMA_KEYWORDS[dialect];
  const hasNullable = Object.hasOwn(schema, 'nullable');

  if (dialect === 'openapi-31' && hasNullable) throw new Error('OpenAPI 3.1 does not support nullable; use a null type instead');

  for (const keyword of Object.keys(schema)) {
    const isExtension = keyword.startsWith('x-');
    const isKnownKeyword = keywords.includes(keyword);
    const isSupported = isKnownKeyword || isExtension;

    if (!isSupported) throw new Error(`${dialectName(dialect)} does not support "${keyword}"`);
  }

  assertResourceDialect(schema, dialect);

  if (dialect === 'openapi-30') assertOpenApi30Values(schema);

  assertStringFormat(schema);
};

const normalizedSchemas = (schemas: Record<string, unknown>, dialect: SchemaDialect): Record<string, unknown> => {
  const entries = Object.entries(schemas).map(([name, schema]): [string, unknown] => {
    const normalized = normalizeSchema(schema, dialect);

    return [name, normalized];
  });
  const prepared = Object.fromEntries(entries);

  return prepared;
};

export const schemaDocument = (schemas: Record<string, unknown>, name: string, dialect: SchemaDialect): AnySchema => {
  for (const schema of Object.values(schemas)) {
    for (const node of schemaNodes(schema, dialect)) assertSchema(node, dialect);
  }

  const normalized = normalizedSchemas(schemas, dialect);
  const components = { schemas: normalized };
  const reference = pointerName(name);
  const identifier = SCHEMA_IDENTIFIER[dialect];
  const document: AnySchema = { $schema: identifier, $ref: reference, components };

  return document;
};
