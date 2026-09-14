import { MISSING_PROMPT_LIMIT_BYTES } from '../common/missing.const.ts';
import type { MissingPromptInput } from '../common/missing.type.ts';

const AUTHORITY = 'The schema is authoritative. The result must conform to it even when the scenario or baseline conflicts.';
const RESTRICTIONS = 'Do not access tools, code, project files, or external resources.';
const MISSING_RESPONSE =
  'Return exactly one JSON value that conforms to the `missing` schema. Include only its keys. Keep values coherent with `baseline` (currency, ids, totals).';
const MISSING_OVERSIZE =
  'missing prompt exceeds the 1 MiB agent input limit; drop fewer or leaf-only fields (schemas referencing hub objects such as account pull in the whole graph)';

type FixturePromptInstructions = {
  readonly authority: string;
  readonly baseline: string;
  readonly response: string;
  readonly restrictions: string;
};

type FixturePrompt = {
  readonly baseline: unknown;
  readonly instructions: FixturePromptInstructions;
  readonly scenario: string;
  readonly schema: unknown;
};

type MissingPromptInstructions = {
  readonly authority: string;
  readonly response: string;
  readonly restrictions: string;
};

type MissingPromptPayload = {
  readonly baseline: unknown;
  readonly instructions: MissingPromptInstructions;
  readonly missing: unknown;
  readonly scenario: string;
};

export const fixturePrompt = (context: string, fixtureJson: string, scenario: string): string => {
  const schema: unknown = JSON.parse(context);
  const baseline: unknown = JSON.parse(fixtureJson);
  const instructions: FixturePromptInstructions = {
    authority: AUTHORITY,
    baseline: 'Use the baseline fixture as an editable starting point; its values are not immutable.',
    response: 'Return exactly one JSON value with no markdown or explanatory text.',
    restrictions: RESTRICTIONS
  };
  const prompt: FixturePrompt = { baseline, instructions, scenario, schema };

  return JSON.stringify(prompt);
};

/**
 * Prompt for filling only the properties a diff reported as absent from the baseline. It carries the
 * pruned missing document rather than the prepared spec, which would blow the agent's input limit.
 */
export const missingPrompt = (input: MissingPromptInput): string => {
  const baseline: unknown = JSON.parse(input.fixtureJson);
  const instructions: MissingPromptInstructions = { authority: AUTHORITY, response: MISSING_RESPONSE, restrictions: RESTRICTIONS };
  const missing = input.missing;
  const prompt: MissingPromptPayload = { baseline, instructions, missing, scenario: input.scenario };
  const text = JSON.stringify(prompt);
  const bytes = Buffer.byteLength(text, 'utf8');

  if (bytes > MISSING_PROMPT_LIMIT_BYTES) throw new Error(MISSING_OVERSIZE);

  return text;
};
