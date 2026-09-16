import type { AiTool } from '@fixture-automation/openapi-ai-fixtures';
import type { InputSpec } from '@fixture-automation/openapi-fixtures';

import type { WizardFormat } from './wizard.type.ts';

export const WIZARD_USAGE = 'usage: openapi-fixture-wizard (answers every prompt on stderr; -h for help)';

export const DEFAULT_OUT_DIR = 'fixtures';

export const FORMATS: WizardFormat[] = ['json', 'ts', 'both'];

export const TOOLS: AiTool[] = ['claude', 'codex', 'antigravity', 'copilot', 'gemini'];

const specUrl: InputSpec = {
  label: 'spec-url',
  description: 'http(s):// or file:// URL of the JSON spec',
  example: 'file:///E:/specs/invoice.spec.json'
};
const outDir: InputSpec = {
  label: 'out-dir',
  description: `directory receiving every file; defaults to ${DEFAULT_OUT_DIR}`,
  example: 'fixtures'
};
const target: InputSpec = {
  label: 'target',
  description: 'a key under components.schemas, or a route whose JSON response references one',
  example: 'invoice, or GET /v1/invoices/{id}'
};
const format: InputSpec = {
  label: 'format',
  description: 'json writes <schema>.fixture.json; ts adds <schema>.spec.json, <schema>.d.ts and a typed stub',
  example: '3'
};
const existingFixture: InputSpec = {
  label: 'existing-fixture',
  description: 'JSON fixture to check for missing fields; Enter ends the run after generation',
  example: 'invoice.fixture.json'
};
const objectShape: InputSpec = {
  label: 'object-shape',
  description: 'top-level fixture property to compare and merge; Enter uses the whole object',
  example: 'body'
};
const requiredOnly: InputSpec = {
  label: 'required-only',
  description: 'report only missing required fields',
  example: 'y'
};
const fillWithAi: InputSpec = {
  label: 'fill-with-ai',
  description: 'ask a local coding harness to fill the missing fields',
  example: 'y'
};
const tool: InputSpec = {
  label: 'tool',
  description: 'installed coding harness to run',
  example: '2'
};
const extraPrompt: InputSpec = {
  label: 'extra-prompt',
  description: 'what the missing values should describe; Enter keeps the default scenario',
  example: 'an open invoice for 4200 cents'
};
const merge: InputSpec = {
  label: 'merge',
  description: 'merge the filled values into the existing fixture and validate the result',
  example: 'y'
};
const endpointUrl: InputSpec = {
  label: 'endpoint-url',
  description: 'endpoint identity (URL or METHOD,path); method names are uppercased before hashing',
  example: 'GET, custodies/v2'
};
const subdirectory: InputSpec = {
  label: 'subdirectory',
  description: 'optional endpoint path prefix for hashing; Enter skips the prefix',
  example: 'savings (get, custodies/v2 becomes GET,savings/custodies/v2)'
};

/** What each prompt says, in the order the wizard asks. */
export const WIZARD_INPUTS = {
  specUrl,
  outDir,
  target,
  format,
  existingFixture,
  objectShape,
  requiredOnly,
  fillWithAi,
  tool,
  extraPrompt,
  merge,
  endpointUrl,
  subdirectory
};

export const WIZARD_HELP = `usage: openapi-fixture-wizard

Walk the whole pipeline in one terminal session: types, fixture, diff, AI fill, merge.
Every answer is read on stderr; there are no flags, so run the individual CLIs for scripts.

  spec-url          http(s):// or file:// URL of the JSON spec (required)
  out-dir           directory receiving every file; Enter = ${DEFAULT_OUT_DIR}
  target            schema name (invoice) or route (GET /v1/invoices/{id}) (required)
  format            1) json  2) ts  3) both
  existing-fixture  JSON fixture to check; Enter ends the run after generation
  object-shape      top-level property to compare and merge (body); Enter uses the whole object
  required-only     y/N, diff only required fields
  fill-with-ai      y/N, asked when the diff found missing fields
  tool              1) claude  2) codex  3) antigravity  4) copilot  5) gemini
  model             numbered list from the harness; 0 = harness default
  extra-prompt      scenario for the missing values; Enter keeps the default
  merge             y/N, merge the filled values into the existing fixture
  endpoint-url      required after merge; method identities normalize to uppercase METHOD,path before hashing
  subdirectory      optional hash prefix, e.g. savings gives GET,savings/custodies/v2; Enter skips the prefix
  -h, --help        print this help`;
