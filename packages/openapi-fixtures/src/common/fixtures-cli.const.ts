export const FIXTURES_USAGE = 'usage: <spec-url> [schema-name] [out-file] [--ts <types-file>] [--required-only]';

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
