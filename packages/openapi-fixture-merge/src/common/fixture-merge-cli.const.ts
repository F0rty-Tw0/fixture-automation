import type { InputSpec } from '@fixture-automation/openapi-fixtures';

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
const outFile: InputSpec = {
  label: 'out.json',
  description: 'destination for the merged fixture',
  example: 'invoice.merged.json'
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
export const MERGE_INPUTS = { corruptFile, populatedFile, outFile, spec, schema };
