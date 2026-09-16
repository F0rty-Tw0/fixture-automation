# @fixture-automation/openapi-ai-fixtures

Send an existing JSON fixture, its schema, and a scenario to one installed coding CLI; get back only a schema-valid result.

## What it does

- **Enriches** an existing fixture using one installed, authenticated coding CLI (`claude`, `codex`, `antigravity`, `copilot`, or `gemini`). No automatic fallback between tools.
- **Fills only the gaps** [`openapi-fixture-diff`](../openapi-fixture-diff/README.md) found, with `--missing`, instead of regenerating the whole fixture.
- **Validates** every parsed response locally against the schema before writing normal output. Failed responses are saved separately for inspection, and invalid model JSON gets one repair attempt.

## Quick start

> One live Codex (`gpt-5.5`) run, captured 2026-09-14. AI output is **nondeterministic** and this **costs money** — re-running it will not reproduce this exact text.

```bash
SPEC=$(node -p "require('node:url').pathToFileURL('packages/openapi-fixtures/src/test/fixtures/invoice/spec.json').href")

node packages/openapi-fixtures/dist/cli.js "$SPEC" invoice invoice.fixture.json
node packages/openapi-ai-fixtures/dist/cli.js "$SPEC" invoice --fixture invoice.fixture.json --scenario "An open invoice for 4200 cents, a September subscription" --tool codex --model gpt-5.5
```

```text
{
  "id": "in_123",
  "amount_due": 4200,
  "status": "open",
  "memo": "September subscription"
}
```

That run took 11.4 seconds. Provider latency varies; there is no fixed budget.

## Command

```
usage: openapi-ai-fixtures <spec-url> [schema-name] [out-file] [options]
       openapi-ai-fixtures [out-file] --fixture <corrupt.json> --missing <missing.json> [options]
       openapi-ai-fixtures --list-models --tool <name>

  <spec-url>              http(s):// or file:// URL of the JSON spec (required)
  [schema-name]           a key under components.schemas; defaults to the x-root-schema of a spec
                          written by openapi-types <spec-url> <schema-name> <out-file>
  [out-file]              destination file; omitted means stdout
  --fixture <file>        existing JSON fixture to enrich (required)
  --scenario <text>       what the fixture should describe (required without --missing)
  --tool <name>           claude, codex, antigravity, copilot or gemini (required)
  --missing <file>        missing.json from openapi-fixture-diff; fills only the absent fields
  --model <slug>          harness model, or "default" for the harness default
  --ts <types-file>       write a typed .ts stub; requires an out-file
  --executable <path>     absolute path to the harness binary
  --timeout <ms>          harness timeout in milliseconds
  --list-models           print the models the harness offers
  -h, --help              print this help

Without --model a terminal prompts for one and a pipe uses the harness default.
```

| Flag                  | Required                | What it does                                                                                                                 |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `<spec-url>`          | Yes, unless `--missing` | `http(s)://` or `file://` URL of the JSON spec, not a bare path. With `--missing` the positionals are `[out-file]` only.     |
| `<schema-name>`       | No                      | Key under `components.schemas`; defaults to the spec's `x-root-schema`. With `--missing`, not read: `missing.json` names it. |
| `[out-file]`          | No                      | Destination file; omitted prints JSON to stdout.                                                                             |
| `--fixture <file>`    | Yes                     | Existing JSON fixture to enrich. Not overwritten.                                                                            |
| `--scenario <text>`   | Yes, unless `--missing` | What the fixture should describe. With `--missing` it defaults to filling every gap coherently.                              |
| `--tool <name>`       | Yes                     | `claude`, `codex`, `antigravity`, `copilot`, or `gemini`.                                                                    |
| `--missing <file>`    | No                      | `missing.json` from [`openapi-fixture-diff diff`](../openapi-fixture-diff/README.md); switches to gap-filling mode.          |
| `--model <slug>`      | No                      | Model passed to the tool. `default` keeps the harness default. Omitted: a terminal prompts, a pipe uses the default.         |
| `--ts <types-file>`   | No                      | Write a typed `.ts` stub instead of JSON; requires `out-file`.                                                               |
| `--executable <path>` | No                      | Absolute native executable or Node `.js`/`.cjs`/`.mjs` entrypoint, overriding the tool's normal command.                     |
| `--timeout <ms>`      | No                      | Integer 1–2147483647; defaults to `120000`.                                                                                  |
| `--list-models`       | No                      | Print the tool's models and exit; needs no spec, fixture, or scenario.                                                       |
| `-h, --help`          | No                      | Print usage and exit 0.                                                                                                      |

**Interactive.** In a terminal, a missing required input starts a prompt session on stderr: it asks for `spec-url`
(skipped with `--missing`), `--fixture`, `--scenario` (skipped with `--missing`, which defaults it), and `--tool`,
then every unset optional (`schema-name` — skipped with `--missing` — `out-file`, `--ts`, `--executable`,
`--timeout`); Enter skips an optional. `--model` keeps its own numbered picker, not this session. A run with every
required value given asks nothing. Piped and CI runs get the usage error instead.

A bare run's first two prompts, captured on stderr:

```text
spec-url: http(s):// or file:// URL of the JSON spec
  e.g. file:///E:/specs/invoice.spec.json
spec-url:
--fixture: existing JSON fixture to enrich
  e.g. invoice.fixture.json
--fixture:
```

## Examples

**List models** — asks the installed provider CLI; sends no generation prompt:

```bash
node packages/openapi-ai-fixtures/dist/cli.js --list-models --tool codex
```

Model IDs go to stdout, one per line. Provenance goes to stderr as `source: <tool>-cli`.
All five tools use provider-owned discovery; this package contains no model catalog or static fallback.

| Tool          | Discovery                                     |
| ------------- | --------------------------------------------- |
| `claude`      | Stream-JSON initialization's supported models |
| `codex`       | App-server `model/list`, including every page |
| `antigravity` | `agy --output-format json models`             |
| `copilot`     | Headless SDK protocol `models.list`           |
| `gemini`      | ACP session's available models                |

Discovery reuses the CLI's existing authentication and supports `--executable` and `--timeout`.
It may contact the provider; returned choices depend on the installed CLI, account, configuration,
and provider-managed caches. An unavailable CLI, failed login, incompatible protocol, malformed
response, or empty catalog fails instead of supplying guessed model names.

The terminal picker and wizard use the same discovery. An explicit `--model` (including `default`)
bypasses discovery and passes through unchanged; noninteractive generation without `--model`
uses the harness default without a catalog lookup. Discovery starts provider processes, not an
OS sandbox; see [provider contracts and startup restrictions](./PROVIDERS.md#model-discovery).

**Fill only the missing fields, as a typed stub** — one live Codex (`gpt-5.5`) run, 2026-09-14, nondeterministic:

```bash
NESTED_SPEC=$(node -p "require('node:url').pathToFileURL('packages/openapi-fixture-diff/src/test/fixtures/nested/spec.json').href")

node packages/openapi-fixture-diff/dist/cli.js diff "$NESTED_SPEC" order --fixture corrupt.json --out-dir out --required-only
node packages/openapi-ai-fixtures/dist/cli.js out/populated.stub.ts --fixture corrupt.json --missing out/missing.json --tool codex --model gpt-5.5 --ts out/missing.d.ts
```

`missing.json` names the schema, so `--missing` mode takes no spec URL or schema name. The old `"$NESTED_SPEC" order out/populated.stub.ts --missing …` form still runs; the spec and name are ignored.

```text
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

That run took 12.1 seconds. The result holds **only** the absent properties — merge it back with
[`openapi-fixture-merge`](../openapi-fixture-merge/README.md#examples).

## Errors

| You see                                                                                              | It means                                                        | Fix                                                                                               |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `usage: <spec-url> [schema-name] [out-file] --fixture <fixture.json> --scenario <text> --tool <...>` | Missing required arguments.                                     | Pass the spec URL (unless `--missing`), `--fixture`, `--scenario` (or `--missing`), and `--tool`. |
| `--tool is required`                                                                                 | No `--tool` given, including with `--list-models`.              | Add `--tool codex` (or `claude`, `antigravity`, `copilot`, `gemini`).                             |
| `--tool must be claude, codex, antigravity, copilot, or gemini, got "<value>"`                       | `--tool` had an unsupported value.                              | Use one of the five listed tools.                                                                 |
| `--fixture file "<path>" does not exist`                                                             | The `--fixture` path is wrong.                                  | Check the path; it resolves from the current directory.                                           |
| `--fixture file "<path>" is not valid JSON: <parse error>`                                           | The fixture file is not parseable JSON.                         | Fix the file, or point at a real JSON fixture.                                                    |
| `--scenario requires non-empty text`                                                                 | `--scenario` was empty, and `--missing` was not given.          | Add scenario text, or pass `--missing`.                                                           |
| `--timeout requires an integer from 1 to 2147483647 milliseconds`                                    | `--timeout` was not a valid integer in range.                   | Pass a plain integer millisecond value.                                                           |
| `Failed to start agent "<path>": spawn <path> ENOENT`                                                | The tool executable was not found.                              | Install the CLI, or check `--executable`.                                                         |
| `--missing file "<path>" does not exist`                                                             | The `--missing` path is wrong.                                  | Check the path; it resolves from the current directory.                                           |
| `missing.json requires a non-empty "schemaName"`                                                     | `--missing` points at a file that is not a real `missing.json`. | Use the file `openapi-fixture-diff diff` produced.                                                |
| `--ts requires an output file to resolve the types import`                                           | `--ts` was given without a positional `out-file`.               | Add a destination file.                                                                           |
| Any other error                                                                                      | See the shared error format and exit codes.                     | [Root README](../../README.md#rules-every-tool-shares).                                           |

The rows below are diagnostic categories the underlying provider or runtime can raise, not exact
messages:

| Category                                            | What to check                                                                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Authentication, permission, quota, or service error | Authenticate the selected CLI separately; check its account and policy. Do not bypass provider restrictions to force success. |
| Timeout or input/output limit                       | Reduce the fixture/scenario/schema graph, or raise `--timeout`. Limits: 1 MiB prompt, 8 MiB combined output.                  |

## Library

```json
{
  "devDependencies": {
    "@fixture-automation/openapi-ai-fixtures": "workspace:*"
  }
}
```

```ts
import { aiFixtures } from '@fixture-automation/openapi-ai-fixtures';

const enrich = aiFixtures<components>(spec, { tool: 'claude' });
const invoice = await enrich('invoice', {
  fixture: baseline,
  scenario: 'An open monthly software-subscription invoice with amount_due of 4200 cents.'
});
```

- `aiFixtures<TComponents>(spec, options: AiFixtureOptions): AiFixtureFactory<TComponents>` — enriches an existing fixture; returns `Promise<TComponents['schemas'][name]>`.
- `aiMissingFixture(options: AiFixtureOptions): AiMissingFactory` — fills only the gaps a diff found. No `spec` parameter: `missing.json` is self-contained.
- `parseMissingFile(text: string): MissingFile` — validates a `missing.json` payload before any tool process starts.
- `prepareSchema(spec, name)` — resolves a schema's local dependency graph into a self-contained document and compiles a validator.
- `schemaDialect(openapi, jsonSchemaDialect)` — maps a spec's version fields onto `'draft-07' | 'openapi-30' | 'openapi-31'`.
- `compileFixtureSchema(schema, dialect)` — compiles one prepared document; formats outside `ajv-formats` register as pass-through.
- `AiFixtureOptions` — `{ tool, executable?, model?, timeoutMs?, signal?, recoveryFile? }`. `tool` is required (no fallback). `executable` is an absolute path override. `model` omitted or `'default'` adds no model flag. `timeoutMs` defaults to `120000`, max `2147483647`. `signal` is an `AbortSignal`; an already-aborted signal rejects before the schema is prepared or a process starts. `recoveryFile` is the base path for failed-response sidecars; library calls without it do not save diagnostic files.
- `discoverModels(tool, options?: ModelDiscoveryOptions): Promise<ModelDiscovery>` — returns `{ models, source }` from the installed provider. Options are `{ executable?, timeoutMs?, signal? }`; errors reject, with no hardcoded fallback.

### Validation and failure behavior

- Invalid model JSON triggers **one repair attempt** using the exact failed response, its parser error, and the original request with the same tool/model: at most two processes per call. No fallback tool or result cache.
- Malformed transport envelopes, provider errors, process failures, timeouts, cancellation, and schema-validation failures are **not retried**. A second invalid model response fails with an error reporting both attempts.
- Before repair, the CLI saves the failed response verbatim to `<output>.failed-attempt-1.txt` and prints its path on stderr. Without an output file, the `--fixture` path is the base. Existing sidecars are never overwritten: a collision gets a UUID suffix.
- If repair produces invalid JSON or fails schema validation, its response is saved as `<output>.failed-attempt-2.txt`. A schema-invalid first response is also saved, without retrying. Recovery files remain even when repair succeeds.
- If saving fails, generation stops before repair. If the complete repair prompt exceeds the input limit, the saved response remains available for manual correction.
- Recovery files can contain sensitive fixture data. Inspect them before sharing or committing.
- Each attempt has its own configured `timeoutMs`; a corrective attempt can incur another generation charge.
- Prompts go over stdin, limited to **1 MiB per attempt**. Combined stdout/stderr is limited to **8 MiB per attempt**.
- A timeout terminates the owned process tree. If tree termination cannot be confirmed, the call
  fails and the temporary scratch directory is **kept**, not deleted under a possibly running process.
- The final response must be strict JSON, not markdown or surrounding prose, and must pass local
  schema validation. The validator does not coerce types, insert defaults, or remove properties.
- Validation completes before writing normal output. Output is staged beside the destination and renamed
  atomically; a failed or invalid response leaves an existing destination unchanged. Diagnostic sidecars are separate.
- Output paths are made absolute before validation. Existing destinations are resolved through symlinks;
  imports and writes use that resolved path.
- A destination that aliases the fixture, spec, or declarations input (including via a symlink) is
  rejected.

### Testing with nondeterministic output

- Never call a live coding CLI from a unit test — output varies, needs credentials/network, and can cost money.
- Generate a fixture deliberately with a reviewed provider configuration, inspect the JSON, and save it as an ordinary fixture in the repo.
- Test application code against that saved fixture like any other.

## Gotchas

- **Prompts go to stderr.** `openapi-ai-fixtures ... > out.json` still prompts on stderr and keeps stdout clean.
- **Not a sandbox.** The scratch working directory and provider tool/MCP restrictions are not an OS sandbox. Do not point `--executable` at code you have not reviewed.
- **Credentials are inherited.** The normal credential environment passes through so a pre-authenticated CLI works — provider-managed credentials, policy, and quotas still apply.
- **Gemini's MCP-disable setting is ineffective.** The staged `admin.mcp.enabled` file setting does not work in the reviewed Gemini CLI v0.59.0 release.
- **Antigravity, Copilot, and Gemini status is a documentation review, not a live run.** Only Claude Code and Codex have a recorded successful real generation; see [`PROVIDERS.md`](./PROVIDERS.md) for the full status matrix and evidence.
- **AI generation costs money.** Every call is a real provider request; it can incur charges.
- **Never call a live model from a unit test.** See [Testing with nondeterministic output](#testing-with-nondeterministic-output) above.

Full provider-by-provider evidence, invocation details, and known defects: [`PROVIDERS.md`](./PROVIDERS.md).

## Develop

```bash
pnpm exec nx run @fixture-automation/openapi-ai-fixtures:test
pnpm exec nx run @fixture-automation/openapi-ai-fixtures:build
pnpm run lint
```

- `src/data-access/ai-fixtures.client.ts` owns the public factory and final validation.
- `src/data-access/ai-missing-fixtures.client.ts` owns missing-field filling and projection validation.
- `src/utils/schema-*.util.ts` owns dialect selection, dependency traversal, and AJV compilation.
- `src/data-access/*client.ts` (the rest) owns provider adapters, process lifecycle, and CLI file output.
- `src/common/` owns public types and shared contracts.
- `src/index.ts` is the public entry point; `src/cli.ts` is the CLI.
