import { MISSING_SCENARIO, missingDocument, missingPrompt } from '@fixture-automation/openapi-ai-fixtures';
import type { MissingPromptInput } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { baselineContext } from './baseline-context.util.ts';
import { missingChunk } from './missing-chunk.util.ts';
import { responseSchema } from './response-schema.util.ts';
import type { AiPromptResult, MissingFile } from '../contract/common/studio-api.type.ts';

const SYSTEM =
  'You fill the missing fields of a JSON test fixture. Follow the instructions inside the JSON request and answer with one JSON value only.';

/** The trimmed scenario, or the CLI's default when it is absent or blank. */
export const missingScenario = (scenario: string | undefined): string => {
  const trimmed = scenario?.trim();

  if (!trimmed) return MISSING_SCENARIO;

  return trimmed;
};

const promptResult = (baseline: unknown, missing: MissingFile, scenario: string | undefined): AiPromptResult => {
  const fixtureJson: unknown = JSON.stringify(baseline);

  if (typeof fixtureJson !== 'string') throw new FixtureError('the fixture is not JSON-serializable', 'send the parsed fixture object');

  const document = missingDocument(missing);
  const input: MissingPromptInput = { fixtureJson, missing: document, scenario: missingScenario(scenario) };
  const prompt = missingPrompt(input);
  const schema = responseSchema(missing);
  const result: AiPromptResult = { system: SYSTEM, prompt, responseSchema: schema };

  return result;
};

/**
 * The prompt `aiMissingFixture` sends a CLI, plus a response schema, for a model the browser runs itself.
 * With `paths`, only those missing paths are asked for and the baseline keeps only their context, so a small
 * on-device model can fill the gaps chunk by chunk.
 */
export const aiPrompt = (fixture: unknown, missing: MissingFile, scenario: string | undefined, paths?: string[]): AiPromptResult => {
  if (paths === undefined) return promptResult(fixture, missing, scenario);

  const chunk = missingChunk(missing, paths);
  const baseline = baselineContext(fixture, chunk.paths);

  return promptResult(baseline, chunk, scenario);
};
