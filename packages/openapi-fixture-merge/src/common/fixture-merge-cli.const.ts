import type { InputSpec } from '@fixture-automation/openapi-fixtures';

export const MERGE_USAGE =
  'usage: <corrupt.json> <populated.json|populated.stub.ts> <out-dir> --endpoint-url <url> [--spec <url> [--schema <name>]]';

export const MERGE_HELP = `usage: openapi-fixture-merge <corrupt.json> <populated.json|populated.stub.ts> <out-dir> --endpoint-url <url> [options]

Fill the corrupt fixture and write endpoint-named JSON with SHA-256 provenance.

  <corrupt.json>       fixture with fields removed (required)
  <populated>          .json fixture, or a .ts/.mts/.js/.mjs module with a single export (required)
  <out-dir>           directory receiving the merged JSON and provenance sidecar (required)
  --endpoint-url <url> exact endpoint URL hashed with SHA-1 Base64; / becomes x (required)
  --spec <url>         http(s):// or file:// URL of the spec used to validate the result
  --schema <name>      a key under components.schemas; defaults to the x-root-schema of a spec
                       written by openapi-types <spec-url> <schema-name> <out-file>; needs --spec
  -h, --help           print this help

Files: <hash>.json and <hash>.provenance.json (hex SHA-256 of the merged file).`;

export const MODULE_EXTENSIONS = ['.ts', '.mts', '.js', '.mjs'];

const corruptFile: InputSpec = {
  label: 'corrupt.json',
  description: 'fixture with fields removed',
  example: 'invoice.corrupt.json'
};
const populatedFile: InputSpec = {
  label: 'populated',
  description: '.json fixture, or a .ts/.mts/.js/.mjs module with a single export',
  example: 'invoice.populated.json'
};
const outDir: InputSpec = {
  label: 'out-dir',
  description: 'directory receiving the merged JSON and its provenance sidecar',
  example: 'fixtures'
};
const endpointUrl: InputSpec = {
  label: '--endpoint-url',
  description: 'endpoint URL used to derive the deterministic merged JSON filename',
  example: 'https://api.example.com/v1/invoices/in_2'
};
const spec: InputSpec = {
  label: '--spec',
  description: 'http(s):// or file:// URL of the spec used to validate the result',
  example: 'file:///E:/specs/invoice.spec.json'
};
const schema: InputSpec = {
  label: '--schema',
  description: 'a key under components.schemas; defaults to the x-root-schema of a spec written by openapi-types',
  example: 'invoice'
};

/** What each prompt says when a terminal run is missing the input. */
export const MERGE_INPUTS = { corruptFile, populatedFile, outDir, endpointUrl, spec, schema };
