import type { AiFixtureProgress, AiMissingRequest } from '@fixture-automation/openapi-ai-fixtures';

import type { ChunkedFillRun } from '../common/ai.type.ts';
import { mergeAnswers } from '../utils/answer-merge.util.ts';
import { baselineContext } from '../utils/baseline-context.util.ts';
import { fillChunks } from '../utils/fill-chunks.util.ts';
import { missingChunk } from '../utils/missing-chunk.util.ts';

const chunkStatus = (index: number, total: number, paths: string[]): AiFixtureProgress => {
  const noun = paths.length === 1 ? 'field' : 'fields';
  const progress: AiFixtureProgress = { stream: 'status', text: `Chunk ${index + 1} of ${total}: ${paths.length} ${noun}…\n` };

  return progress;
};

const chunkRequest = (request: AiMissingRequest, paths: string[]): AiMissingRequest => {
  const missing = missingChunk(request.missing, paths);
  const fixture = baselineContext(request.fixture, missing.paths);
  const chunk: AiMissingRequest = { ...request, fixture, missing };

  return chunk;
};

/**
 * Runs one CLI fill, split by `fillChunks` when its prompt is too big for one answer: chunks run one after another,
 * each asking only for its paths over a baseline trimmed to their context and validated on its own, and their answers
 * merge key by key and index by index. A fill that fits runs once with the whole request.
 */
export const chunkedFill = async (run: ChunkedFillRun): Promise<Record<string, unknown>> => {
  const { enrich, onProgress, request, schemaName, signal } = run;
  const chunks = fillChunks(request.fixture, request.missing, request.scenario);

  if (chunks.length === 1) return enrich(schemaName, request);

  let populated: Record<string, unknown> = {};

  for (const [index, paths] of chunks.entries()) {
    signal.throwIfAborted();

    const status = chunkStatus(index, chunks.length, paths);
    const chunk = chunkRequest(request, paths);

    onProgress(status);

    const answer = await enrich(schemaName, chunk);

    populated = mergeAnswers(populated, answer);
  }

  return populated;
};
