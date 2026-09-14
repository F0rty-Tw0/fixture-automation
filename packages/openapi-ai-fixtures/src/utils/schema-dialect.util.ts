import type { SchemaDialect } from '../common/schema.type.ts';

export const schemaDialect = (openapi: string | undefined, jsonSchemaDialect: string | undefined): SchemaDialect => {
  if (openapi === undefined) return 'draft-07';

  const isOpenApi30 = /^3\.0\.\d+$/.test(openapi);

  if (isOpenApi30) return 'openapi-30';

  const isOpenApi31 = /^3\.1\.\d+$/.test(openapi);

  if (!isOpenApi31) throw new Error(`unsupported OpenAPI version "${openapi}"`);

  const isSupportedDialect =
    jsonSchemaDialect === undefined ||
    jsonSchemaDialect === 'https://spec.openapis.org/oas/3.1/dialect/base' ||
    jsonSchemaDialect === 'https://json-schema.org/draft/2020-12/schema';

  if (!isSupportedDialect) throw new Error(`unsupported JSON Schema dialect "${jsonSchemaDialect}"`);

  return 'openapi-31';
};
