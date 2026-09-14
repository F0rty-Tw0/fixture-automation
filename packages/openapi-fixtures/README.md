# @fixture-automation/openapi-fixtures

Give it an OpenAPI JSON spec URL and a schema name, get a deterministic sample fixture: JSON, or a typed TypeScript stub.

## What it does

- Samples a schema under `components.schemas` with [`openapi-sampler`](https://github.com/Redocly/openapi-sampler).
- Same spec in, same fixture out. Safe to snapshot.
- Renders JSON, or a typed `.ts` stub via `--ts` / `typescriptStub`.

## Quick start

```bash
pnpm run build
SPEC=$(node -p "require('node:url').pathToFileURL('packages/openapi-fixtures/src/test/fixtures/invoice/spec.json').href")
node packages/openapi-fixtures/dist/cli.js $SPEC invoice
```

```json
{
  "id": "in_123",
  "amount_due": 0,
  "status": "draft",
  "memo": "string"
}
```

## Command

```
node packages/openapi-fixtures/dist/cli.js <spec-url> [schema-name] [out-file] [--ts <types-file>] [--required-only]
```

| Flag                | Required | What it does                                                                                                                                                               |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spec-url`          | Yes      | `http(s)://` or `file://` URL of a JSON spec.                                                                                                                              |
| `schema-name`       | No       | Key under `components.schemas`, e.g. `invoice`. Omit it with a spec written by `openapi-types <spec-url> <schema-name> <out-file>`; its `x-root-schema` supplies the name. |
| `out-file`          | No       | Destination file. Omit for stdout. With two positionals, the second is the schema name when the spec declares it, otherwise the out-file.                                  |
| `--ts <types-file>` | No       | Emit a typed `.ts` stub instead of JSON, importing `components` from this generated types file.                                                                            |
| `--required-only`   | No       | Sample only the required properties (`skipNonRequired: true`).                                                                                                             |
| `-h, --help`        | No       | Print usage and exit `0`.                                                                                                                                                  |

**Interactive.** In a terminal, a missing `spec-url` starts a prompt session on stderr. It asks for the spec URL, then every unset optional (`schema-name`, `out-file`, `--ts`, `--required-only`); Enter skips an optional. A run with `spec-url` given asks nothing. Piped and CI runs get the usage error instead.

## Examples

**Required fields only.**

```bash
node packages/openapi-fixtures/dist/cli.js $SPEC invoice --required-only
```

```json
{
  "id": "in_123",
  "amount_due": 0,
  "status": "draft"
}
```

**Typed TypeScript stub.**

```bash
node packages/openapi-types/dist/cli.js $SPEC invoice.d.ts
node packages/openapi-fixtures/dist/cli.js $SPEC invoice invoice.stub.ts --ts invoice.d.ts
```

**Schema name from a pruned spec.** `openapi-types <spec-url> <schema-name> <out-file>` writes `<out-file>.spec.json` tagged with `x-root-schema`; point at that file and the name is implied.

```bash
node packages/openapi-types/dist/cli.js $SPEC invoice tmp/invoice.d.ts        # also writes tmp/invoice.spec.json
LOCAL=$(node -p "require('node:url').pathToFileURL('tmp/invoice.spec.json').href")
node packages/openapi-fixtures/dist/cli.js $LOCAL tmp/invoice.json
node packages/openapi-fixtures/dist/cli.js $LOCAL tmp/invoice.stub.ts --ts tmp/invoice.d.ts
```

The explicit `$LOCAL invoice tmp/invoice.json` form still works.

```text
import type { components } from "./invoice.d.ts";

export const INVOICE_STUB: components["schemas"]["invoice"] = {
  "id": "in_123",
  "amount_due": 0,
  "status": "draft"
};
```

**Nested schema, required only.** Same command shape, a schema with a nested object and array (`order`, from the diff/merge test spec):

```bash
ORDER=$(node -p "require('node:url').pathToFileURL('packages/openapi-fixture-diff/src/test/fixtures/nested/spec.json').href")
node packages/openapi-fixtures/dist/cli.js $ORDER order --required-only
```

```json
{
  "id": "or_1",
  "created": 0,
  "customer": {
    "name": "string",
    "email": "string"
  },
  "lines": [
    {
      "sku": "string",
      "source": "string"
    }
  ]
}
```

## Errors

| You see                                                                            | It means                                            | Fix                                                                                          |
| ---------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `usage: <spec-url> [schema-name] [out-file] [--ts <types-file>] [--required-only]` | No spec URL, or extra positional args.              | Pass `spec-url`, then at most a schema name and one destination.                             |
| `schema name required`                                                             | No schema name and the spec has no `x-root-schema`. | Pass the name, or use a spec written by `openapi-types <spec-url> <schema-name> <out-file>`. |
| `spec must be a URL, got bare path "..."`                                          | You passed a filesystem path.                       | Wrap it as a `file://` URL.                                                                  |
| `schema not found: invoic` / `fix: did you mean invoice?`                          | The schema name is wrong or misspelled.             | Use the exact, case-sensitive key from `components.schemas`.                                 |
| `spec at ... has no components.schemas`                                            | The URL points at data, not a spec.                 | Pass the OpenAPI document, not a fixture file.                                               |
| `spec download failed: HTTP 404 for ...`                                           | The URL didn't return the spec.                     | Open the URL in a browser; it must return raw JSON.                                          |
| `spec download failed for ...: getaddrinfo ENOTFOUND ...`                          | DNS/network failure.                                | Check the host name and your network access.                                                 |
| `spec at ... is YAML; this loader reads JSON only`                                 | You pointed at a `.yaml` spec.                      | Convert to JSON (`openapi-types` accepts YAML).                                              |
| `spec at ... is not JSON: ...`                                                     | The URL returned HTML or malformed JSON.            | Use the raw JSON link, not an HTML page.                                                     |
| `spec file not found: <path>`                                                      | The `file://` URL doesn't resolve to a file.        | Check the path inside the URL.                                                               |
| `unsupported spec URL scheme "ftp:"`                                               | Only `http(s)://` and `file://` are supported.      | Use `https://` or `file://`.                                                                 |
| `--ts file "nope.d.ts" does not exist`                                             | The `--ts` types file wasn't found.                 | Check the path; it resolves from the current directory.                                      |
| `no such file or directory: <path>`                                                | The output file's parent directory is missing.      | Create the parent directory, or check the path.                                              |

See [the root README](../../README.md#rules-every-tool-shares) for the shared error format and exit codes.

## Library

```json
{
  "devDependencies": {
    "@fixture-automation/openapi-fixtures": "workspace:*"
  }
}
```

Steps below go from a spec URL to a typed fixture in a test. Example: the `invoice` schema.

**1. Load the spec.** Once per test file; `loadSpec` reads JSON only.

```ts
import { loadSpec } from '@fixture-automation/openapi-fixtures';

const spec = await loadSpec('https://raw.githubusercontent.com/stripe/openapi/master/latest/openapi.spec3.json');
```

Offline: `loadSpec(pathToFileURL('./test/spec.json'))`.

**2. Bind the types.** `fx` now only accepts real schema names and returns the matching type.

```ts
import type { components } from './stripe.d.ts';
import { fixtures } from '@fixture-automation/openapi-fixtures';

const fx = fixtures<components>(spec);
```

**3. Make a fixture.** Values are placeholders: `example`, then `default`, then the first `enum` value, then a type placeholder (`'string'`, `0`, `false`).

```ts
const invoice = fx('invoice');
```

**4. Override what the test cares about.** Top-level fields are type-checked against the schema. Overrides are a shallow spread, so spread nested objects yourself.

```ts
const paid = fx('invoice', { amount_due: 4200, status: 'paid' });
```

**5. Make a factory per resource.** One function per resource, defaults baked in; tests pass only what differs.

```ts
export const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice =>
  fx('invoice', { id: 'in_test_1', currency: 'usd', ...overrides });
```

**6. Cyclic schemas omit the looping property.** A schema whose optional fields cycle back to itself (e.g. Stripe `invoice` → `payment_intent` → `api_errors` → `payment_intent`) leaves the second visit out of the sample instead of emitting an invalid `{}`. That is a local patch of `openapi-sampler` (`patches/openapi-sampler@1.7.5.patch`); re-check it when bumping the dependency. A **required** property on a cycle still cannot be sampled and fails validation — use `skipNonRequired: true` there.

Measured on the Stripe spec:

| options                     | fields | validates |
| --------------------------- | ------ | --------- |
| default                     | 78     | yes       |
| `{ skipNonRequired: true }` | 30     | yes       |

**7. Validate fixtures in tests (optional).** Proves a fixture, with overrides, still matches the schema. Uses `ajv`, a dev dependency of this package; add it to your own package if you use this.

```ts
import { Ajv } from 'ajv';

const ajv = new Ajv({ strict: false, validateFormats: false });
const validateInvoice = ajv.compile({ components: spec.components, $ref: '#/components/schemas/invoice' });

expect(validateInvoice(makeInvoice({ status: 'open' }))).toBe(true);
```

Stripe writes `nullable: true` without `type`, which ajv refuses to compile. Strip it first:

```ts
const components = JSON.parse(JSON.stringify(spec.components, (k, v) => (k === 'nullable' ? undefined : v)));
```

### Exported signatures

- `loadSpec(specUrl: string | URL): Promise<OpenApiSpec>` — fetches and parses a JSON spec over `http(s)://` or `file://`.
- `fixtures<TComponents>(spec, options?): FixtureFactory<TComponents>` — returns a typed schema-name getter with shallow overrides. `options` is `SampleOptions` (`openapi-sampler` options, including `skipNonRequired`).
- `typescriptImport(outputPath: string, typesPath: string): string` — a type-only relative import path between two absolute paths. Throws if they're on different drives.
- `typescriptStub(schemaName: string, typesImport: string, json: string): string` — renders a `const <NAME>_STUB: components["schemas"]["<name>"] = <json>` module.
- `FixtureError` — an `Error` subclass with an optional `.fix: string | undefined` naming the corrective action.
- `runCli(tool: string, run: () => Promise<void>): Promise<void>` — wraps a CLI's body, catching errors into the shared 3-line format and setting `process.exitCode`.
- `cliInputs(): Inputs` — `promptedInputs()` when stdin is a terminal, else `silentInputs`. `promptedInputs(question?)` takes a `Question` for tests; `terminalQuestion` is the readline default.
- `readJsonFile(label: string, file: string): Promise<unknown>` / `readTextFile(label: string, file: string): Promise<string>` — read a file, naming both the input and the path in `FixtureError` on a missing/invalid file.
- `schemaSuggestion(names: string[], query: string): string` — `did you mean ...?` for a near match, else a capped list of available names.
- Types: `OpenApiSpec`, `SampleOptions`, `SchemaMap`, `InputSpec`, `Inputs`, `Question`.

## AI-enriched fixtures

Scenario-driven enrichment of an existing fixture lives in the sibling package.

See [`@fixture-automation/openapi-ai-fixtures`](../openapi-ai-fixtures/README.md) for the API, and [`PROVIDERS.md`](../openapi-ai-fixtures/PROVIDERS.md) for provider contracts and the security notes.

## Gotchas

- **Placeholders, not realistic data.** `id` is `'string'`, amounts are `0`. Override anything a human will read.
- **Expandable fields** (`anyOf: [string, object]`, like Stripe `customer`) sample as the first branch, the id string. Override with a nested fixture if you need the object: `fx('invoice', { customer: fx('customer') })`.
- **YAML specs are not supported.** `loadSpec` and the CLI need JSON; `openapi-types` accepts YAML.
- **Network in tests.** `loadSpec` over `https://` hits the network every run. Vendor the JSON and use `file://` for CI.
- **Unknown schema name** throws `schema not found: <name>`. The TypeScript type already prevents this once `spec` is bound with `fixtures<components>`.
- **Prompts go to stderr.** `openapi-fixtures ... > out.json` still prompts on stderr and keeps stdout clean.

## Develop

```bash
pnpm exec nx run @fixture-automation/openapi-fixtures:test
pnpm exec nx run @fixture-automation/openapi-fixtures:build
pnpm run lint
```

- `src/common/` — shared types and sampler options; no runtime behavior.
- `src/utils/` — JSON parsing, import-path calculation, TypeScript stub rendering.
- `src/data-access/` — spec loading and the sampler wrapper (the sampler resets shared caches and can warn, so it's not a pure utility).
- `src/test/` — fixture data, test-only types, and harness utilities.
- `src/index.ts` — the public entry point.
