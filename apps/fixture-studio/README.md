# @fixture-automation/fixture-studio

A visual app over the fixture pipeline: load a spec, pick endpoints, generate fixtures, compare an existing one, fill its gaps with AI, merge, export.

It talks to the local [Fixture Studio API](../fixture-studio-api/README.md). Nothing is uploaded or stored.

## What it does

One page, six steps on a rail. Each step's heading folds it away; the active step opens by itself.

1. **Spec** — load an OpenAPI JSON spec from an `http(s)` URL, or drop a local `.json` file.
2. **Endpoints** — filter by path, tag, or method; pick one or more; optional "Required fields only".
3. **Generate** — one tab per endpoint; each format is a folding section: JSON fixture (`.json`), typed TS stub (`.stub.ts`), types (`.d.ts`). The chosen tab is the endpoint steps 4–6 follow.
4. **Compare** — drop or paste an existing fixture. The envelope property (e.g. `data`) is detected and preselected; change it to compare again. The diff has a change map beside it: click a mark, or use Previous/Next change.
5. **Missing & broken values** — the missing paths, grouped by their first key, and the present values that are broken (path, value, reason). Fix broken values (AI fill rewrites them) or keep them. Then **Continue to AI fill**.
6. **Fill with AI** — an optional extra prompt (scenario), then fill; the answer streams into the log as one block, and the result is merged and validated against the schema.

Every step keeps its state per endpoint. Copy or Export (download) any document. Long lists, logs, and editors scroll inside their own box.

Built with Angular 22 (zoneless, signals, signal forms), Angular Material 3, and CodeMirror 6 for the code and diff views.

## Quick start

From the repo root:

```bash
pnpm install --frozen-lockfile
pnpm studio
```

`pnpm studio` starts both apps (`nx run-many -t serve`):

| App | URL                     | Notes                                                              |
| --- | ----------------------- | ------------------------------------------------------------------ |
| UI  | `http://localhost:4200` | Open this one. `/api` calls are proxied to the API.                |
| API | `http://127.0.0.1:3333` | Local only. See the [API README](../fixture-studio-api/README.md). |

**No paid AI runs** while you try it:

```bash
STUDIO_AI_MOCK=1 pnpm studio
```

AI fill then answers with canned progress and sampled values instead of launching a CLI.

Real start-up output (trimmed):

```text
[10:28:52] WARN (33328 on Forty-Two): STUDIO_AI_MOCK=1: AI routes answer with canned progress and sampled values; no CLI runs
[10:28:52] INFO (33328 on Forty-Two): Server listening at http://127.0.0.1:3333
...
Application bundle generation complete. [27.744 seconds] - 2026-09-25T08:29:27.230Z
...
  ➜  Local:   http://localhost:4200/
```

The UI is ready at the `Local:` line. The first build takes about 30 s.

**Stop it** when done. Leftover servers cause false 500s — see [Gotchas](#gotchas).

## Local files

- **Read in the browser.** A dropped spec or fixture never leaves as a file. Only the parsed value goes to the API.
- **Spec:** `.json` only.
- **Existing fixture:** `.json`, `.ts`, `.js`, `.mts`, `.cts`, or pasted text.
- **`.ts`/`.js` fixtures are never run.** A literals-only reader (objects, arrays, strings, numbers, booleans, `null`) pulls out the value. Anything else is rejected.
- **Which value:** `export default …` first, else the first exported `const`, else the first `const` with a value.
- **The reader loads on first use.** It needs the TypeScript compiler: a lazy chunk of 3.58 MB (~798 kB gzipped) in the production build, fetched only when you read a `.ts`/`.js` fixture.

## AI fill

Two providers. The studio picks one for you:

| Provider            | Where it runs                                                           | Chosen when                                                                         |
| ------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Local CLI           | The API launches one CLI and streams its output (NDJSON).               | Default. Also whenever Chrome AI is off or can't run here.                          |
| On-device Chrome AI | Gemini Nano inside Chrome (the Prompt API). Nothing leaves the machine. | "Use on-device Chrome AI" is ticked **and** Chrome doesn't report it `unavailable`. |

**CLIs:** `claude`, `codex`, `antigravity`, `copilot`, `gemini`. They use your existing login. **Paid** unless `STUDIO_AI_MOCK=1`. Provider details: [`PROVIDERS.md`](../../packages/openapi-ai-fixtures/PROVIDERS.md).

**CLI picker:**

- A CLI the API can't find on its `PATH` is listed but disabled, marked "not installed". If the chosen one is missing, the first installed CLI is picked.
- No CLI on `PATH` → "No AI CLI found on PATH", and Fill stays disabled.
- Model discovery failed → its error shows under the Model field, with **Retry**.
- `STUDIO_AI_MOCK=1` on the API → a "Mock AI — no CLI runs" badge next to "Local CLI".

**Chrome AI opt-in:**

- **Off** by default.
- Remembered per browser in `localStorage` (key `fixture-studio.use-chrome-ai`).
- The panel shows Chrome AI's state: `Ready`, `Model not downloaded yet`, `Downloading the model`, or `Not available in this browser`.
- No model yet → **Download model** downloads it once, with a progress bar. Fill stays disabled until the model is ready; a fill never starts the download.

### Chrome AI limits

Measured by the team lead on Chrome 153, 2026-09-25. Other Chrome versions may differ.

| Limit                | Measured                                                                                                                                                                                   | What the studio does                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Context window       | 9,216 tokens (~3.7 characters per token).                                                                                                                                                  | Keeps each prompt to 75% of the window, leaving the rest for the answer. Chunks if needed (below). |
| String `format`      | `responseConstraint` (the answer schema) rejects any `format` except `date`, `date-time`, `duration`, `email`, `hostname`, `ipv4`, `ipv6`, `time`, `uri`, `uuid` with `NotSupportedError`. | The API drops every other `format` from the answer schema.                                         |
| Schema in the prompt | The prompt already carries the schema.                                                                                                                                                     | Sends `omitResponseConstraintInput: true` so Chrome doesn't add it twice.                          |
| Invented keys        | —                                                                                                                                                                                          | Every object on a missing path is closed (`additionalProperties: false`).                          |
| Ignored rules        | Nano sometimes ignores `pattern` and numeric bounds.                                                                                                                                       | Merge validation still catches it and lists the errors.                                            |
| Hidden tab           | Starting the model or generating can slow down a lot, or stall, while the tab is hidden.                                                                                                   | Keep the tab in front during a fill.                                                               |

If this Chrome rejects the answer schema anyway, the studio logs "This Chrome rejected the response schema; asking again without it." and asks once more without it.

**Hardware.** Chrome's built-in AI needs a supported desktop and a model download. Requirements: [developer.chrome.com/docs/ai/get-started](https://developer.chrome.com/docs/ai/get-started).

### Chunked fill

A big fixture doesn't fit Nano's window. The studio tries smaller prompts in this order:

1. **Whole fixture** in one prompt.
2. **Trimmed baseline**: only the missing paths, plus the fixture's root primitives and the primitives along each path's parents. Arrays on those paths keep their length.
3. **Halves**: split the missing paths in two and fill each half on its own, recursively. Answers are merged.
4. **One path still too large** → "This fixture is too large for the on-device model." Use the CLI.

Real example (lead's measurement): a Stripe invoice with 22 missing paths.

- Full prompt: 12,672 tokens → doesn't fit.
- Trimmed: 5,781 tokens → one prompt, ~40 s.
- Merge: valid, 22/22 filled.

## Errors

Errors show in the panel with a fix line. API errors keep the API's message and fix; the [API README](../fixture-studio-api/README.md#errors) lists them.

| You see                                                                                 | It means                                                                                 | Fix                                                                 |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `This fixture is too large for the on-device model.`                                    | Even one missing path doesn't fit Nano's window, or Chrome ran out of quota.             | Untick "Use on-device Chrome AI"; the local CLI fills it.           |
| `This browser has no on-device Chrome AI.`                                              | No `LanguageModel` (Prompt API) in this browser.                                         | Untick "Use on-device Chrome AI", or use a Chrome that supports it. |
| `The on-device model answered with text that is not JSON.`                              | Nano's answer didn't parse.                                                              | Run it again, or untick "Use on-device Chrome AI".                  |
| `<file> is not valid JSON.`                                                             | A `.json` file or pasted text didn't parse.                                              | Fix the JSON, or drop a `.ts` file instead.                         |
| `Line <n>: a function call can't be read without running the file; use plain literals.` | The `.ts`/`.js` fixture uses a call, spread, `${…}` template, shorthand or computed key. | Replace it with a plain literal value.                              |
| ``<file> has no `export const` or `export default` with a value.``                      | The `.ts`/`.js` file declares no value at all.                                           | Add `export const fixture = { … }` or `export default { … }`.       |
| Merge result lists schema errors (e.g. `/total: must be integer`)                       | The filled values break the schema.                                                      | Fill again, or fix the values by hand.                              |
| `spec not found`                                                                        | The API restarted or dropped the spec (it keeps the last 5).                             | Load the spec again.                                                |
| `spec too expensive to sample/validate`                                                 | The endpoint's schema took over the API's 15 s budget.                                   | Pick another endpoint, or raise `STUDIO_COMPUTE_TIMEOUT_MS`.        |

## Gotchas

- **Stop every dev server you start.** Leftover `pnpm studio` trees on Windows cause false 500s. Kill commands: [API README gotchas](../fixture-studio-api/README.md#gotchas).
- **"Recursive task invocation detected"** = stale Nx records from a force-killed run. Re-run, or `pnpm nx reset`.
- **Never run two e2e targets at once.** They share port 4300 and one results folder.
- **Keep the tab visible** during a Chrome AI fill; a hidden tab stalls generation.
- **Mock AI fills only the first array element.** Later missing indexes stay empty, so the merge reports `valid: false`.
- **Vitest reads workspace packages from `dist`.** After changing a package export, run `pnpm typecheck` so the tests see it.

## Develop

```bash
pnpm nx run @fixture-automation/fixture-studio:test    # unit tests (Vitest)
pnpm nx run @fixture-automation/fixture-studio:build   # production build → dist/apps/fixture-studio
pnpm typecheck
pnpm lint                                              # eslint + stylelint
```

**e2e** (Playwright, config `e2e/playwright.config.ts`):

| Target            | Command                                                          | What it runs                                                     |
| ----------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `e2e`             | `pnpm nx run @fixture-automation/fixture-studio:e2e`             | Every flow against a mocked API (routes stubbed in the browser). |
| `e2e-live`        | `pnpm nx run @fixture-automation/fixture-studio:e2e-live`        | UI + real API on port 3334 with `STUDIO_AI_MOCK=1`.              |
| `e2e-screenshots` | `pnpm nx run @fixture-automation/fixture-studio:e2e-screenshots` | Captures screenshots into `e2e/screenshots/`.                    |

- All three start their own UI on `http://127.0.0.1:4300`, so a running `pnpm studio` never answers a test.
- Reports land in `dist/.playwright/fixture-studio/`.

**Layout** (`src/app/studio/`):

- `feature/` — the steps and panels (spec, endpoints, workspace, compare, AI fill).
- `ui/` — presentational pieces (code view, endpoint list, file drop, progress log).
- `data-access/` — stores, the HTTP engine, the Chrome AI provider.
- `domain-logic/` — services that tie stores to the engine.
- `utils/` — pure helpers, including the `.ts` literal reader.

The UI calls the API only through the `StudioEngine` port (`STUDIO_ENGINE` token). `HttpStudioEngine` is today's implementation.
