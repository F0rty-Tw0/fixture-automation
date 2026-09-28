import { MISSING_PROMPT_LIMIT_BYTES } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { chunkPromptBytes, promptBytes } from './ai-prompt.util.ts';
import type { MissingFile } from '../contract/common/studio-api.type.ts';

type ChunkScope = {
  readonly fixture: unknown;
  readonly missing: MissingFile;
  readonly scenario: string;
};

/** One prompt budget for every CLI: past it, models tend to answer in prose instead of JSON. */
const CHUNK_BUDGET_BYTES = 256 * 1024;
/** Most paths one chunk asks for, so each answer stays small whatever the prompt size. */
const CHUNK_MAX_PATHS = 150;
const OVERSIZE_FIX = 'fill that field by hand, or trim the fixture around it: its prompt alone exceeds the 1 MiB CLI input limit';

/** The prompt of one chunk: only its paths, with the baseline trimmed to their context. */
const chunkBytes = (scope: ChunkScope, paths: string[]): number =>
  chunkPromptBytes(scope.fixture, scope.missing, paths, scope.scenario);

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
