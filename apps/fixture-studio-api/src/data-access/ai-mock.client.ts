import { setTimeout as delay } from 'node:timers/promises';

import type {
  AiFixtureOptions,
  AiMissingFactory,
  AiMissingRequest,
  AiToolInstall,
  ModelDiscovery
} from '@fixture-automation/openapi-ai-fixtures';

import type { StudioAi } from '../common/studio-server.type.ts';
import type { AiTool } from '../contract/common/studio-api.type.ts';
import { AI_TOOLS } from '../contract/studio-api.schema.ts';
import { missingSample } from '../utils/missing-sample.util.ts';

const MOCK_LINES = ['mock: reading the missing schema\n', 'mock: sampling values\n', 'mock: done\n'];
const MOCK_DELAY_MS = 100;

const mockFill = (options: AiFixtureOptions): AiMissingFactory => {
  const enrich = async (_name: string, request: AiMissingRequest): Promise<Record<string, unknown>> => {
    for (const text of MOCK_LINES) {
      await delay(MOCK_DELAY_MS);
      options.signal?.throwIfAborted();
      options.onProgress?.({ stream: 'stdout', text });
    }

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

/** `STUDIO_AI_MOCK=1`: no CLI runs; progress is canned and the result is the sampler's values for the missing projection. */
export const MOCK_AI: StudioAi = { fill: mockFill, discover: mockDiscover, detect: mockDetect, isMock: true };
