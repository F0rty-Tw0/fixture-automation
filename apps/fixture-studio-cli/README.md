# fixture-studio

Fixture Studio in one command: load an OpenAPI spec in your browser, browse its endpoints, and generate, fill, diff and merge typed fixtures.

## Usage

Requires Node.js 24.3.0 or newer.

```bash
npx fixture-studio
```

It prints `Fixture Studio: http://127.0.0.1:3333` and opens that URL in your default browser.

| Flag         | Effect                                     |
| ------------ | ------------------------------------------ |
| `--port <n>` | Listen on port `n` instead of `3333`.      |
| `--no-open`  | Print the URL without opening the browser. |

## Environment variables

| Variable                    | Default | Meaning                                                                                       |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `STUDIO_API_PORT`           | `3333`  | Port, integer 1–65535. `--port` wins over it.                                                 |
| `STUDIO_ALLOWED_ORIGINS`    | unset   | Comma-separated extra browser origins allowed to call the API.                                |
| `STUDIO_COMPUTE_TIMEOUT_MS` | `15000` | Time budget per spec task in a worker. Over budget, the request fails with `422`.             |
| `STUDIO_AI_MOCK`            | unset   | `1` = AI fill answers with canned progress and sampled values; no AI CLI runs, nothing costs. |

## Local only

The server binds to `127.0.0.1` and refuses requests whose `Host` or `Origin` is not one of its own loopback addresses (or an origin from `STUDIO_ALLOWED_ORIGINS`). It is not meant to be exposed on a network.

## AI fill

AI fill runs a locally installed AI CLI with your existing login: `claude`, `codex`, `gemini`, `copilot` or `agy` (Antigravity). Without one on your `PATH`, everything else still works. Real AI runs can cost money; set `STUDIO_AI_MOCK=1` to try the flow for free.

## Maintainers

Build the tarball from the workspace root with `pnpm studio:pack` (writes `dist/fixture-studio-0.1.0.tgz`). Publish with `pnpm publish` from `apps/fixture-studio-cli`, never `npm publish`: only pnpm rewrites the `catalog:` dependency specifiers to real versions.

## License

MIT. Bundled third-party code is listed in `dist/THIRD-PARTY-LICENSES.txt` and `dist/ui/3rdpartylicenses.txt`.
