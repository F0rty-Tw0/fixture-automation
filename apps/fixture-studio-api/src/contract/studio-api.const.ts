export const API_PREFIX = '/api';

export const API_ROUTES = {
  specs: '/specs',
  generate: '/specs/:specId/generate',
  diff: '/specs/:specId/diff',
  envelope: '/specs/:specId/envelope',
  merge: '/specs/:specId/merge',
  aiPrompt: '/specs/:specId/ai-prompt',
  aiFill: '/specs/:specId/ai-fill',
  aiModels: '/ai/cli/models',
  aiTools: '/ai/cli/tools'
} as const;
