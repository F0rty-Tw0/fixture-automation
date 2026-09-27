# @fixture-automation/fixture-studio-api

Local HTTP API behind [Fixture Studio](../fixture-studio/README.md). It runs the fixture pipeline packages for the browser.

**Local only.** It listens on `127.0.0.1:3333` and refuses other hosts, origins, and cross-site requests.

## What it does

- **Loads** an OpenAPI spec from an `http(s)` URL or from a JSON document the browser sends. It keeps the last 5 specs in memory.
- **Lists** the spec's endpoints with their response schema name.
- **Generates** a JSON fixture, a typed TS stub (`.stub.ts`), and types (`.d.ts`) per endpoint.
- **Diffs** an existing fixture against the schema: what's missing, plus a complete version.
- **Builds** an AI prompt and a response schema for on-device Chrome AI (`ai-prompt`).
- **Fills** missing fields with a local AI coding CLI, streamed as NDJSON (newline-delimited JSON, one event per line).
- **Merges** filled values into the fixture and validates the result.

Built with Fastify 5. Request bodies, params, and queries are validated against a zod contract in [`src/contract`](./src/contract) (shared with the UI).

Spec work (sampling, diff, merge validation, AI-fill output validation) runs in `worker_threads` (separate Node threads), so a slow schema can't freeze the API.

## Quick start

From the repo root:

```bash
pnpm install --frozen-lockfile
STUDIO_AI_MOCK=1 pnpm studio
```

`pnpm studio` starts this API and the UI together (`nx run-many -t serve`). Output from a real run (trimmed):

```text
> nx run @fixture-automation/fixture-studio-api:serve

[10:28:52] WARN (33328 on Forty-Two): STUDIO_AI_MOCK=1: AI routes answer with canned progress and sampled values; no CLI runs
[10:28:52] INFO (33328 on Forty-Two): Server listening at http://127.0.0.1:3333
...
  ➜  Local:   http://localhost:4200/
```

The `serve` target runs `node --watch-path=…` (Node's built-in restart-on-change), so the API restarts when its source or a workspace package's `src` changes.

**API alone,** no watch mode (what the e2e `live` project does):

```bash
STUDIO_AI_MOCK=1 node --conditions=@fixture-automation/source apps/fixture-studio-api/src/main.ts
```

`--conditions=@fixture-automation/source` makes workspace packages resolve to their TypeScript `src`, not their built `dist`.

**Stop it** when done. See [Gotchas](#gotchas) for leftover processes on Windows.

## Configuration

Environment variables, read once at start-up. An invalid value stops the API before it listens (exit `1`).

| Variable                    | Default                                          | What it does                                                                                                            |
| --------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `STUDIO_API_PORT`           | `3333`                                           | Port on `127.0.0.1`. Integer 1–65535. The UI dev proxy (`apps/fixture-studio/proxy.conf.json`) expects `3333`.          |
| `STUDIO_ALLOWED_ORIGINS`    | `http://localhost:4200`, `http://127.0.0.1:4200` | Comma-separated extra browser origins. Added to the defaults, never replacing them. Each must be an `http(s)` URL.      |
| `STUDIO_COMPUTE_TIMEOUT_MS` | `15000`                                          | Time budget per spec task in a worker. Integer 1–2147483647. Over budget → `422 spec too expensive to sample/validate`. |
| `STUDIO_AI_MOCK`            | unset                                            | `1` = AI routes answer with canned progress and sampled values. No CLI runs, no cost.                                   |
| `NODE_ENV`                  | unset                                            | `production` = plain JSON logs at `info`. Otherwise pretty logs at `debug`.                                             |

Blank values count as unset.

## Routes

All routes live under `/api`. Errors answer `{ "message": "...", "fix": "..." }` (`fix` only when known).

| Method + path                        | What it does                                                                                                                                                                                                                                                                                        | Body limit |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `POST /api/specs`                    | Load `{ "url": "https://…" }` or `{ "document": {…} }`. Returns `specId` and endpoints.                                                                                                                                                                                                             | 20 MB      |
| `POST /api/specs/:specId/generate`   | Sample fixtures: `endpointIds`, `formats` (`json`, `stub`, `types`), `requiredOnly`.                                                                                                                                                                                                                | default    |
| `POST /api/specs/:specId/diff`       | What a fixture lacks: `missing` projection, `missingPaths`, `replacedPaths`, `baseline`, `completeJson`. `replacePlaceholders` (default `true`) also refills present values that break the schema or are openapi-sampler defaults; send `baseline`, not the original fixture, to AI fill and merge. | 4 MB       |
| `POST /api/specs/:specId/ai-prompt`  | Prompt + response schema for an on-device model. Optional `paths` asks for a chunk.                                                                                                                                                                                                                 | 4 MB       |
| `POST /api/specs/:specId/ai-fill`    | Run one local AI CLI. Streams `application/x-ndjson`: `progress` events, then `result`.                                                                                                                                                                                                             | 4 MB       |
| `POST /api/specs/:specId/merge`      | Fill a fixture from `populated`, validate; optional `original` orders `mergedJson`. Returns `mergedJson`, `filled`, `valid`, `errors`.                                                                                                                                                              | 4 MB       |
| `GET /api/ai/cli/models?tool=<tool>` | Ask an installed CLI for its model IDs.                                                                                                                                                                                                                                                             | —          |
| `GET /api/ai/cli/tools`              | Which CLIs are on the API's `PATH` (`tools[].installed`), and `mock` for `STUDIO_AI_MOCK=1`. Reads files only; starts no CLI.                                                                                                                                                                       | —          |

**AI tools** (`tool`): `claude`, `codex`, `antigravity`, `copilot`, `gemini` (`AI_TOOLS` in [`src/contract/studio-api.schema.ts`](./src/contract/studio-api.schema.ts)).

**Paid.** Without `STUDIO_AI_MOCK=1`, `ai-fill` and `ai/cli/models` launch the real CLI with your existing login. That can cost money. `ai/cli/tools` never launches one. Provider details: [`openapi-ai-fixtures/PROVIDERS.md`](../../packages/openapi-ai-fixtures/PROVIDERS.md).

## Examples

Real runs against `STUDIO_AI_MOCK=1 pnpm studio`, using the small test spec in `src/test/fixtures/studio/spec.json`. Run from the repo root.

**1. Load a spec from a local file.** The API never reads files itself (`file://` URLs are refused), so send the document:

```bash
API=http://127.0.0.1:3333/api
SPEC_ID=$(node -e "process.stdout.write(JSON.stringify({document:require('./apps/fixture-studio-api/src/test/fixtures/studio/spec.json')}))" \
  | curl -s -X POST -H 'content-type: application/json' --data-binary @- $API/specs \
  | node -p "JSON.parse(require('fs').readFileSync(0)).specId")
```

The full response lists every endpoint. An endpoint without a named response schema is marked:

```text
{"id":"GET /v1/inline","method":"GET","path":"/v1/inline","tags":[],"schemaName":null,"unsupportedReason":"GET /v1/inline has no named response schema"}
```

**2. Generate a required-only JSON fixture.**

```bash
curl -s -X POST -H 'content-type: application/json' \
  -d '{"endpointIds":["GET /v1/invoices/{id}"],"formats":["json"],"requiredOnly":true}' \
  $API/specs/$SPEC_ID/generate
```

```text
{"fixtures":[{"endpointId":"GET /v1/invoices/{id}","schemaName":"invoice","json":"{\n  \"id\": \"in_123\",\n  \"amount_due\": 0,\n  \"status\": \"draft\"\n}\n"}]}
```

**3. Merge with a wrong type.** Validation catches it; nothing is written anywhere:

```bash
curl -s -X POST -H 'content-type: application/json' \
  -d '{"endpointId":"GET /v1/invoices/{id}","fixture":{"id":"in_1"},"populated":{"amount_due":"x","status":"open"}}' \
  $API/specs/$SPEC_ID/merge
```

```text
{"mergedJson":"{\n  \"id\": \"in_1\",\n  \"amount_due\": \"x\",\n  \"status\": \"open\"\n}\n","filled":["amount_due","status"],"valid":false,"errors":["/amount_due: must be integer"]}
```

**4. Mocked AI fill stream.** The body is the fixture plus the `missing` object from a `diff` response. With `STUDIO_AI_MOCK=1` the stream looks like this:

```text
{"type":"progress","stream":"stdout","text":"mock: reading the missing schema\n"}
{"type":"progress","stream":"stdout","text":"mock: sampling values\n"}
{"type":"progress","stream":"stdout","text":"mock: done\n"}
{"type":"result","populated":{"amount_due":0,"status":"draft"}}
```

**5. Which CLIs are installed.** Free: it only looks for each CLI's executable on `PATH` (`agy` for `antigravity`; each `PATHEXT` extension on Windows). Under `STUDIO_AI_MOCK=1` every tool reads as installed:

```bash
curl -s $API/ai/cli/tools
```

```text
{"tools":[{"tool":"claude","installed":true},{"tool":"codex","installed":true},{"tool":"antigravity","installed":true},{"tool":"copilot","installed":true},{"tool":"gemini","installed":true}],"mock":true}
```

## Security model

The API can launch paid AI CLIs, so it only answers the local Fixture Studio.

| Guard                  | What it does                                                                                                                                                    | Where                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Loopback bind          | Listens on `127.0.0.1` only. Not reachable from the network.                                                                                                    | `src/main.ts`                             |
| `Host` check           | Unknown `Host` → `403 host not allowed`. Stops DNS rebinding (a hostile site pointing its domain at `127.0.0.1`).                                               | `src/utils/request-guard.util.ts`         |
| `Origin` check         | An `Origin` header must be an allowed origin → otherwise `403 origin not allowed`.                                                                              | `src/utils/request-guard.util.ts`         |
| `Sec-Fetch-Site` check | No `Origin`: the browser's `Sec-Fetch-Site` must be `same-origin` or `none` → otherwise `403 cross-site request refused`. curl sends neither header and passes. | `src/utils/request-guard.util.ts`         |
| CLI run cap            | At most 2 AI CLI runs at once (fills and model lookups together) → otherwise `429`.                                                                             | `src/data-access/cli-run-slots.store.ts`  |
| Spec size              | Spec download or document body: 20 MB max. Download also stops after 30 s.                                                                                      | `src/specs.routes.ts`, `openapi-fixtures` |
| Compute budget         | Each spec task runs in a fresh worker: 15 s (`STUDIO_COMPUTE_TIMEOUT_MS`) and 512 MB heap. Over → `422`, worker killed.                                         | `src/data-access/spec-compute.client.ts`  |
| AI output validation   | The CLI's answer is validated in a worker too. A backtracking `pattern` ends in `422`, not a frozen API.                                                        | `src/ai.routes.ts`                        |
| Schema compile first   | The missing schema is compiled in a worker before the CLI starts. A broken schema fails before any paid run.                                                    | `src/ai.routes.ts`                        |
| No local file reads    | `file://` spec URLs are refused (`400 body/url Invalid URL`). Fixtures arrive as parsed JSON from the browser.                                                  | `src/contract/studio-api.schema.ts`       |

Real `403` from a foreign origin:

```bash
curl -s -X POST -H 'Origin: http://evil.example' -H 'content-type: application/json' -d '{}' http://127.0.0.1:3333/api/specs
```

```text
{"message":"origin not allowed","fix":"open Fixture Studio from an allowed origin, or add yours to STUDIO_ALLOWED_ORIGINS"}
```

**Not a sandbox.** A CLI run inherits your credentials. Read [`PROVIDERS.md`](../../packages/openapi-ai-fixtures/PROVIDERS.md) before pointing it at an untrusted spec.

## Errors

**Start-up** (stderr, exit `1`):

| You see                                                                      | It means                             | Fix                                        |
| ---------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------ |
| `STUDIO_API_PORT must be an integer from 1 to 65535, got "abc"`              | Port is not a whole number in range. | Unset it, or set e.g. `3333`.              |
| `STUDIO_COMPUTE_TIMEOUT_MS must be an integer from 1 to 2147483647, got "0"` | Budget is not a positive integer.    | Unset it, or set e.g. `15000`.             |
| `allowed origin "not-a-url" is not a URL`                                    | An origin entry doesn't parse.       | List origins like `http://localhost:4200`. |
| `allowed origin "file:///x" has no http(s) origin`                           | An origin entry isn't `http(s)`.     | Use an `http://` or `https://` origin.     |

Real output:

```text
$ STUDIO_API_PORT=abc node --conditions=@fixture-automation/source apps/fixture-studio-api/src/main.ts
fixture-studio-api: STUDIO_API_PORT must be an integer from 1 to 65535, got "abc"
  fix: unset STUDIO_API_PORT, or set it to e.g. 3333
```

**HTTP** (JSON body `{ message, fix }`):

| Status | You see                                 | It means                                                                                  | Fix                                                                                     |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `403`  | `host not allowed`                      | Request used a `Host` other than loopback or an allowed origin's host.                    | Call `127.0.0.1` or `localhost`, or add the origin to `STUDIO_ALLOWED_ORIGINS`.         |
| `403`  | `origin not allowed`                    | Browser page on an origin that isn't allowed.                                             | Open the studio from `http://localhost:4200`, or add the origin.                        |
| `403`  | `cross-site request refused`            | A cross-site browser request without `Origin` (e.g. `<img src>`).                         | Call the API from Fixture Studio itself.                                                |
| `404`  | `spec not found`                        | `specId` is unknown; only the last 5 specs are kept, and a restart clears them.           | Load the spec again.                                                                    |
| `422`  | `spec too expensive to sample/validate` | The task went over the compute budget or 512 MB (fan-out schema, backtracking `pattern`). | Pick another endpoint, or raise `STUDIO_COMPUTE_TIMEOUT_MS`.                            |
| `429`  | `too many AI CLI runs at once`          | 2 fills or model lookups are already running.                                             | Wait for one to finish.                                                                 |
| `502`  | CLI's own message                       | Model discovery failed.                                                                   | Check the CLI is installed and logged in, or type the model name.                       |
| `500`  | `internal error`                        | Unexpected failure; details are in the API log.                                           | Read the API terminal. Leftover dev servers cause false 500s — see [Gotchas](#gotchas). |

Real `422` (a `^(a+)+$` pattern and a long non-matching value, default 15 s budget):

```text
{"message":"spec too expensive to sample/validate","fix":"pick another endpoint; its schema graph fans out too far or a pattern backtracks, or raise STUDIO_COMPUTE_TIMEOUT_MS"}
```

## Gotchas

- **Stop every server you start.** Leftover `pnpm studio` trees on Windows keep old ports and cause false 500s. Find and kill the listeners (Git Bash):

  ```bash
  netstat -ano | grep LISTENING | grep -E ":(4200|3333) "   # last column = PID
  taskkill //PID <pid> //T //F                              # //T = whole process tree
  ```

  In cmd or PowerShell, use single slashes: `taskkill /PID <pid> /T /F`.

- **"Recursive task invocation detected"** from `pnpm studio` = stale Nx task records from a force-killed run (Windows reuses PIDs). Re-run; if it stays, `pnpm nx reset`.
- **Watch paths are listed by hand.** The `serve` target in [`package.json`](./package.json) names each workspace package's `src` in `--watch-path`. Add one when the API gains a workspace dependency, or its changes won't restart the API.
- **Vitest reads workspace packages from `dist`.** After changing a package export, run `pnpm typecheck` so the API tests see it.
- **Specs live in memory.** A restart (including a watch restart) drops them; the UI then gets `404 spec not found` and must load the spec again.
- **One warm spare worker.** A cold worker costs 1–2 s from source before the budget starts.

## Develop

```bash
pnpm nx run @fixture-automation/fixture-studio-api:test
pnpm typecheck
pnpm lint
```

- `src/main.ts` reads the environment and starts the server; `src/server.ts` builds it (tests use `inject`, no port).
- `src/*.routes.ts` hold the routes; `src/contract/` holds the zod schemas and types the UI imports.
- `src/data-access/` holds the worker pool, spec cache, CLI slots, and the mock AI.
- `src/utils/` holds pure helpers: request guard, env parsing, prompt and response-schema building.

**Test fixtures:**

- `src/test/fixtures/studio/spec.json` — the small spec used above and by the e2e `live` project.
- `src/test/fixtures/stripe-invoice/spec.json` — a modified excerpt of Stripe's OpenAPI spec (`GET /v1/invoices/{invoice}` and the `invoice` schema). **MIT licensed**; its [`LICENSE`](./src/test/fixtures/stripe-invoice/LICENSE) sits beside it and must ship with it.
