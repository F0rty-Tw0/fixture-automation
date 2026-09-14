import type { InputSpec } from '@fixture-automation/openapi-fixtures';

export const AI_FIXTURES_USAGE =
  'usage: <spec-url> [schema-name] [out-file] --fixture <fixture.json> --scenario <text> --tool <claude|codex|antigravity|copilot|gemini>, or [out-file] --fixture <corrupt.json> --missing <missing.json> --tool <name>';

const specUrl: InputSpec = {
  label: 'spec-url',
  description: 'http(s):// or file:// URL of the JSON spec',
  example: 'file:///E:/specs/invoice.spec.json'
};
const fixture: InputSpec = {
  label: '--fixture',
  description: 'existing JSON fixture to enrich',
  example: 'invoice.fixture.json'
};
const scenario: InputSpec = {
  label: '--scenario',
  description: 'what the fixture should describe',
  example: 'an open invoice for 4200 cents'
};
const tool: InputSpec = {
  label: '--tool',
  description: 'claude, codex, antigravity, copilot or gemini',
  example: 'codex'
};
const schemaName: InputSpec = {
  label: 'schema-name',
  description:
    'a key under components.schemas; defaults to the x-root-schema of a spec written by openapi-types <spec-url> <schema-name> <out-file>',
  example: 'invoice'
};
const outFile: InputSpec = {
  label: 'out-file',
  description: 'destination file; omitted means stdout',
  example: 'invoice.ai.json'
};
const ts: InputSpec = {
  label: '--ts',
  description: 'write a typed .ts stub; requires an out-file',
  example: 'invoice.d.ts'
};
const executable: InputSpec = {
  label: '--executable',
  description: 'absolute path to the harness binary',
  example: 'C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd'
};
const timeout: InputSpec = {
  label: '--timeout',
  description: 'harness timeout in milliseconds',
  example: '600000'
};

/** What each prompt says when a terminal run is missing the input. */
export const AI_FIXTURES_INPUTS = { specUrl, fixture, scenario, tool, schemaName, outFile, ts, executable, timeout };

export const AI_FIXTURES_HELP = `usage: openapi-ai-fixtures <spec-url> [schema-name] [out-file] [options]
       openapi-ai-fixtures [out-file] --fixture <corrupt.json> --missing <missing.json> [options]
       openapi-ai-fixtures --list-models --tool <name>

Ask a local coding harness to enrich a fixture, then validate the answer against the schema.

  <spec-url>              http(s):// or file:// URL of the JSON spec (required without --missing)
  [schema-name]           a key under components.schemas; defaults to the x-root-schema of a spec
                          written by openapi-types <spec-url> <schema-name> <out-file>
  [out-file]              destination file; omitted means stdout
  --fixture <file>        existing JSON fixture to enrich (required)
  --scenario <text>       what the fixture should describe (required without --missing)
  --tool <name>           claude, codex, antigravity, copilot or gemini (required)
  --missing <file>        missing.json from openapi-fixture-diff; fills only the absent fields and
                          takes its schema name from the file, so no spec-url is read
  --model <slug>          harness model, or "default" for the harness default
  --ts <types-file>       write a typed .ts stub; requires an out-file
  --executable <path>     absolute path to the harness binary
  --timeout <ms>          harness timeout in milliseconds
  --list-models           print the models the harness offers
  -h, --help              print this help

Without --model a terminal prompts for one and a pipe uses the harness default.`;

/** Scenario used for `--missing` when the caller gives none. */
export const MISSING_SCENARIO = 'Fill every missing field with realistic values coherent with the baseline';
