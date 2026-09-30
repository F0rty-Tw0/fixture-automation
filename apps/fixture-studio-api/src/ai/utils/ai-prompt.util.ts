import {
  MISSING_SCENARIO,
  baselineContext,
  missingDocument,
  missingPrompt,
  missingPromptBytes
} from '@fixture-automation/openapi-ai-fixtures';
import type { MissingPromptInput } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { missingChunk } from './missing-chunk.util.ts';
import { responseSchema } from './response-schema.util.ts';
import type { AiPromptResult, MissingFile } from '../../contract/common/studio-api.type.ts';

const SYSTEM =
  'You fill the missing fields of a JSON test fixture. Follow the instructions inside the JSON request and answer with one JSON value only.';

/** The trimmed scenario, or the CLI's default when it is absent or blank. */
export const missingScenario = (scenario: string | undefined): string => {
  const trimmed = scenario?.trim();

  if (!trimmed) return MISSING_SCENARIO;

  return trimmed;
};

const promptInput = (baseline: unknown, missing: MissingFile, scenario: string | undefined): MissingPromptInput => {
  const fixtureJson: unknown = JSON.stringify(baseline);

  if (typeof fixtureJson !== 'string')
    throw new FixtureError('the fixture is not JSON-serializable', 'send the parsed fixture object');

  const document = missingDocument(missing);
  const input: MissingPromptInput = { fixtureJson, missing: document, scenario: missingScenario(scenario) };

  return input;
};

const promptResult = (baseline: unknown, missing: MissingFile, scenario: string | undefined): AiPromptResult => {
  const input = promptInput(baseline, missing, scenario);
  const prompt = missingPrompt(input);
  const schema = responseSchema(missing);
  const result: AiPromptResult = { system: SYSTEM, prompt, responseSchema: schema };

  return result;
};

/**
 * The per-path prompt for the on-device model the browser runs, plus a response schema.
 * With `paths`, only those missing paths are asked for and the baseline keeps only their context, so a small
 * on-device model can fill the gaps chunk by chunk.
 */
export const aiPrompt = (fixture: unknown, missing: MissingFile, scenario: string | undefined, paths?: string[]): AiPromptResult => {
  if (paths === undefined) return promptResult(fixture, missing, scenario);

  const chunk = missingChunk(missing, paths);
  const baseline = baselineContext(fixture, chunk.paths);

  return promptResult(baseline, chunk, scenario);
};

/** UTF-8 size of the prompt over the whole `fixture`; unlike the prompt itself, it counts past the agent input limit. */
export const promptBytes = (fixture: unknown, missing: MissingFile, scenario: string | undefined): number => {
  const input = promptInput(fixture, missing, scenario);

  return missingPromptBytes(input);
};

/** UTF-8 size of the prompt asking for `paths` over a baseline trimmed to their context. */
export const chunkPromptBytes = (fixture: unknown, missing: MissingFile, paths: string[], scenario: string | undefined): number => {
  const chunk = missingChunk(missing, paths);
  const baseline = baselineContext(fixture, chunk.paths);

  return promptBytes(baseline, chunk, scenario);
};

/**
 * UTF-8 size of the browser-model prompt asking for every missing path at once, over a baseline trimmed to their
 * context, with the default scenario (the user's own is not known yet). 0 when nothing is missing.
 */
export const trimmedPromptBytes = (fixture: unknown, missing: MissingFile): number => {
  if (missing.paths.length === 0) return 0;

  return chunkPromptBytes(fixture, missing, missing.paths, undefined);
};
