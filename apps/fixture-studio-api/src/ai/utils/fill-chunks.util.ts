import { MISSING_PROMPT_LIMIT_BYTES, missingDocument, missingPatterns, patternPromptBytes } from '@fixture-automation/openapi-ai-fixtures';
import type { MissingPattern, PatternPromptInput } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { missingScenario, serializedFixture } from './ai-prompt.util.ts';
import { missingChunk } from './missing-chunk.util.ts';
import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import type { FillChunk } from '../common/ai.type.ts';

type ChunkScope = {
  /** The fixture after a JSON round trip, as the library digests it. */
  readonly fixture: unknown;
  readonly missing: MissingFile;
  readonly scenario: string;
};

/** One prompt budget for every CLI: past it, models tend to answer in prose instead of JSON. */
const CHUNK_BUDGET_BYTES = 256 * 1024;
/** Most path patterns one chunk asks for, so each answer stays small whatever the prompt size. */
const CHUNK_MAX_PATTERNS = 150;

/** UTF-8 size of the pattern prompt the library builds for `missing`, digest-only (no staged baseline file). */
const patternBytes = (scope: ChunkScope, missing: MissingFile): number => {
  const document = missingDocument(missing);
  const patterns = missingPatterns(missing.paths);
  const input: PatternPromptInput = { fixture: scope.fixture, missing: document, patterns, scenario: scope.scenario };

  return patternPromptBytes(input);
};

const patternPaths = (patterns: MissingPattern[]): string[] => patterns.flatMap((pattern: MissingPattern): string[] => pattern.paths);

const halves = (patterns: MissingPattern[]): MissingPattern[][] => {
  const middle = Math.ceil(patterns.length / 2);

  return [patterns.slice(0, middle), patterns.slice(middle)];
};

const slices = (patterns: MissingPattern[]): MissingPattern[][] => {
  const sliceCount = Math.ceil(patterns.length / CHUNK_MAX_PATTERNS);
  const slice = (_slice: unknown, index: number): MissingPattern[] =>
    patterns.slice(index * CHUNK_MAX_PATTERNS, (index + 1) * CHUNK_MAX_PATTERNS);

  return Array.from({ length: sliceCount }, slice);
};

const fillChunk = (paths: string[], isOversized: boolean): FillChunk => {
  const chunk: FillChunk = { paths, isOversized };

  return chunk;
};

/** The chunks of whole patterns under the budget; the prompt size is measured over their narrowed projection. */
function splitPatterns(scope: ChunkScope, patterns: MissingPattern[]): FillChunk[] {
  const selected = patternPaths(patterns);
  const chunk = missingChunk(scope.missing, selected);
  const bytes = patternBytes(scope, chunk);
  const isSingle = patterns.length === 1;

  if (bytes <= CHUNK_BUDGET_BYTES) return [fillChunk(chunk.paths, false)];

  if (isSingle) return [fillChunk(chunk.paths, bytes > MISSING_PROMPT_LIMIT_BYTES)];

  return halves(patterns).flatMap((half: MissingPattern[]): FillChunk[] => splitPatterns(scope, half));
}

/**
 * How one CLI fill splits into sequential runs. The library asks per path pattern (`lines[*].qty`), so a chunk holds
 * whole patterns, never part of one. A single chunk holds every missing path when the patterns fit the pattern cap
 * and the pattern prompt fits the chunk budget; otherwise the patterns are sliced 150 at a time in first-seen order,
 * and a slice is halved only while its prompt is over the budget. A lone pattern over the budget still runs by itself;
 * over the 1 MiB CLI limit it is marked `isOversized`.
 */
export const fillChunks = (fixture: unknown, missing: MissingFile, scenario: string): FillChunk[] => {
  const isEmpty = missing.paths.length === 0;

  if (isEmpty) throw new FixtureError('there are no missing paths to fill', 'run the diff again; this fixture lacks nothing');

  const fixtureJson = serializedFixture(fixture);
  const plainFixture: unknown = JSON.parse(fixtureJson);
  const scope: ChunkScope = { fixture: plainFixture, missing, scenario: missingScenario(scenario) };
  const patterns = missingPatterns(missing.paths);
  const wholeBytes = patternBytes(scope, missing);
  const isCapped = patterns.length <= CHUNK_MAX_PATTERNS;
  const fitsWhole = isCapped && wholeBytes <= CHUNK_BUDGET_BYTES;

  if (fitsWhole) return [fillChunk(missing.paths, false)];

  return slices(patterns).flatMap((slice: MissingPattern[]): FillChunk[] => splitPatterns(scope, slice));
};
