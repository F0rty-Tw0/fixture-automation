import type { API_PREFIX, API_ROUTES, FIXTURE_FORMATS, FixtureFormat } from '@fixture-automation/fixture-studio-api/contract';

import type { EndpointFilter, FixtureFormatMeta, GenerateOptions } from './studio.type.ts';

// The Angular builder can't resolve the contract's runtime module, so these are copies; typing
// each one as `typeof` its contract value turns any drift into a compile error.
export const STUDIO_API_PREFIX: typeof API_PREFIX = '/api';

export const STUDIO_API_ROUTES: typeof API_ROUTES = {
  specs: '/specs',
  generate: '/specs/:specId/generate',
  diff: '/specs/:specId/diff',
  merge: '/specs/:specId/merge',
  aiPrompt: '/specs/:specId/ai-prompt',
  aiFill: '/specs/:specId/ai-fill',
  aiModels: '/ai/cli/models',
  aiTools: '/ai/cli/tools'
};

export const SPECS_URL = `${STUDIO_API_PREFIX}${STUDIO_API_ROUTES.specs}`;

export const CLI_MODELS_URL = `${STUDIO_API_PREFIX}${STUDIO_API_ROUTES.aiModels}`;

export const CLI_TOOLS_URL = `${STUDIO_API_PREFIX}${STUDIO_API_ROUTES.aiTools}`;

export const UNTAGGED_GROUP = 'untagged';

export const DEFAULT_ENDPOINT_FILTER: EndpointFilter = {
  query: '',
  tag: '',
  method: ''
};

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  json: true,
  stub: true,
  types: false,
  requiredOnly: false
};

const JSON_FORMAT: FixtureFormatMeta = {
  label: 'JSON fixture',
  extension: '.json',
  language: 'json'
};

const STUB_FORMAT: FixtureFormatMeta = {
  label: 'TS stub',
  extension: '.stub.ts',
  language: 'typescript'
};

const TYPES_FORMAT: FixtureFormatMeta = {
  label: 'Types',
  extension: '.d.ts',
  language: 'typescript'
};

export const FIXTURE_FORMAT_META: Record<FixtureFormat, FixtureFormatMeta> = {
  json: JSON_FORMAT,
  stub: STUB_FORMAT,
  types: TYPES_FORMAT
};

/** Display order of formats: the contract's `FIXTURE_FORMATS`. */
export const FIXTURE_FORMAT_ORDER: typeof FIXTURE_FORMATS = ['json', 'stub', 'types'];
