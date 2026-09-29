import type { SchemaDialect } from './schema.type.ts';

export const SCHEMA_IDENTIFIER: Record<SchemaDialect, string> = {
  'draft-07': 'http://json-schema.org/draft-07/schema#',
  'openapi-30': 'http://json-schema.org/draft-04/schema#',
  'openapi-31': 'https://json-schema.org/draft/2020-12/schema'
};
