import type { InputSpec } from './input.type.ts';

export const FIXTURES_USAGE = 'usage: <spec-url> [schema-name] [out-file] [--ts <types-file>] [--required-only]';

const specUrl: InputSpec = {
  label: 'spec-url',
  description: 'http(s):// or file:// URL of the JSON spec',
  example: 'file:///E:/specs/invoice.spec.json'
};
const schemaName: InputSpec = {
  label: 'schema-name',
  description: 'a key under components.schemas; asked because this spec carries no x-root-schema to default to',
  example: 'invoice'
};
const outFile: InputSpec = {
  label: 'out-file',
  description: 'destination file; omitted means stdout',
  example: 'invoice.fixture.json'
};
const ts: InputSpec = {
  label: '--ts',
  description: 'write a typed .ts stub importing from the generated types',
  example: 'invoice.d.ts'
};
const requiredOnly: InputSpec = {
  label: '--required-only',
  description: 'sample only the required properties',
  example: '--required-only'
};

/** What each prompt says when a terminal run is missing the input. */
export const FIXTURES_INPUTS = { specUrl, schemaName, outFile, ts, requiredOnly };

export const FIXTURES_HELP = `usage: openapi-fixtures <spec-url> [schema-name] [out-file] [options]

Sample a deterministic JSON fixture from a schema in an OpenAPI document.

  <spec-url>           http(s):// or file:// URL of the JSON spec (required)
  [schema-name]        a key under components.schemas; defaults to the x-root-schema
                       of a spec written by openapi-types <spec-url> <schema-name> <out-file>
  [out-file]           destination file; omitted means stdout
  --ts <types-file>    write a typed .ts stub importing from the generated types
  --required-only      sample only the required properties
  -h, --help           print this help

With two positionals, the second is the schema name when the spec declares it, else the out-file.`;
