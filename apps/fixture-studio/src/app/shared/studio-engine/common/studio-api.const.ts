import type { AI_PROGRESS_STREAMS, API_PREFIX, API_ROUTES, FillSource } from '@fixture-automation/fixture-studio-api/contract';

// The Angular builder can't resolve the contract's runtime module, so these are copies; typing
// each one as `typeof` its contract value turns any drift into a compile error.
export const STUDIO_API_PREFIX: typeof API_PREFIX = '/api';

export const STUDIO_API_ROUTES: typeof API_ROUTES = {
  specs: '/specs',
  generate: '/specs/:specId/generate',
  diff: '/specs/:specId/diff',
  envelope: '/specs/:specId/envelope',
  merge: '/specs/:specId/merge',
  fixtureName: '/fixture-name',
  aiPrompt: '/specs/:specId/ai-prompt',
  aiFill: '/specs/:specId/ai-fill',
  aiModels: '/ai/cli/models',
  aiTools: '/ai/cli/tools'
};

export const SPECS_URL = `${STUDIO_API_PREFIX}${STUDIO_API_ROUTES.specs}`;

export const FIXTURE_NAME_URL = `${STUDIO_API_PREFIX}${STUDIO_API_ROUTES.fixtureName}`;

export const CLI_MODELS_URL = `${STUDIO_API_PREFIX}${STUDIO_API_ROUTES.aiModels}`;

export const CLI_TOOLS_URL = `${STUDIO_API_PREFIX}${STUDIO_API_ROUTES.aiTools}`;

/** The contract's `AI_PROGRESS_STREAMS` (a copy, drift-checked by its type). */
export const FILL_PROGRESS_STREAMS: typeof AI_PROGRESS_STREAMS = ['stdout', 'stderr', 'status'];

/** Every `FillSource`; the contract has no runtime list of them. */
export const FILL_SOURCES: FillSource[] = ['ai', 'sampler', 'unfilled'];
