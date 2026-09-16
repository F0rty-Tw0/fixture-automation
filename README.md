# Fixture automation

Turn an OpenAPI spec into typed, validated test fixtures, with optional AI fill for the fields you corrupted on purpose.

## Pipeline

```
spec (URL) ──┬──> types            (openapi-types, optional)
             └──> fixture ──> corrupt ──> diff ──> AI fill ──> merge ──> validated fixture
                  (openapi-fixtures)   (openapi-fixture-diff)  (openapi-ai-fixtures)  (openapi-fixture-merge)
```

Types are a side branch: generate them whenever you want a typed stub, independent of the corrupt/diff/merge loop.

## Choose a package

| Task                                                    | Package                          | Docs                                                                                                                                                                                                       |
| ------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generate `paths` / `components` TypeScript declarations | `openapi-types`                  | [`./packages/openapi-types/README.md`](./packages/openapi-types/README.md)                                                                                                                                 |
| Sample a deterministic fixture from a schema            | `openapi-fixtures`               | [`./packages/openapi-fixtures/README.md`](./packages/openapi-fixtures/README.md)                                                                                                                           |
| Drop fields from a fixture on purpose                   | `openapi-fixture-diff` (corrupt) | [`./packages/openapi-fixture-diff/README.md`](./packages/openapi-fixture-diff/README.md)                                                                                                                   |
| Find what a corrupt fixture is missing                  | `openapi-fixture-diff` (diff)    | [`./packages/openapi-fixture-diff/README.md`](./packages/openapi-fixture-diff/README.md)                                                                                                                   |
| Fill missing/whole fixtures with an AI coding CLI       | `openapi-ai-fixtures`            | [`./packages/openapi-ai-fixtures/README.md`](./packages/openapi-ai-fixtures/README.md), providers + security: [`./packages/openapi-ai-fixtures/PROVIDERS.md`](./packages/openapi-ai-fixtures/PROVIDERS.md) |
| Merge filled fields back and validate                   | `openapi-fixture-merge`          | [`./packages/openapi-fixture-merge/README.md`](./packages/openapi-fixture-merge/README.md)                                                                                                                 |

## Setup

Needs Node.js **24.3.0+** and **pnpm 10.33.0** (pinned in [package.json](./package.json)).

```bash
pnpm install --frozen-lockfile
pnpm run build
```

Each package's CLI lands at `packages/<name>/dist/cli.js`.

## Rules every tool shares

**Spec is a URL, not a path.** `http://`, `https://`, or `file://`. A bare filesystem path is rejected.

Print a `file://` URL for a local spec (works in bash and PowerShell):

```bash
SPEC=$(node -p "require('node:url').pathToFileURL('packages/openapi-fixtures/src/test/fixtures/invoice/spec.json').href")
```

**JSON only, except types.** `openapi-fixtures`, `openapi-fixture-diff`, `openapi-fixture-merge`, and `openapi-ai-fixtures` read JSON specs. `openapi-types` also accepts YAML.

**Every tool has `--help`.** Prints the full flag reference and exits `0`.

**Exit codes.** `0` on success, `1` on any failure.

**Errors are 3 lines, to stderr:**

```
<tool>: <what was wrong>
  fix: <what to do>          ← only when the tool knows a fix
  see: <tool> --help
```

Real example:

```
$ node packages/openapi-fixtures/dist/cli.js invoice.fixture.json invoice
openapi-fixtures: spec must be a URL, got bare path "invoice.fixture.json"
  fix: use file:///E:/fixture-automation/invoice.fixture.json
  see: openapi-fixtures --help
```

No stack trace on a handled error. **Normal output is never written on failure** if the failure happens before the write step (bad args, bad spec, schema not found, failed validation all leave any existing destination file untouched). AI generation can save separate failed-response diagnostics for manual repair; see [AI failure behavior](./packages/openapi-ai-fixtures/README.md#validation-and-failure-behavior).

## Full pipeline walkthrough

Stripe's public spec, schema `invoice`. Run from the repo root. You name the schema once, in step 1; every later tool reads it from the pruned spec.

```bash
SPEC=https://raw.githubusercontent.com/stripe/openapi/master/latest/openapi.spec3.json
```

1. **Generate types and a pruned spec.**

   ```bash
   node packages/openapi-types/dist/cli.js $SPEC invoice tmp/invoice.d.ts        # also writes tmp/invoice.spec.json
   LOCAL=$(node -p "require('node:url').pathToFileURL('tmp/invoice.spec.json').href")
   ```

   Writes `tmp/invoice.d.ts` (only the components reachable from `invoice`, about 2.5 MB instead of 5 MB) and `tmp/invoice.spec.json` (the pruned spec, about 1 MB instead of 4.5 MB, tagged `"x-root-schema": "invoice"`). `$LOCAL` is its `file://` URL.

2. **Sample a baseline, JSON and typed stub.**

   ```bash
   node packages/openapi-fixtures/dist/cli.js $LOCAL tmp/invoice.json
   node packages/openapi-fixtures/dist/cli.js $LOCAL tmp/invoice.stub.ts --ts tmp/invoice.d.ts
   ```

   Writes `tmp/invoice.json` (78 top-level keys) and `tmp/invoice.stub.ts`. Add `--required-only` for the 30 required fields only.

3. **Corrupt it.**

   ```bash
   node packages/openapi-fixture-diff/dist/cli.js corrupt tmp/invoice.json tmp/corrupt.json --drop 'currency,total,customer,issuer.type,lines.data[0].id,status_transitions.paid_at'
   ```

   Writes `tmp/corrupt.json` with those 6 paths removed. `tmp/invoice.json` is untouched.

4. **Diff against the schema.**

   ```bash
   node packages/openapi-fixture-diff/dist/cli.js diff $LOCAL --fixture tmp/corrupt.json --out-dir tmp
   ```

   Writes `tmp/missing.json` (schema projection of the 6 gaps, under 20 KB), `tmp/missing.d.ts`, `tmp/missing.stub.ts`.

5. **List models for your AI tool** (optional).

   ```bash
   node packages/openapi-ai-fixtures/dist/cli.js --list-models --tool codex
   ```

6. **Fill the gaps with AI.**

   ```bash
   node packages/openapi-ai-fixtures/dist/cli.js tmp/populated.stub.ts --fixture tmp/corrupt.json --missing tmp/missing.json --tool codex --model default --ts tmp/missing.d.ts
   ```

   No spec URL or schema name: `tmp/missing.json` carries both. Calls a live model. **Nondeterministic and costs money.** Writes `tmp/populated.stub.ts`, a typed stub of just the filled fields.

   For an offline variant with no AI call, hand-write the missing fields into a `.json` or `.ts` file matching `tmp/missing.json`'s shape and skip to step 7. See [`./packages/openapi-fixture-diff/README.md`](./packages/openapi-fixture-diff/README.md) and [`./packages/openapi-fixture-merge/README.md`](./packages/openapi-fixture-merge/README.md).

7. **Merge and validate.**

   ```bash
   node packages/openapi-fixture-merge/dist/cli.js tmp/corrupt.json tmp/populated.stub.ts tmp/invoice.fixed.json --spec $LOCAL
   ```

   Fills only the absent keys, validates the merged result against `invoice` (read from the pruned spec), writes `tmp/invoice.fixed.json`. Stderr reports how many paths got filled.

**Explicit forms still work.** Every tool accepts the schema name spelled out, against the full spec or the pruned one: `openapi-fixtures $SPEC invoice tmp/invoice.json`, `diff $SPEC invoice --fixture …`, `openapi-ai-fixtures $SPEC invoice tmp/populated.stub.ts --missing …` (spec and name ignored), `openapi-fixture-merge … --spec $SPEC --schema invoice`.

## AI providers and security

- **Scratch directory is not a sandbox.** Provider-specific tool restrictions do not fully isolate an untrusted executable.
- **Credentials are inherited.** User credentials and parts of provider configuration stay available to the child process.
- **Gemini's MCP-disable setting is ineffective** in the reviewed release (v0.59.0).
- **Antigravity, Copilot, and Gemini are documentation-only reviews**, not exercised live generation passes. Only Claude and Codex have live runs recorded.
- One AI call touches one provider: `claude`, `codex`, `antigravity` (binary `agy`), `copilot`, or `gemini`. No install, no auth, no provider fallback.

Full contracts, defects, and the verification record: [`./packages/openapi-ai-fixtures/PROVIDERS.md`](./packages/openapi-ai-fixtures/PROVIDERS.md).

## Develop

```bash
pnpm run build          # nx run-many -t build
pnpm run typecheck       # tsc on tools + nx run-many -t typecheck
pnpm run test            # nx run-many -t test
pnpm run lint             # eslint . --max-warnings=0
pnpm run format:check    # prettier --check .
```

One package, Nx project name:

```bash
pnpm exec nx run @fixture-automation/openapi-fixtures:build
pnpm exec nx run @fixture-automation/openapi-fixtures:test
```

Root `stripe.d.ts` fails lint and format checks; it's a large generated file outside the TypeScript project, left unchanged on purpose.
