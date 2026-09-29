import type { InputSpec } from '@fixture-automation/openapi-fixtures';

export const OPENAPI_TYPES_USAGE = 'usage: <spec-url> [schema-name] [out-file]';

const specUrl: InputSpec = {
  label: 'spec-url',
  description: 'http(s):// or file:// URL of the spec, JSON or YAML',
  example: 'file:///E:/specs/invoice.yaml'
};
const schemaName: InputSpec = {
  label: 'schema-name',
  description: 'a key under components.schemas; prunes the JSON spec to that schema and what it references',
  example: 'invoice'
};
const outFile: InputSpec = {
  label: 'out-file',
  description: 'destination file; omitted means stdout',
  example: 'invoice.d.ts'
};

/** What each prompt says when a terminal run is missing the input. */
export const TYPES_INPUTS = { specUrl, schemaName, outFile };

export const OPENAPI_TYPES_HELP = `usage: openapi-types <spec-url> [out-file]
       openapi-types <spec-url> <schema-name> <out-file>

Generate TypeScript declarations from an OpenAPI 3.x document.

  <spec-url>     http(s):// or file:// URL of the spec, JSON or YAML (required)
  [out-file]     destination file; omitted means stdout
  <schema-name>  a key under components.schemas; prunes the JSON spec to that schema
                 and what it references, writes <out-file>.d.ts plus <out-file>.spec.json
                 (the pruned spec, which later tools read to default the schema name)
  -h, --help     print this help`;
