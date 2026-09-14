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
