import { MISSING_PROMPT_LIMIT_BYTES, missingDocument, missingPromptBytes } from '@fixture-automation/openapi-ai-fixtures';
import type { MissingPromptInput } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { baselineContext } from './baseline-context.util.ts';
import { missingChunk } from './missing-chunk.util.ts';
import type { MissingFile } from '../contract/common/studio-api.type.ts';

type ChunkScope = {
  readonly fixture: unknown;
  readonly missing: MissingFile;
  readonly scenario: string;
};

// ponytail: one fixed 256 KiB prompt budget for every CLI; big answers make models reply in prose instead of JSON.
// Make it per tool when one model needs smaller chunks.
const CHUNK_BUDGET_BYTES = 256 * 1024;
/** Most paths one chunk asks for, so each answer stays small whatever the prompt size. */
const CHUNK_MAX_PATHS = 150;
const OVERSIZE_FIX = 'fill that field by hand, or trim the fixture around it: its prompt alone exceeds the 1 MiB CLI input limit';

const promptBytes = (fixture: unknown, missing: MissingFile, scenario: string): number => {
  const fixtureJson: unknown = JSON.stringify(fixture);

  if (typeof fixtureJson !== 'string')
    throw new FixtureError('the fixture is not JSON-serializable', 'send the parsed fixture object');

  const document = missingDocument(missing);
  const input: MissingPromptInput = { fixtureJson, missing: document, scenario };

  return missingPromptBytes(input);
};

/** The prompt of one chunk: only its paths, with the baseline trimmed to their context. */
const chunkBytes = (scope: ChunkScope, paths: string[]): number => {
  const chunk = missingChunk(scope.missing, paths);
  const baseline = baselineContext(scope.fixture, chunk.paths);

  return promptBytes(baseline, chunk, scope.scenario);
};

const halves = (paths: string[]): string[][] => {
  const middle = Math.ceil(paths.length / 2);

  return [paths.slice(0, middle), paths.slice(middle)];
};

function splitPaths(scope: ChunkScope, paths: string[]): string[][] {
  const isOverCap = paths.length > CHUNK_MAX_PATHS;
  const splitHalves = (): string[][] => halves(paths).flatMap((half: string[]): string[][] => splitPaths(scope, half));

  if (isOverCap) return splitHalves();

  const bytes = chunkBytes(scope, paths);
  const isSingle = paths.length === 1;

  if (bytes <= CHUNK_BUDGET_BYTES) return [paths];

  if (!isSingle) return splitHalves();

  if (bytes > MISSING_PROMPT_LIMIT_BYTES) {
    throw new FixtureError(
      `missing path "${paths.join()}" alone needs a ${bytes}-byte prompt, over the 1 MiB CLI input limit`,
      OVERSIZE_FIX
    );
  }

  return [paths];
}

/**
 * How one CLI fill splits into sequential runs: a single chunk with every missing path when the whole prompt fits
 * the chunk budget, otherwise the paths halved in `missing.paths` order until each chunk is under the budget and the
 * path cap. A lone path over the budget still runs by itself; over the 1 MiB CLI limit it is a `FixtureError`.
 */
export const fillChunks = (fixture: unknown, missing: MissingFile, scenario: string): string[][] => {
  const isEmpty = missing.paths.length === 0;

  if (isEmpty) throw new FixtureError('there are no missing paths to fill', 'run the diff again; this fixture lacks nothing');

  const wholeBytes = promptBytes(fixture, missing, scenario);
  const isCapped = missing.paths.length <= CHUNK_MAX_PATHS;
  const fitsWhole = isCapped && wholeBytes <= CHUNK_BUDGET_BYTES;

  if (fitsWhole) return [missing.paths];

  const scope: ChunkScope = { fixture, missing, scenario };

  return splitPaths(scope, missing.paths);
};
