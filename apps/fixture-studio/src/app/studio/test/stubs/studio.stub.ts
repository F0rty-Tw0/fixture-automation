import type {
  AiPromptResult,
  AiToolStatus,
  AiToolsResult,
  DiffResult,
  Endpoint,
  GeneratedFixture,
  LoadedSpec,
  MergeResult,
  MissingFile
} from '@fixture-automation/fixture-studio-api/contract';

import { ON_DEVICE_PROMPT_BYTE_LIMIT } from '../../common/ai-fill.const.ts';
import type { FixtureDocument, FixtureView } from '../../common/studio.type.ts';

export const ENDPOINT_STUB: Endpoint = {
  id: 'GET /v1/invoices',
  method: 'GET',
  path: '/v1/invoices',
  summary: 'List invoices',
  tags: ['Invoices'],
  schemaName: 'InvoiceList',
  unsupportedReason: undefined
};

export const LOADED_SPEC_STUB: LoadedSpec = {
  specId: 'spec-1',
  title: 'Billing API',
  version: '1.0.0',
  endpoints: []
};

export const GENERATED_FIXTURE_STUB: GeneratedFixture = {
  endpointId: 'GET /v1/invoices',
  schemaName: 'InvoiceList',
  json: undefined,
  stub: undefined,
  types: undefined
};

const MISSING_COMPONENTS = { schemas: {} };

export const MISSING_FILE_STUB: MissingFile = {
  schemaName: 'invoice',
  dialect: 'openapi-30',
  paths: ['status'],
  schema: {},
  components: MISSING_COMPONENTS
};

const DIFF_BASELINE = { id: 'in_1' };

export const DIFF_RESULT_STUB: DiffResult = {
  missing: MISSING_FILE_STUB,
  missingPaths: ['status'],
  replacedPaths: [],
  broken: [],
  baseline: DIFF_BASELINE,
  completeJson: '{\n  "id": "in_1",\n  "status": "draft"\n}',
  promptBytes: 900
};

/** One byte past what the on-device model is offered for. */
export const OVERSIZED_DIFF_RESULT_STUB: DiffResult = { ...DIFF_RESULT_STUB, promptBytes: ON_DEVICE_PROMPT_BYTE_LIMIT + 1 };

export const MERGE_RESULT_STUB: MergeResult = {
  mergedJson: '{\n  "id": "in_1",\n  "status": "open"\n}',
  filled: ['status'],
  valid: true,
  errors: []
};

const RESPONSE_SCHEMA = { type: 'object' };

export const AI_PROMPT_RESULT_STUB: AiPromptResult = {
  system: 'You fill fixtures.',
  prompt: 'Fill status.',
  responseSchema: RESPONSE_SCHEMA
};

const INSTALLED_TOOLS: AiToolStatus[] = [
  { tool: 'claude', installed: true },
  { tool: 'codex', installed: true },
  { tool: 'antigravity', installed: true },
  { tool: 'copilot', installed: true },
  { tool: 'gemini', installed: true }
];

/** Every CLI installed, no mock: the install check stays out of the way. */
export const CLI_TOOLS_RESULT_STUB: AiToolsResult = { tools: INSTALLED_TOOLS, mock: false };

const JSON_DOCUMENT: FixtureDocument = { format: 'json', label: 'JSON fixture', fileName: 'invoice.json', content: '{}', language: 'json' };

export const FIXTURE_VIEW_STUB: FixtureView = {
  endpointId: 'GET /v1/invoices',
  method: 'GET',
  path: '/v1/invoices',
  schemaName: 'invoice',
  documents: [JSON_DOCUMENT]
};
