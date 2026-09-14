# @fixture-automation/openapi-fixture-diff

Corrupt a fixture, then diff it against its OpenAPI schema to describe exactly what is missing.

## What it does

- **Corrupts** a fixture by deleting named paths (`corrupt`).
- **Diffs** a corrupt fixture against its schema and lists every absent path (`diff`).
- **Writes** `missing.json`, `missing.d.ts`, and `missing.stub.ts` for the next pipeline step ([merge](../openapi-fixture-merge/README.md), or [AI fill](../openapi-ai-fixtures/README.md#examples)).

## Quick start

```bash
SPEC=$(node -p "require('node:url').pathToFileURL('packages/openapi-fixture-diff/src/test/fixtures/nested/spec.json').href")

node packages/openapi-fixtures/dist/cli.js "$SPEC" order --required-only order.json
node packages/openapi-fixture-diff/dist/cli.js corrupt order.json corrupt.json --drop customer.email,lines[0].sku
node packages/openapi-fixture-diff/dist/cli.js diff "$SPEC" order --fixture corrupt.json --out-dir out --required-only
```

`out/missing.json` (`paths`, trimmed):

```text
{
  "paths": ["customer.email", "lines[0].sku"]
}
```

`out/missing.d.ts` (trimmed to the schema shape):

```text
export interface components {
    schemas: {
        missing: {
            customer: {
                email: string;
            };
            lines: {
                sku: string;
            }[];
        };
    };
    …
}

export type Missing = components['schemas']['missing'];
```

## Command

```
usage: openapi-fixture-diff <command> [options]

  corrupt <fixture.json> <out.json> --drop <path,path,...>
      copy the fixture with the listed paths removed

  diff <spec-url> [schema-name] --fixture <corrupt.json> --out-dir <dir>
      compare the corrupt fixture to the schema and write missing.json,
      missing.d.ts and missing.stub.ts into the directory; the schema name
      defaults to the x-root-schema of a spec written by openapi-types
```

`schema-name` is optional with a spec written by `openapi-types <spec-url> <schema-name> <out-file>`: that file carries `x-root-schema`, so `diff "$LOCAL" --fixture corrupt.json --out-dir out` reads the name from it. A plain spec still needs the name (`schema name required` otherwise).

| Flag               | Required           | What it does                                                                                                                              |
| ------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `--drop <paths>`   | Yes, for `corrupt` | Comma separated fixture paths to delete, e.g. `id,customer.email,lines[1].sku`.                                                           |
| `--fixture <file>` | Yes, for `diff`    | Corrupt JSON fixture to compare against the schema.                                                                                       |
| `--out-dir <dir>`  | Yes, for `diff`    | Destination directory for `missing.json`, `missing.d.ts`, `missing.stub.ts`.                                                              |
| `--required-only`  | No                 | Report only fields the schema lists in `required` (schema marks these mandatory). Without it, every optional missing property counts too. |
| `-h, --help`       | No                 | Print this usage and exit 0.                                                                                                              |

## Examples

**Diff without `--required-only`** — same `corrupt.json`, now every optional gap counts too:

```bash
node packages/openapi-fixture-diff/dist/cli.js diff "$SPEC" order --fixture corrupt.json --out-dir out-full
node -p "require('./out-full/missing.json').paths"
```

```
[ 'note', 'customer.country', 'customer.email', 'customer.vat', 'lines[0].sku', 'parent' ]
```

Four extra paths appear: `note`, `customer.country`, `customer.vat`, and `parent` were never in the
`--required-only` sample to begin with, so a full diff reports them as missing too.

**Nothing missing** — diff a fixture that already has every field:

```bash
node packages/openapi-fixtures/dist/cli.js "$SPEC" order order-full.json
node packages/openapi-fixture-diff/dist/cli.js diff "$SPEC" order --fixture order-full.json --out-dir out-none --required-only
```

```
no missing fields
```

Exit code `0`. No files are written.

## Errors

| You see                                                                           | It means                                                                 | Fix                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| `usage: corrupt <fixture.json> <out.json> --drop <paths>, or diff <spec-url> ...` | Command was not `corrupt` or `diff`.                                     | Use one of those two subcommands.                         |
| `--fixture file "<path>" does not exist`                                          | The `--fixture` path is wrong.                                           | Check the path; it resolves from the current directory.   |
| `--fixture file "<path>" is not valid JSON: <parse error>`                        | The fixture file is not parseable JSON.                                  | Fix the file, or point at a real JSON fixture.            |
| `--out-dir requires a destination directory`                                      | `diff` was run without `--out-dir`.                                      | Add `--out-dir <dir>`.                                    |
| `schema "<name>" is unavailable`                                                  | `<name>` is not a key under `components.schemas`.                        | The message lists the available schema names; pick one.   |
| `unknown fixture path "<path>"` + `fix: did you mean <key>?`                      | `--drop` named a key that is not in the fixture, but a close key exists. | Use the suggested key.                                    |
| `unknown fixture path "<path>"` + `fix: available: <keys>`                        | `--drop` named a key that is not on that object.                         | Pick one of the listed keys.                              |
| `unknown fixture path "<path>"` (no fix line)                                     | `--drop` named an array index that is out of range, or a non-object.     | Check the fixture's real shape.                           |
| `--drop requires a comma separated list of fixture paths`                         | `--drop` was missing, or had an empty segment (`a,,b`).                  | Pass paths like `--drop id,customer.email,lines[1].sku`.  |
| `Unknown option '<flag>'`                                                         | An unsupported flag was passed.                                          | Run `openapi-fixture-diff --help` for the full flag list. |
| Any other error                                                                   | See the shared error format and exit codes.                              | [Root README](../../README.md#rules-every-tool-shares).   |

## Library

```json
{
  "devDependencies": {
    "@fixture-automation/openapi-fixture-diff": "workspace:*"
  }
}
```

```ts
import { diffFixture, writeMissingFiles } from '@fixture-automation/openapi-fixture-diff';

const diff = diffFixture({ spec, schemaName: 'order', fixture: corrupt, requiredOnly: true });
const files = await writeMissingFiles(diff, 'out');
```

- `diffFixture(request: FixtureDiffRequest): FixtureDiff` — compares `request.fixture` against `request.schemaName` in `request.spec` and returns `{ schemaName, dialect, paths, schema, components }`.
- `writeMissingFiles(diff: FixtureDiff, outDir: string): Promise<MissingFiles>` — writes `missing.json`, `missing.d.ts`, `missing.stub.ts` into `outDir` and returns their paths.
- `dropPaths(fixture: unknown, paths: string[]): unknown` — deep-copies `fixture` with the listed paths removed. Throws (and never mutates the input) on an unknown path.
- Types: `FixtureDiff`, `FixtureDiffRequest`, `MissingEntry`, `MissingFiles`, `WalkInput`, `SchemaComponents`, `SpecSchema`, `SpecSchemas`.

## Gotchas

- **Components list only reachable schemas.** `missing.json`'s `components.schemas` walks the `$ref` closure of the missing projection only; a projection referencing nothing yields `{}`.
- **Schema cycles are never missing.** A property whose `$ref` is already being expanded up the path (e.g. `api_errors` → `payment_intent` → `api_errors`) is skipped, matching where `openapi-fixtures` stops sampling. An empty object `{}` anywhere else still means "all properties missing".
- **Arrays diff per index.** The `missing.json` schema collapses array items into one `items` shape, but `paths` keeps the exact indices (`lines[0].sku`).
- **`anyOf`/`oneOf` branch choice is a heuristic.** Each branch resolves first; the branch whose properties overlap the value's keys most wins. Primitives and `null` never report missing fields.
- **Large hub schemas can blow the 1 MiB AI input limit.** A schema reachable through a hub object (like Stripe's `account`) pulls its whole graph into `components`. Drop leaf fields only, or split hub-reaching fields across multiple `diff` runs, to keep the projection small.
- **`additionalProperties` and `patternProperties` are ignored.**

## Develop

```bash
pnpm exec nx run @fixture-automation/openapi-fixture-diff:test
pnpm exec nx run @fixture-automation/openapi-fixture-diff:build
pnpm run lint
```

- `src/data-access/fixture-diff.client.ts` owns the diff algorithm.
- `src/data-access/missing-files.client.ts` owns writing the three output files.
- `src/utils/drop-path.util.ts` owns path parsing and corruption.
- `src/common/` owns the public types.
- `src/index.ts` is the public entry point; `src/cli.ts` is the CLI.
