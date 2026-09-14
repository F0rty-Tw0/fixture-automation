export const MERGE_USAGE = 'usage: <corrupt.json> <populated.json|populated.stub.ts> <out.json> [--spec <url> [--schema <name>]]';

export const MERGE_HELP = `usage: openapi-fixture-merge <corrupt.json> <populated.json|populated.stub.ts> <out.json> [options]

Fill the corrupt fixture from the populated file and write the merged JSON.

  <corrupt.json>       fixture with fields removed (required)
  <populated>          .json fixture, or a .ts/.mts/.js/.mjs module with a single export (required)
  <out.json>           destination for the merged fixture (required)
  --spec <url>         http(s):// or file:// URL of the spec used to validate the result
  --schema <name>      a key under components.schemas; defaults to the x-root-schema of a spec
                       written by openapi-types <spec-url> <schema-name> <out-file>; needs --spec
  -h, --help           print this help`;

export const MODULE_EXTENSIONS = ['.ts', '.mts', '.js', '.mjs'];
