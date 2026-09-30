import { minifiedSchemaProse, minifiedStrings } from './prompt-minify.util.ts';
import type { MissingPattern, PatternPromptInput } from '../../missing-patterns/common/missing-pattern.type.ts';
import { patternDigest } from '../../missing-patterns/utils/pattern-digest.util.ts';
import { MISSING_PROMPT_LIMIT_BYTES } from '../../missing-values/common/missing.const.ts';
import type { MissingPromptInput } from '../../missing-values/common/missing.type.ts';

const AUTHORITY = 'The schema is authoritative. The result must conform to it even when the scenario or baseline conflicts.';
const RESTRICTIONS = 'Do not access tools, code, project files, or external resources.';
const FILE_RESTRICTIONS =
  '`files.baseline` is the complete baseline fixture as JSON in your working directory; `digest` is its trimmed view. You may read and search only the files listed in `files`: search them (grep) before reading, and never read a large file whole. Do not write files, run commands, or access the network or any other file.';
const FIXTURE_BASELINE =
  'Use the baseline fixture as an editable starting point; its values are not immutable. Return the complete fixture: keep every baseline key the schema allows, populate every key the schema requires but the baseline lacks, and correct any value whose type or enum casing does not match the schema. Every array must keep exactly its baseline length, edited index by index; never add, drop, or reorder elements.';
const MISSING_RESPONSE =
  'Return exactly one JSON value that conforms to the `missing` schema. Include only its keys. Keep values coherent with `baseline` (currency, ids, totals). The result is merged into `baseline` index by index, so every array that also exists in `baseline` must have exactly the baseline array length.';
const PATTERN_RESPONSE =
  'Return exactly one JSON object with one key per entry of `patterns`, and no other keys. Each value is an array of 1 to K example values, where K is the smaller of that pattern\'s `count` and 5; every example is the whole value at that path and must conform to the `missing` schema there (an array-valued path takes arrays as examples). `[*]` stands for every array index. Examples are reused cyclically across the pattern\'s items: the i-th item gets example i mod K. Inside string values, `{n}` is replaced by the item\'s 1-based ordinal. Every string example of a field that should differ per item (ids, SKUs, codes, references, emails, names) must contain `{n}`: answer ["SKU-{n}"], never literal sequences such as ["SKU-00001", "SKU-00002"], which repeat across the items. Every other field gets K different realistic examples (varied quantities, amounts, enum values, descriptions), so the items do not all look alike. Keep values coherent with `digest` (currency, ids, totals), the baseline trimmed to the patterns\' parents with every array cut to its first 3 elements.';
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

type PatternCount = {
  readonly pattern: string;
  readonly count: number;
};

type PatternPromptFiles = {
  readonly baseline: string;
};

type PatternPromptPayload = {
  readonly instructions: MissingPromptInstructions;
  readonly missing: unknown;
  readonly patterns: PatternCount[];
  readonly digest: unknown;
  readonly files?: PatternPromptFiles;
  readonly scenario: string;
};

const utf8Bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

/** `text` when it fits the agent input limit; throws before any CLI run otherwise. */
const withinLimit = (text: string): string => {
  const bytes = utf8Bytes(text);

  if (bytes > MISSING_PROMPT_LIMIT_BYTES) throw new Error(MISSING_OVERSIZE);

  return text;
};

/** The model answers the whole fixture, so baseline strings stay exact; only the schema's prose is minified. */
export const fixturePrompt = (context: string, fixtureJson: string, scenario: string): string => {
  const parsedSchema: unknown = JSON.parse(context);
  const schema = minifiedSchemaProse(parsedSchema);
  const baseline: unknown = JSON.parse(fixtureJson);
  const instructions: FixturePromptInstructions = {
    authority: AUTHORITY,
    baseline: FIXTURE_BASELINE,
    response: 'Return exactly one JSON value with no markdown or explanatory text.',
    restrictions: RESTRICTIONS
  };
  const prompt: FixturePrompt = { baseline, instructions, scenario, schema };

  return JSON.stringify(prompt);
};

/** The answer holds only missing keys and merges onto the caller's untouched baseline, so baseline strings are minified too. */
const missingPromptText = (input: MissingPromptInput): string => {
  const parsedBaseline: unknown = JSON.parse(input.fixtureJson);
  const baseline = minifiedStrings(parsedBaseline);
  const instructions: MissingPromptInstructions = { authority: AUTHORITY, response: MISSING_RESPONSE, restrictions: RESTRICTIONS };
  const missing = minifiedSchemaProse(input.missing);
  const prompt: MissingPromptPayload = { baseline, instructions, missing, scenario: input.scenario };

  return JSON.stringify(prompt);
};

/** UTF-8 size of the prompt `missingPrompt` builds, without its limit check, so a caller can split a fill first. */
export const missingPromptBytes = (input: MissingPromptInput): number => {
  const text = missingPromptText(input);

  return utf8Bytes(text);
};

/**
 * Prompt for filling only the properties a diff reported as absent from the baseline. It carries the
 * pruned missing document rather than the prepared spec, which would blow the agent's input limit.
 * Whitespace runs inside baseline strings and schema `description`/`title` are collapsed; nothing else changes.
 */
export const missingPrompt = (input: MissingPromptInput): string => {
  const text = missingPromptText(input);

  return withinLimit(text);
};

const patternCount = (pattern: MissingPattern): PatternCount => {
  const count: PatternCount = { pattern: pattern.pattern, count: pattern.paths.length };

  return count;
};

/** The digest, like the missing baseline, never comes back in the answer, so its strings are minified too. */
const patternPromptText = (input: PatternPromptInput): string => {
  const { baselineFile, scenario } = input;
  const missing = minifiedSchemaProse(input.missing);
  const patterns = input.patterns.map(patternCount);
  const trimmed = patternDigest(input.fixture, input.patterns);
  const digest = minifiedStrings(trimmed);

  if (baselineFile === undefined) {
    const instructions: MissingPromptInstructions = { authority: AUTHORITY, response: PATTERN_RESPONSE, restrictions: RESTRICTIONS };
    const prompt: PatternPromptPayload = { instructions, missing, patterns, digest, scenario };

    return JSON.stringify(prompt);
  }

  const instructions: MissingPromptInstructions = {
    authority: AUTHORITY,
    response: PATTERN_RESPONSE,
    restrictions: FILE_RESTRICTIONS
  };
  const files: PatternPromptFiles = { baseline: baselineFile };
  const prompt: PatternPromptPayload = { instructions, missing, patterns, digest, files, scenario };

  return JSON.stringify(prompt);
};

/** UTF-8 size of the prompt `patternPrompt` builds, without its limit check, so a caller can split a fill first. */
export const patternPromptBytes = (input: PatternPromptInput): number => {
  const text = patternPromptText(input);

  return utf8Bytes(text);
};

/**
 * Prompt asking for a few examples per missing path pattern (`lines[*].qty`) instead of a value per concrete path,
 * over a digest of the baseline instead of the whole fixture, so a 1000-element array costs one pattern.
 */
export const patternPrompt = (input: PatternPromptInput): string => {
  const text = patternPromptText(input);

  return withinLimit(text);
};
