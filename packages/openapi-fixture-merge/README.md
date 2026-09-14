# @fixture-automation/openapi-fixture-merge

Fill a corrupt fixture from a populated file, and optionally validate the result against its schema.

This is the last step in the [corrupt → diff → fill → merge pipeline](../../README.md#full-pipeline-walkthrough).

## What it does

- **Fills** only the keys missing from the corrupt fixture; present keys are left untouched.
- **Reads** the populated data from JSON, or from a `.ts`/`.mts`/`.js`/`.mjs` module with one export (the AI package writes these).
- **Validates** the merged result against an OpenAPI schema when `--spec` is given (`--schema` names the schema, or a spec written by `openapi-types <spec-url> <schema-name> <out-file>` supplies it through `x-root-schema`).

## Quick start

```bash
SPEC=$(node -p "require('node:url').pathToFileURL('packages/openapi-fixture-diff/src/test/fixtures/nested/spec.json').href")

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

node packages/openapi-fixture-merge/dist/cli.js corrupt.json populated.json merged.json --spec "$SPEC" --schema order
```

stderr:

```
filled 2 path(s)
```

`merged.json`:

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
usage: openapi-fixture-merge <corrupt.json> <populated.json|populated.stub.ts> <out.json> [options]

  <corrupt.json>       fixture with fields removed (required)
  <populated>          .json fixture, or a .ts/.mts/.js/.mjs module with a single export (required)
  <out.json>           destination for the merged fixture (required)
  --spec <url>         http(s):// or file:// URL of the spec used to validate the result
  --schema <name>      a key under components.schemas; defaults to the x-root-schema of a spec
                       written by openapi-types <spec-url> <schema-name> <out-file>; needs --spec
  -h, --help           print this help
```

| Flag              | Required      | What it does                                                                     |
| ----------------- | ------------- | -------------------------------------------------------------------------------- |
| `<corrupt.json>`  | Yes           | Fixture with fields removed, resolved from the current directory.                |
| `<populated>`     | Yes           | `.json` file, or a `.ts`/`.mts`/`.js`/`.mjs` module exporting exactly one value. |
| `<out.json>`      | Yes           | Destination for the merged fixture.                                              |
| `--spec <url>`    | No            | Spec URL to validate the merged result against.                                  |
| `--schema <name>` | With `--spec` | Schema key under `components.schemas`; defaults to the spec's `x-root-schema`.   |
| `-h, --help`      | No            | Print this usage and exit 0.                                                     |

## Examples

**No `--spec`** — same inputs as Quick start, validation is skipped:

```bash
node packages/openapi-fixture-merge/dist/cli.js corrupt.json populated.json merged.json
```

```
filled 2 path(s)
warning: result not validated (no --spec)
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
node packages/openapi-fixture-merge/dist/cli.js corrupt.json populated.stub.ts merged.json
```

```
filled 2 path(s)
warning: result not validated (no --spec)
```

**Schema-violation failure** — the populated file contains a value the schema rejects:

```bash
node packages/openapi-fixture-merge/dist/cli.js corrupt.json bad-populated.json merged.json --spec "$SPEC" --schema order
```

```
filled 2 path(s)
openapi-fixture-merge: merged fixture violates schema "order": /customer/email: must be string
  fix: fix the listed paths in the populated file, or re-run the AI fill
  see: openapi-fixture-merge --help
```

Exit code `1`. Nothing is written to `out.json`.

## Errors

| You see                                                                                                 | It means                                             | Fix                                                                                                  |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `usage: <corrupt.json> <populated.json\|populated.stub.ts> <out.json> [--spec <url> [--schema <name>]]` | Missing positional arguments.                        | Pass all three files.                                                                                |
| `--schema requires --spec`                                                                              | `--schema` was given without `--spec`.               | Add `--spec <url>`.                                                                                  |
| `schema name required`                                                                                  | `--spec` alone, and the spec has no `x-root-schema`. | Add `--schema <name>`, or use a spec written by `openapi-types <spec-url> <schema-name> <out-file>`. |
| `corrupt fixture file "<path>" does not exist`                                                          | The `<corrupt.json>` path is wrong.                  | Check the path; it resolves from the current directory.                                              |
| `populated file "<path>" does not exist`                                                                | The `<populated>` path is wrong.                     | Check the path; it resolves from the current directory.                                              |
| `populated file must be .json, .ts, .mts, .js, or .mjs`                                                 | The populated file has an unsupported extension.     | Rename it, or use one of those extensions.                                                           |
| `merged fixture violates schema "<name>": <path>: <message>`                                            | The merged result fails schema validation.           | Fix the listed paths in the populated file, or re-run the AI fill.                                   |
| `schema "<name>" is unavailable`                                                                        | `--schema` names a key not in `components.schemas`.  | The message lists the available schema names; pick one.                                              |
| Any other error                                                                                         | See the shared error format and exit codes.          | [Root README](../../README.md#rules-every-tool-shares).                                              |

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
  outFile: 'merged.json',
  spec: { url: 'https://example.com/openapi.json', schemaName: 'invoice' }
});

console.log(`filled ${result.filled.length} path(s)`);
```

- `mergeFixture(input: MergeInput): Promise<MergeResult>` — fills the corrupt fixture from the populated file, validates when `input.spec` is given, and writes the merged JSON. Skips validation when `input.spec` is omitted.
- `deepFill(base: unknown, fill: unknown): FillResult` — copies values from `fill` into keys `base` does not already have, recursing into objects and zipping arrays by index. Returns `{ value, filled }` (`filled` is the list of paths it supplied).
- `loadPopulated(file: string): Promise<unknown>` — reads a `.json` file, or `import()`s a `.ts`/`.mts`/`.js`/`.mjs` module and returns its single export.
- Types: `FillResult`, `MergeInput`, `MergeResult`, `MergeSpec`.

## Gotchas

- **Fills absent keys only.** A key already present in the corrupt fixture is never overwritten, even if the populated file holds a different value.
- **Objects recurse, arrays zip by index.** A populated array longer than the corrupt one appends its extra elements.
- **`.ts` modules load via Node's native `import()`.** Your build must emit real `.ts`/`.js` output; type-only imports are erased at runtime and only the exported value matters.
- **Extra keys survive.** `additionalProperties` and any extra keys in the populated file are preserved in the merged result.
- **Validation needs `--spec`.** Without it, the merged file is written unvalidated and a warning goes to stderr. `--schema` is only needed when the spec carries no `x-root-schema`.

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
