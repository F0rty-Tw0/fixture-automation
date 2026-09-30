import { setTimeout as delay } from 'node:timers/promises';

import { AiFillRejectedError, isListFill, pathTree } from '@fixture-automation/openapi-ai-fixtures';
import type {
  AiFixtureOptions,
  AiMissingFactory,
  AiMissingRequest,
  AiToolInstall,
  MissingFill,
  ModelDiscovery,
  PathValue
} from '@fixture-automation/openapi-ai-fixtures';

import { AI_TOOLS } from '../../contract/common/studio-api.schema.ts';
import type { AiTool } from '../../contract/common/studio-api.type.ts';
import type { StudioAi } from '../common/ai.type.ts';
import { sampleAtPath } from '../utils/fill-path.util.ts';
import { missingSample } from '../utils/missing-sample.util.ts';

const MOCK_LINES = ['mock: reading the missing schema\n', 'mock: sampling values\n', 'mock: done\n'];
const MOCK_DELAY_MS = 100;
/** A scenario holding this makes the mock answer like a model that left out the first missing path. */
const SALVAGE_MARKER = '[mock:salvage]';

/** The sampler's answer without its first missing path, rejected the way a real fill rejects a broken answer. */
const rejectedAnswer = (request: AiMissingRequest): AiFillRejectedError => {
  const sample = missingSample(request.missing);
  const [first = '', ...rest] = request.missing.paths;
  const entryAt = (path: string): PathValue => {
    const entry: PathValue = { path, value: sampleAtPath(sample, path) };

    return entry;
  };
  const answer = pathTree(rest.map(entryAt), isListFill(request.missing.paths));
  const problem = `the answer left out ${first}`;

  return new AiFillRejectedError(`generated missing fields violate schema "missing": ${problem}`, [answer], problem);
};

const mockFill = (options: AiFixtureOptions): AiMissingFactory => {
  const enrich = async (_name: string, request: AiMissingRequest): Promise<MissingFill> => {
    for (const text of MOCK_LINES) {
      await delay(MOCK_DELAY_MS);
      options.signal?.throwIfAborted();
      options.onProgress?.({ stream: 'stdout', text });
    }

    const isSalvage = request.scenario.includes(SALVAGE_MARKER);

    if (isSalvage) throw rejectedAnswer(request);

    return missingSample(request.missing);
  };

  return enrich;
};

const mockDiscover = async (tool: AiTool): Promise<ModelDiscovery> => {
  const discovery: ModelDiscovery = { models: ['mock-model'], source: `${tool}-cli` };

  return Promise.resolve(discovery);
};

const mockInstall = (tool: AiTool): AiToolInstall => {
  const install: AiToolInstall = { tool, installed: true };

  return install;
};

/** Every tool counts as installed, so any of them can be picked against the mock. */
const mockDetect = async (): Promise<AiToolInstall[]> => {
  const installs = AI_TOOLS.map(mockInstall);

  return Promise.resolve(installs);
};

/**
 * `STUDIO_AI_MOCK=1`: no CLI runs; progress is canned and the result is the sampler's values for the missing projection.
 * A scenario containing `[mock:salvage]` drops the first missing path from that answer and rejects it, so the fill
 * shows a salvaged result with its sources and notes.
 */
export const MOCK_AI: StudioAi = { fill: mockFill, discover: mockDiscover, detect: mockDetect, isMock: true };
