# @fixture-automation/openapi-fixture-wizard

One interactive run through the whole pipeline: types → fixture → diff → AI fill → merge.

It calls the other five packages in-process and asks every question on stderr. Each step is optional after the fixture is generated, so a run can stop after the generated files, after the diff, after the AI fill, or after the merge.

## What it does

- **Generates** `<schema>.fixture.json` and, for the `ts` and `both` formats, `<schema>.spec.json`, `<schema>.d.ts` and a typed `<schema>.fixture.ts` stub.
- **Targets** a schema by name, or by route: `GET /v1/invoices/{id}` is mapped to the `$ref` of its first `2xx` JSON response (`items.$ref` for list endpoints).
- **Diffs** one existing fixture against the schema, optionally selecting a top-level payload such as `body`, and writes `missing/missing.json`, `missing/missing.d.ts` and `missing/missing.stub.ts` when fields are absent.
- **Fills** the missing fields with a local coding harness (`claude`, `codex`, `antigravity`, `copilot` or `gemini`) into `missing/populated.json`.
- **Merges** the filled values into the existing fixture and validates the result against the spec. Only merged outputs use an endpoint-hashed `.json` filename and a SHA-256 provenance sidecar.

During AI fill, the wizard displays the child process PID and deadline, provider output, and
quiet-period heartbeats on stderr. Gemini assistant text and Copilot response text stream as they
arrive; no second terminal is needed. A heartbeat confirms the process is still running, not that
the remote model is advancing. Progress may contain sensitive, incomplete fixture data; only the
validated result is written to `missing/populated.json`.

Each generation process defaults to **15 minutes**, including a repair attempt. Model discovery
keeps its 2-minute default. For a custom generation limit, use the individual
[`openapi-ai-fixtures` CLI](../openapi-ai-fixtures/README.md#command) with `--timeout <ms>`.

## Quick start

```bash
node packages/openapi-fixture-wizard/dist/cli.js
```

A run against the Stripe spec, checking an existing invoice fixture and filling it with Codex (prompts and answers on stderr):

```text
spec-url: http(s):// or file:// URL of the JSON spec
  e.g. file:///E:/specs/invoice.spec.json
spec-url: https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json
out-dir (Enter to skip): directory receiving every file; defaults to fixtures
  e.g. fixtures
out-dir:
target: a key under components.schemas, or a route whose JSON response references one
  e.g. invoice, or GET /v1/invoices/{id}
target: GET /v1/invoices/{id}
format: json writes <schema>.fixture.json; ts adds <schema>.spec.json, <schema>.d.ts and a typed stub
  1) json
  2) ts
  3) both
format: 3
existing-fixture (Enter to skip): JSON fixture to check for missing fields; Enter ends the run after generation
  e.g. invoice.fixture.json
existing-fixture: invoice.json
object-shape (Enter to skip): top-level fixture property to compare and merge; Enter uses the whole object
  e.g. body
object-shape:
required-only (y/N): report only missing required fields
required-only:
3 missing field(s): amount_due, status, memo
fill-with-ai (y/N): ask a local coding harness to fill the missing fields
fill-with-ai: y
tool: installed coding harness to run
  1) claude
  2) codex
  3) antigravity
  4) copilot
  5) gemini
tool: 2
codex models:
  0) harness default
  1) gpt-5.5
  2) gpt-5.3-codex-spark
model number: 1
extra-prompt (Enter to skip): what the missing values should describe; Enter keeps the default scenario
  e.g. an open invoice for 4200 cents
extra-prompt:
merge (y/N): merge the filled values into the existing fixture and validate the result
merge: y
endpoint-url: endpoint identity whose SHA-1 Base64 name (with / replaced by x) names the merged JSON and provenance
  e.g. GET, custodies/v2
endpoint-url: https://api.stripe.com/v1/invoices/in_1
subdirectory (Enter to skip): optional endpoint prefix for hashing; Enter keeps the endpoint identity unchanged
  e.g. savings (GET, custodies/v2 becomes GET, savings/custodies/v2)
subdirectory:
filled 3 path(s)
wrote E:\work\fixtures\invoice.spec.json
wrote E:\work\fixtures\invoice.d.ts
wrote E:\work\fixtures\invoice.fixture.json
wrote E:\work\fixtures\invoice.fixture.ts
wrote E:\work\fixtures\missing\missing.json
wrote E:\work\fixtures\missing\missing.d.ts
wrote E:\work\fixtures\missing\missing.stub.ts
wrote E:\work\fixtures\missing\populated.json
wrote E:\work\fixtures\VtG1yi3hV6d7VOQZTf4OuvUuyfM=.json
wrote E:\work\fixtures\VtG1yi3hV6d7VOQZTf4OuvUuyfM=.provenance.json
```

## Prompts

There are no flags. `-h` / `--help` prints the list below and exits 0.

| Prompt             | Kind     | What it asks                                                                                  |
| ------------------ | -------- | --------------------------------------------------------------------------------------------- |
| `spec-url`         | required | `http(s)://` or `file://` URL of the JSON spec.                                               |
| `out-dir`          | optional | Directory receiving every file. Enter = `fixtures`.                                           |
| `target`           | required | A key under `components.schemas`, or `VERB /path` of a route whose JSON response is a `$ref`. |
| `format`           | choice   | `1) json` `2) ts` `3) both`.                                                                  |
| `existing-fixture` | optional | JSON fixture to check. Enter ends the run after generation.                                   |
| `object-shape`     | optional | Top-level property to compare and merge, e.g. `body`. Enter uses the entire fixture.          |
| `required-only`    | y/N      | Diff only required fields.                                                                    |
| `fill-with-ai`     | y/N      | Asked only when the diff found missing fields.                                                |
| `tool`             | choice   | `1) claude` `2) codex` `3) antigravity` `4) copilot` `5) gemini`.                             |
| `model number`     | choice   | Models the harness offers; `0` keeps the harness default.                                     |
| `extra-prompt`     | optional | Scenario for the missing values. Enter keeps the default missing-field scenario.              |
| `merge`            | y/N      | Merge the filled values into the existing fixture.                                            |
| `endpoint-url`     | required | Asked only after accepting merge. Endpoint identity: a URL or `METHOD, path`.                 |
| `subdirectory`     | optional | Prefix inserted into the endpoint path before hashing. Enter keeps the identity unchanged.    |

Every required prompt and every choice allows three attempts before the run fails.

`object-shape` is asked once and reused by the merge. With `body`, the existing fixture
must have a `body` property. Missing paths are reported as `body.amount_due`, and the
missing schema and AI-filled JSON retain the `body` wrapper. Merge fills and validates
only that payload; sibling fields such as `statusCode` and `headers` remain unchanged.
The shape is one literal top-level key, not a dotted path.

## Files written

All paths are under `<out-dir>`. The run ends with one `wrote <file>` line per file on stderr.

| Step          | Files                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `ts`/`both`   | `<schema>.spec.json` (pruned to the reachable schemas, carries `x-root-schema`), `<schema>.d.ts` |
| `json`/`both` | `<schema>.fixture.json`                                                                          |
| `ts`/`both`   | `<schema>.fixture.ts` (stub importing `<schema>.d.ts`)                                           |
| diff          | `missing/missing.json`, `missing/missing.d.ts`, `missing/missing.stub.ts`                        |
| AI fill       | `missing/populated.json`                                                                         |
| merge         | `<hash>.json`, validated against the spec, and `<hash>.provenance.json`                          |

`<hash>` is SHA-1 of the endpoint identity's UTF-8 bytes, encoded as standard Base64 with every `/` replaced by lowercase `x`; `+` and `=` are retained. With a blank subdirectory the identity is unchanged and is not inferred from the spec URL, schema, or route. With `endpoint-url: GET, custodies/v2` and `subdirectory: savings`, the exact hash input is `GET, savings/custodies/v2`, producing `SyDyiBXH0INxJLx3y+UqNPhAJKc=.json`. Leading/trailing subdirectory slashes and leading endpoint slashes are removed at the join. The merged fixture stays plain JSON. Its sidecar records the effective identity as `endpointUrl` and a lowercase hexadecimal `sha256` checksum of the exact merged file bytes, including the final newline. Repeating an identity overwrites the same pair of files; changing content changes the checksum, not the name.

The sidecar is a content fingerprint and a declared endpoint association, not a signed origin attestation. It stores the endpoint URL in plain text; do not include credentials or secret query parameters.

If AI returns invalid JSON, the wizard saves its exact response to
`missing/populated.json.failed-attempt-1.txt` before asking the same agent to repair it.
The repair includes the failed text, parser error, and original request. If the second
response fails parsing or schema validation, it is saved as `failed-attempt-2.txt`
with the same `populated.json.` prefix, and the wizard stops before merging.
Paths are printed on stderr; existing diagnostics get a UUID-suffixed alternative
rather than being overwritten. A successful repair keeps the first diagnostic and
writes only the validated result to `populated.json`.

## Errors

| You see                                      | It means                                                           | Fix                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `the wizard needs a terminal`                | stdin is not a TTY (pipe, redirect, CI).                           | Run it in a terminal, or run the individual CLIs instead.                       |
| `<route> has no named response schema`       | The route's JSON response is inline, `oneOf`/`allOf`, or not JSON. | Answer the schema name instead, e.g. `invoice`.                                 |
| `route not found in the spec: <route>`       | No such path/verb under `paths`.                                   | Check the verb and path, or answer the schema name.                             |
| `schema not found: <name>`                   | `target` is not a key under `components.schemas`.                  | The fix line suggests close names or lists what exists.                         |
| `no <prompt> chosen after 3 attempts`        | Three unusable answers to a numbered choice.                       | Answer a number from the list.                                                  |
| `no <prompt> given after 3 attempts`         | Three blank answers to a required prompt.                          | Answer the prompt.                                                              |
| `merged fixture violates schema "<name>": …` | The AI-filled values fail validation.                              | Fix `missing/populated.json` and merge with `openapi-fixture-merge`, or re-run. |
| Any other error                              | See the shared error format and exit codes.                        | [Root README](../../README.md#rules-every-tool-shares).                         |

## Library

```ts
import { runWizard } from '@fixture-automation/openapi-fixture-wizard';
import { promptedInputs } from '@fixture-automation/openapi-fixtures';

await runWizard(promptedInputs());
```

- `runWizard(inputs: Inputs, deps?: WizardDeps): Promise<void>` — asks every prompt through `inputs`, runs the steps the answers select, and lists each written file on stderr. `deps` injects `question` (the terminal reader), `discover` (model discovery) and `fill` (the AI harness); the defaults are the real ones, so tests pass fakes.
- `resolveTarget(spec: OpenApiSpec, answer: string): string` — a checked schema name, or the schema a `VERB /path` answer's JSON response references.
- Types: `WizardDeps`, `WizardFormat`.

## Gotchas

- **Interactive only.** There are no flags; a pipe or CI run gets `the wizard needs a terminal`. Script the individual CLIs instead.
- **One existing fixture per run.** Diff, fill and merge apply to the single `existing-fixture` answer.
- **Routes resolve through `$ref` only.** `$ref` and `items.$ref` on the first `2xx` (else `default`) `application/json` response are understood; anything else needs the schema name.
- **Prompts go to stderr.** `... > out` still runs interactively; only stdin needs to be a terminal.
- **Enrichment of the generated fixture is not a step.** Use `openapi-ai-fixtures --scenario` on `<schema>.fixture.json` for that.

## Develop

```bash
pnpm exec nx run @fixture-automation/openapi-fixture-wizard:test
pnpm exec nx run @fixture-automation/openapi-fixture-wizard:build
pnpm run lint
```

- `src/data-access/wizard.client.ts` sequences the prompts and steps.
- `src/data-access/generate.client.ts`, `diff.client.ts`, `fill.client.ts` own one step each.
- `src/data-access/choose.client.ts` is the numbered-list prompt; `src/utils/choice.util.ts` parses the answer.
- `src/utils/route-schema.util.ts` maps a route answer to its response schema.
- `src/common/wizard.const.ts` holds every prompt text; `src/common/wizard.type.ts` the types.
- `src/index.ts` is the public entry point; `src/cli.ts` is the CLI.
