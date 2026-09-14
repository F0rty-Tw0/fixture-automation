# @fixture-automation/openapi-types

Give it an OpenAPI 3.x spec URL, get back a TypeScript declaration file (`paths`, `operations`, `components`).

## What it does

- Wraps [`openapi-typescript`](https://openapi-ts.dev/) with a URL-only loader.
- Reads JSON or YAML, over `http://`, `https://`, or `file://`.
- Generates the whole spec by default. Give it a schema name and it prunes the spec to that schema plus everything it references, and writes the pruned spec next to the types so the other tools can default the schema name from it.

## Quick start

```bash
pnpm run build
SPEC=$(node -p "require('node:url').pathToFileURL('packages/openapi-fixtures/src/test/fixtures/invoice/spec.json').href")
node packages/openapi-types/dist/cli.js $SPEC
```

```text
export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        invoice: {
            /** @example in_123 */
            id: string;
            amount_due: number;
            /** @enum {string} */
            status: "draft" | "open";
            memo?: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
```

## Command

```
node packages/openapi-types/dist/cli.js <spec-url> [out-file]
node packages/openapi-types/dist/cli.js <spec-url> <schema-name> <out-file>
```

| Flag          | Required | What it does                                                                                                                                                                                                                         |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `spec-url`    | Yes      | `http(s)://` or `file://` URL of the spec. JSON or YAML (JSON only with a schema name).                                                                                                                                              |
| `schema-name` | No       | Key under `components.schemas`. Prunes the spec to that schema and what it references; writes `<out-file>.d.ts` and `<out-file>.spec.json` (the pruned spec, tagged `x-root-schema` so later tools default the schema name from it). |
| `out-file`    | No       | Destination file. Omit for stdout. Required with a schema name; `.d.ts` is appended when missing.                                                                                                                                    |
| `-h, --help`  | No       | Print usage and exit `0`.                                                                                                                                                                                                            |

**Interactive.** In a terminal, a missing `spec-url` starts a prompt session on stderr that asks for it, then for `schema-name` and `out-file`; Enter skips an optional. Piped or CI runs get the usage error instead, same as today.

## Examples

**Write to a file.**

```bash
node packages/openapi-types/dist/cli.js $SPEC api.d.ts
```

Writes `api.d.ts`, prints nothing on success.

**Print to stdout.**

```bash
node packages/openapi-types/dist/cli.js $SPEC
```

Prints the same declarations shown in Quick start above.

**Remote spec.**

```bash
node packages/openapi-types/dist/cli.js \
  https://raw.githubusercontent.com/stripe/openapi/master/latest/openapi.spec3.json \
  stripe.d.ts
```

Takes a few seconds. Stripe's output is large, roughly 5 MB / 90k lines. Commit it or regenerate in CI.

**One schema, pruned spec.**

```bash
node packages/openapi-types/dist/cli.js \
  https://raw.githubusercontent.com/stripe/openapi/master/latest/openapi.spec3.json \
  invoice tmp/invoice.d.ts
```

```text
wrote tmp/invoice.d.ts and tmp/invoice.spec.json (137 schemas reachable from invoice)
```

`tmp/invoice.d.ts` holds only the `components` reachable from `invoice` (`paths` is empty). `tmp/invoice.spec.json` is the pruned spec with `"x-root-schema": "invoice"`; pass its `file://` URL to `openapi-fixtures`, `openapi-fixture-diff diff` and `openapi-fixture-merge --spec` and they default the schema name to `invoice`. For Stripe that is roughly 1 MB instead of 4.5 MB.

## Errors

| You see                                      | It means                                              | Fix                                                                                    |
| -------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `usage: <spec-url> [schema-name] [out-file]` | No spec URL was given, or more than three arguments.  | Pass the spec URL first, then optionally a schema name and an out-file.                |
| `schema not found: <name>`                   | The schema name is not a key of `components.schemas`. | The `fix:` line suggests similar names or lists what exists.                           |
| `schema-name requires a JSON spec`           | A schema name was given with a `.yaml`/`.yml` URL.    | Convert the spec to JSON, or omit the schema name.                                     |
| `spec must be a URL, got bare path "..."`    | You passed a filesystem path.                         | Wrap it as a `file://` URL, e.g. `file:///E:/fixture-automation/invoice.fixture.json`. |
| `Unknown option '--foo'`                     | An unsupported flag was passed.                       | Only positionals and `--help` are accepted.                                            |
| `Failed to load <url>: 404 Not Found`        | The URL didn't return the spec.                       | Open the URL in a browser; it must return the raw spec.                                |
| `spec file not found: <path>`                | The `file://` URL doesn't point at an existing file.  | Check the path inside the URL.                                                         |
| `spec download failed for <url>`             | The host could not be reached.                        | Check the host name and your network access.                                           |

See [the root README](../../README.md#rules-every-tool-shares) for the shared error format and exit codes.

## Library

```json
{
  "dependencies": {
    "@fixture-automation/openapi-types": "workspace:*"
  }
}
```

```ts
import { writeFile } from 'node:fs/promises';
import { generateTypes } from '@fixture-automation/openapi-types';

const types = await generateTypes('https://example.com/openapi.json');
await writeFile('api.d.ts', types);
```

- `generateTypes(spec: string | URL | Record<string, unknown>): Promise<string>` — a string or `URL` is fetched, an object is treated as an already-parsed document. Returns the declaration file contents; writing it is up to you.

Use the generated types:

```ts
import type { components, operations, paths } from './stripe.d.ts';

// A schema from #/components/schemas/invoice
type Invoice = components['schemas']['invoice'];

// An endpoint, by path
type GetInvoice = paths['/v1/invoices/{invoice}']['get'];

// Same endpoint, by operationId
type GetInvoiceParams = operations['GetInvoicesInvoice']['parameters']['path']; // { invoice: string }
type GetInvoiceResponse = operations['GetInvoicesInvoice']['responses'][200]['content']['application/json']; // Invoice
```

## Gotchas

- **Redirecting stdout disables prompting.** `openapi-types $SPEC > out.d.ts` pipes stdout, so it will not prompt even with a terminal attached; pass the args or write with `[out-file]` instead.
- **TypeScript 5 peer warning.** `openapi-typescript` declares a peer dependency on TypeScript 5. This repo uses TypeScript 6. It works, but `pnpm install` prints an unmet-peer warning.
- **No endpoint filtering.** The whole spec is generated every time; narrow with `paths` / `components` at the type level, not the CLI.
- **Fixtures live elsewhere.** This package only generates types. Sampling data is [`@fixture-automation/openapi-fixtures`](../openapi-fixtures/README.md).

## Develop

```bash
pnpm exec nx run @fixture-automation/openapi-types:test    # offline, uses a local file:// spec
pnpm exec nx run @fixture-automation/openapi-types:build
pnpm run lint
```

- `src/data-access/openapi-types.client.ts` — spec loading and declaration generation.
- `src/test/` — fixture spec and the file-URL test helper.
- `src/index.ts` — public entry point (`generateTypes`).
