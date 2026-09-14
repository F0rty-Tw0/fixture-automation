import type { InputSpec } from '@fixture-automation/openapi-fixtures';

export const CORRUPT_USAGE = 'usage: corrupt <fixture.json> <out.json> --drop <path,path,...>';

export const DIFF_USAGE = 'usage: diff <spec-url> [schema-name] --fixture <corrupt.json> --out-dir <dir> [--required-only]';

export const FIXTURE_DIFF_USAGE =
  'usage: corrupt <fixture.json> <out.json> --drop <paths>, or diff <spec-url> [schema-name] --fixture <corrupt.json> --out-dir <dir>';

export const FIXTURE_DIFF_HELP = `usage: openapi-fixture-diff <command> [options]

  corrupt <fixture.json> <out.json> --drop <path,path,...>
      copy the fixture with the listed paths removed

  diff <spec-url> [schema-name] --fixture <corrupt.json> --out-dir <dir>
      compare the corrupt fixture to the schema and write missing.json,
      missing.d.ts and missing.stub.ts into the directory; the schema name
      defaults to the x-root-schema of a spec written by openapi-types

  --drop <paths>       comma separated fixture paths, e.g. id,customer.email,lines[1].sku
  --fixture <file>     corrupt JSON fixture, required by diff
  --out-dir <dir>      destination directory for the missing files, required by diff
  --required-only      report only the missing required fields
  -h, --help           print this help`;

const command: InputSpec = { label: 'command', description: 'corrupt or diff', example: 'diff' };
const fixtureFile: InputSpec = { label: 'fixture.json', description: 'existing JSON fixture to corrupt', example: 'invoice.fixture.json' };
const outFile: InputSpec = { label: 'out.json', description: 'destination for the corrupted copy', example: 'invoice.corrupt.json' };
const drop: InputSpec = {
  label: '--drop',
  description: 'comma separated fixture paths to delete',
  example: 'id,customer.email,lines[1].sku'
};
const specUrl: InputSpec = {
  label: 'spec-url',
  description: 'http(s):// or file:// URL of the JSON spec',
  example: 'file:///E:/specs/invoice.spec.json'
};
const schemaName: InputSpec = {
  label: 'schema-name',
  description: 'a key under components.schemas; defaults to the x-root-schema of a spec written by openapi-types',
  example: 'invoice'
};
const fixture: InputSpec = { label: '--fixture', description: 'corrupt JSON fixture to compare against the schema', example: 'invoice.corrupt.json' };
const outDir: InputSpec = {
  label: '--out-dir',
  description: 'destination directory for missing.json, missing.d.ts, missing.stub.ts',
  example: 'tmp/missing'
};
const requiredOnly: InputSpec = {
  label: '--required-only',
  description: 'report only fields the schema lists as required',
  example: '--required-only'
};

/** What each prompt says when a terminal run is missing the input. */
export const DIFF_INPUTS = { command, fixtureFile, outFile, drop, specUrl, schemaName, fixture, outDir, requiredOnly };
