import { AiFillRejectedError } from '@fixture-automation/openapi-ai-fixtures';
import type { AiFixtureProgress, AiMissingRequest } from '@fixture-automation/openapi-ai-fixtures';

import type { AiTool, MissingFile } from '../../contract/common/studio-api.type.ts';
import type { ChunkedFillRun, FillChunk, FillOutcome } from '../common/ai.type.ts';
import { baselineContext } from '../utils/baseline-context.util.ts';
import { fillChunks } from '../utils/fill-chunks.util.ts';
import { aiOutcome, failureText, mergedOutcome, unfilledOutcome } from '../utils/fill-outcome.util.ts';
import { missingChunk } from '../utils/missing-chunk.util.ts';

type ChunkPlace = {
  readonly index: number;
  readonly total: number;
};

const OVERSIZED_REASON = 'its prompt alone exceeds the 1 MiB CLI input limit';
const NO_FILL: FillOutcome = { populated: {}, sources: {}, notes: [] };

const statusLine = (text: string): AiFixtureProgress => {
  const progress: AiFixtureProgress = { stream: 'status', text: `${text}\n` };

  return progress;
};

const chunkStatus = (place: ChunkPlace, paths: string[]): AiFixtureProgress => {
  const noun = paths.length === 1 ? 'field' : 'fields';

  return statusLine(`Chunk ${place.index + 1} of ${place.total}: ${paths.length} ${noun}…`);
};

const chunkRequest = (request: AiMissingRequest, paths: string[]): AiMissingRequest => {
  const missing = missingChunk(request.missing, paths);
  const fixture = baselineContext(request.fixture, missing.paths);
  const chunk: AiMissingRequest = { ...request, fixture, missing };

  return chunk;
};

const chunkPrefix = (place: ChunkPlace): string => {
  if (place.total === 1) return '';

  return `Chunk ${place.index + 1} of ${place.total}: `;
};

/** Why a chunk's CLI run produced no usable fill, in words for the user. */
const failureReason = (tool: AiTool, error: unknown): string => {
  if (error instanceof AiFillRejectedError) {
    if (error.candidates.length === 0) return `${tool} returned text that is not JSON`;

    return `${tool}'s answer did not match the schema`;
  }

  return `${tool} failed: ${failureText(error, String(error))}`;
};

const parsedCandidates = (error: unknown): unknown[] => {
  if (error instanceof AiFillRejectedError) return error.candidates;

  return [];
};

/**
 * The whole request for a fill that runs once, else only the chunk's paths over their baseline context. Planning
 * already built each chunk's projection to size its prompt, so this does not fail for a chunk `fillChunks` returned.
 */
const requestFor = (run: ChunkedFillRun, chunk: FillChunk, isWhole: boolean): AiMissingRequest => {
  if (isWhole) return run.request;

  return chunkRequest(run.request, chunk.paths);
};

/** The sampler's fill for `missing`, built on `candidates`; a salvage that fails too leaves the chunk unfilled. */
const salvagedChunk = async (
  run: ChunkedFillRun,
  missing: MissingFile,
  context: string,
  candidates: unknown[]
): Promise<FillOutcome> => {
  run.onProgress(statusLine(`${context}; filling from the schema…`));

  try {
    return await run.salvage(missing, candidates, context);
  } catch (error: unknown) {
    run.signal.throwIfAborted();

    return unfilledOutcome(missing.paths, context, error);
  }
};

const chunkOutcome = async (run: ChunkedFillRun, chunk: FillChunk, place: ChunkPlace): Promise<FillOutcome> => {
  const isWhole = place.total === 1;
  const request = requestFor(run, chunk, isWhole);
  const prefix = chunkPrefix(place);

  if (!isWhole) run.onProgress(chunkStatus(place, chunk.paths));

  if (chunk.isOversized) return salvagedChunk(run, request.missing, `${prefix}${OVERSIZED_REASON}`, []);

  try {
    const populated = await run.enrich(run.schemaName, request);

    return aiOutcome(request.missing.paths, populated);
  } catch (error: unknown) {
    run.signal.throwIfAborted();

    const reason = failureReason(run.tool, error);
    const candidates = parsedCandidates(error);

    return salvagedChunk(run, request.missing, `${prefix}${reason}`, candidates);
  }
};

/**
 * Runs one CLI fill, split by `fillChunks` when its prompt is too big for one answer: chunks run one after another,
 * each asking only for its paths over a baseline trimmed to their context and validated on its own, and their answers
 * merge key by key and index by index. A fill that fits runs once with the whole request. A chunk whose run fails is
 * salvaged from its parsed answers and the sampler instead of failing the fill. Planning still rejects before any CLI
 * run when nothing is missing, the fixture is not JSON, or a missing path has no schema; after that only a cancel
 * ends the fill early.
 */
export const chunkedFill = async (run: ChunkedFillRun): Promise<FillOutcome> => {
  const { request, signal } = run;
  const chunks = fillChunks(request.fixture, request.missing, request.scenario);
  let outcome = NO_FILL;

  for (const [index, chunk] of chunks.entries()) {
    signal.throwIfAborted();

    const place: ChunkPlace = { index, total: chunks.length };
    const filled = await chunkOutcome(run, chunk, place);

    outcome = mergedOutcome(outcome, filled);
  }

  return outcome;
};
