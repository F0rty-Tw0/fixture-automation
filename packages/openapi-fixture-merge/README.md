# @fixture-automation/openapi-fixture-merge

Fill a corrupt fixture from a populated file, optionally validate the result, and write endpoint-named JSON with a SHA-256 provenance sidecar.

This is the last step in the [corrupt → diff → fill → merge pipeline](../../README.md#full-pipeline-walkthrough).

## What it does

- **Fills** only the keys missing from the corrupt fixture; present keys are left untouched.
- **Reads** the populated data from JSON, or from a `.ts`/`.mts`/`.js`/`.mjs` module with one export (the AI package writes these).
- **Validates** the merged result against an OpenAPI schema when `--spec` is given (`--schema` names the schema, or a spec written by `openapi-types <spec-url> <schema-name> <out-file>` supplies it through `x-root-schema`).
- **Names** only merged outputs using SHA-1 Base64 of the endpoint identity, replacing every `/` with `x` and appending `.json`. An optional subdirectory prefixes its path before hashing.
- **Records** the effective endpoint identity and a lowercase hexadecimal SHA-256 checksum of the merged file in a sibling `.provenance.json`.

## Quick start

```bash
SPEC=$(node -p "require('node:url').pathToFileURL('packages/openapi-fixture-diff/src/test/fixtures/nested/spec.json').href")
ENDPOINT=https://api.example.com/orders/or_1

cat > corrupt.json <<'JSON'
{
  "id": "or_1",
  "created": 0,
  "customer": { "name": "string" },
  "lines": [ { "source": "string" } ]
}
JSON

cat > populated.json <<'JSON'
{
  "customer": { "email": "ada@example.com" },
  "lines": [ { "sku": "SKU-1" } ]
}
JSON

node packages/openapi-fixture-merge/dist/cli.js corrupt.json populated.json fixtures --endpoint-url "$ENDPOINT" --spec "$SPEC" --schema order
```

Stderr reports `filled 2 path(s)` and both output paths. The merged fixture is
`fixtures/XR2lRB+kbknhCCQzmKfkiOpfUVE=.json`:

```text
{
  "id": "or_1",
  "created": 0,
  "customer": {
    "name": "string",
    "email": "ada@example.com"
  },
  "lines": [
    {
      "source": "string",
      "sku": "SKU-1"
    }
  ]
}
```

## Command

```
usage: openapi-fixture-merge <corrupt.json> <populated.json|populated.stub.ts> <out-dir> --endpoint-url <url> [options]

  <corrupt.json>       fixture with fields removed (required)
  <populated>          .json fixture, or a .ts/.mts/.js/.mjs module with a single export (required)
  <out-dir>           directory receiving the merged JSON and provenance sidecar (required)
  --endpoint-url <url> endpoint identity: a URL or METHOD, path (required)
  --object-shape <key> literal top-level property to merge and validate; defaults to the fixture root
  --subdirectory <path> prefix inserted into the endpoint path before hashing
  --spec <url>         http(s):// or file:// URL of the spec used to validate the result
  --schema <name>      a key under components.schemas; defaults to the x-root-schema of a spec
                       written by openapi-types <spec-url> <schema-name> <out-file>; needs --spec
  -h, --help           print this help
```

| Flag                    | Required      | What it does                                                                                |
| ----------------------- | ------------- | ------------------------------------------------------------------------------------------- |
| `<corrupt.json>`        | Yes           | Fixture with fields removed, resolved from the current directory.                           |
| `<populated>`           | Yes           | `.json` file, or a `.ts`/`.mts`/`.js`/`.mjs` module exporting exactly one value.            |
| `<out-dir>`             | Yes           | Directory receiving the endpoint-named JSON and its provenance sidecar.                     |
| `--endpoint-url <url>`  | Yes           | Endpoint identity whose UTF-8 bytes determine the filename. Accepts URLs or `METHOD, path`. |
| `--object-shape <key>`  | No            | Merge the same top-level payload property in both inputs and validate only that payload.    |
| `--subdirectory <path>` | No            | Prefix the endpoint path before hashing; blank or omitted leaves the identity unchanged.    |
| `--spec <url>`          | No            | Spec URL to validate the merged result against.                                             |
| `--schema <name>`       | With `--spec` | Schema key under `components.schemas`; defaults to the spec's `x-root-schema`.              |
| `-h, --help`            | No            | Print this usage and exit 0.                                                                |

**Interactive:** in a terminal, a missing required input starts a prompt session on stderr that asks for it and every unset optional; Enter skips an optional. Piped/CI runs get the usage error instead.

For `{ "statusCode": 200, "body": { ... } }`, select `--object-shape body`.
Both corrupt and populated inputs must have a `body` property. Only their payloads
are merged; the corrupt fixture's other fields remain unchanged, and populated
siblings are ignored. Validation applies to the merged body, not its envelope.
The key is literal, not a dotted path; blank or omitted keeps root-level behavior.
Diff's `--object-shape body` produces the matching wrapped Missing schema and stub.

## Filenames and provenance

The third positional argument is now an **output directory**, not a filename.
`--endpoint-url` is required; it is not the spec URL and is never inferred from the schema name.
The library likewise takes `outDir` and `endpointUrl` instead of `outFile`.

```text
stem = Base64(SHA1(UTF8(effectiveEndpointIdentity))).replaceAll("/", "x")
merged file = <out-dir>/<stem>.json
provenance = <out-dir>/<stem>.provenance.json
```

This is standard Base64, not Base64url: `+` and `=` are retained. With no subdirectory,
the endpoint is not normalized; differences in spelling, query parameters, or trailing
slashes produce different hash inputs. Interactive answers use the shared prompt's
whitespace trimming. With a subdirectory, its leading/trailing slashes and the
endpoint path's leading slashes are removed at the join. A method prefix stays outside
the path: `GET, /custodies/v2` plus `/savings/` becomes exactly
`GET, savings/custodies/v2`, hashed to `SyDyiBXH0INxJLx3y+UqNPhAJKc=.json`.
The method is part of the hash when supplied in the identity. Fixture content, schema
name and output directory do not affect the filename.

The sidecar has two fields:

| Field         | Meaning                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `endpointUrl` | The effective endpoint identity after applying any subdirectory.                                               |
| `sha256`      | Lowercase, 64-character hexadecimal SHA-256 of the exact merged JSON UTF-8 bytes, including the final newline. |

The fixture stays plain two-space JSON; metadata never changes its schema.
Rerunning the same endpoint overwrites the same two files. Changed content changes
the SHA-256 checksum, not the filename. Validation happens before either write.

SHA-1 and the lossy `/`→`x` encoding are for naming, not collision-proof identity
or integrity. The SHA-256 checksum is a content fingerprint, not a signature or
proof of origin. The sidecar stores the endpoint URL in plain text: do not include
credentials or secret query parameters.

## Examples

**No `--spec`** — same inputs as Quick start, validation is skipped:

```bash
node packages/openapi-fixture-merge/dist/cli.js corrupt.json populated.json fixtures --endpoint-url "$ENDPOINT"
```

```
filled 2 path(s)
warning: result not validated (no --spec)
wrote fixtures/XR2lRB+kbknhCCQzmKfkiOpfUVE=.json
wrote fixtures/XR2lRB+kbknhCCQzmKfkiOpfUVE=.provenance.json
```

**Method and subdirectory** — hash `GET, savings/custodies/v2`:

```bash
node packages/openapi-fixture-merge/dist/cli.js corrupt.json populated.json fixtures --endpoint-url "GET, custodies/v2" --subdirectory savings
```

**`.stub.ts` module input** — [`openapi-ai-fixtures --missing`](../openapi-ai-fixtures/README.md#examples)
writes a typed stub module instead of JSON. Merge consumes it the same way, no `--ts` flag needed.
This stub is real output from one live Codex run (`gpt-5.5`, 2026-09-14, nondeterministic):

```text
// populated.stub.ts
import type { components } from "./out/missing.d.ts";

export const MISSING_STUB: components["schemas"]["missing"] = {
  "customer": {
    "email": "customer@example.com"
  },
  "lines": [
    {
      "sku": "SKU-001"
    }
  ]
};
```

```bash
node packages/openapi-fixture-merge/dist/cli.js corrupt.json populated.stub.ts fixtures --endpoint-url "$ENDPOINT"
```

```
filled 2 path(s)
warning: result not validated (no --spec)
wrote fixtures/XR2lRB+kbknhCCQzmKfkiOpfUVE=.json
wrote fixtures/XR2lRB+kbknhCCQzmKfkiOpfUVE=.provenance.json
```

**Schema-violation failure** — the populated file contains a value the schema rejects:

```bash
node packages/openapi-fixture-merge/dist/cli.js corrupt.json bad-populated.json fixtures --endpoint-url "$ENDPOINT" --spec "$SPEC" --schema order
```

```
filled 2 path(s)
openapi-fixture-merge: merged fixture violates schema "order": /customer/email: must be string
  fix: fix the listed paths in the populated file, or re-run the AI fill
  see: openapi-fixture-merge --help
```

Exit code `1`. Neither the merged JSON nor its provenance sidecar is written.

## Errors

| You see                                                      | It means                                             | Fix                                                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `usage: <corrupt.json> … <out-dir> --endpoint-url <url> …`   | Missing required inputs.                             | Pass both input files, the output directory, and the endpoint URL.                                   |
| `--schema requires --spec`                                   | `--schema` was given without `--spec`.               | Add `--spec <url>`.                                                                                  |
| `schema name required`                                       | `--spec` alone, and the spec has no `x-root-schema`. | Add `--schema <name>`, or use a spec written by `openapi-types <spec-url> <schema-name> <out-file>`. |
| `corrupt fixture file "<path>" does not exist`               | The `<corrupt.json>` path is wrong.                  | Check the path; it resolves from the current directory.                                              |
| `populated file "<path>" does not exist`                     | The `<populated>` path is wrong.                     | Check the path; it resolves from the current directory.                                              |
| `populated file must be .json, .ts, .mts, .js, or .mjs`      | The populated file has an unsupported extension.     | Rename it, or use one of those extensions.                                                           |
| `merged fixture violates schema "<name>": <path>: <message>` | The merged result fails schema validation.           | Fix the listed paths in the populated file, or re-run the AI fill.                                   |
| `schema "<name>" is unavailable`                             | `--schema` names a key not in `components.schemas`.  | The message lists the available schema names; pick one.                                              |
| Any other error                                              | See the shared error format and exit codes.          | [Root README](../../README.md#rules-every-tool-shares).                                              |

## Library

```json
{
  "devDependencies": {
    "@fixture-automation/openapi-fixture-merge": "workspace:*"
  }
}
```

```ts
import { mergeFixture } from '@fixture-automation/openapi-fixture-merge';

const result = await mergeFixture({
  corruptFile: 'corrupt.json',
  populatedFile: 'populated.json',
  outDir: 'fixtures',
  endpointUrl: 'https://api.example.com/v1/invoices/in_2',
  spec: { url: 'https://example.com/openapi.json', schemaName: 'invoice' }
});

console.log(`filled ${result.filled.length} path(s)`);
console.log(result.outFile, result.provenanceFile, result.provenance.sha256);
```

- `mergeFixture(input: MergeInput): Promise<MergeResult>` — fills the corrupt fixture from the populated file, validates when `input.spec` is given, and writes the endpoint-named merged JSON and its SHA-256 provenance sidecar. Optional `objectShape` selects the same literal top-level payload key in both inputs; optional `subdirectory` prefixes the endpoint path before hashing. Returns `value`, `filled`, `outFile`, `provenanceFile`, and `provenance`. Skips validation when `input.spec` is omitted.
- `deepFill(base: unknown, fill: unknown): FillResult` — copies values from `fill` into keys `base` does not already have, recursing into objects and zipping arrays by index. Returns `{ value, filled }` (`filled` is the list of paths it supplied).
- `loadPopulated(file: string): Promise<unknown>` — reads a `.json` file, or `import()`s a `.ts`/`.mts`/`.js`/`.mjs` module and returns its single export.
- Types: `FillResult`, `MergeInput`, `MergeProvenance`, `MergeResult`, `MergeSpec`.

## Gotchas

- **Fills absent keys only.** A key already present in the corrupt fixture is never overwritten, even if the populated file holds a different value.
- **Objects recurse, arrays zip by index.** A populated array longer than the corrupt one appends its extra elements.
- **`.ts` modules load via Node's native `import()`.** Your build must emit real `.ts`/`.js` output; type-only imports are erased at runtime and only the exported value matters.
- **Extra payload keys survive.** `additionalProperties` and extra keys in the populated payload are preserved in the merged payload. With `objectShape`, populated envelope siblings are ignored.
- **Validation needs `--spec`.** Without it, the merged file is written unvalidated and a warning goes to stderr. `--schema` is only needed when the spec carries no `x-root-schema`.
- **Prompts go to stderr.** `openapi-fixture-merge … > out` still prompts on stderr and keeps stdout clean.

## Develop

```bash
pnpm exec nx run @fixture-automation/openapi-fixture-merge:test
pnpm exec nx run @fixture-automation/openapi-fixture-merge:build
pnpm run lint
```

- `src/data-access/fixture-merge.client.ts` owns merge orchestration and validation.
- `src/data-access/load-populated.client.ts` owns JSON and module loading.
- `src/utils/deep-fill.util.ts` owns the recursive fill algorithm.
- `src/common/` owns the public types.
- `src/index.ts` is the public entry point; `src/cli.ts` is the CLI.
