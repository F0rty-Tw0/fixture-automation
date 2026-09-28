import type {
  AiFillErrorEvent,
  AiFillEvent,
  AiFillProgressEvent,
  AiFillResultEvent,
  AiModelsResult,
  AiPromptResult,
  AiToolStatus,
  AiToolsResult,
  ApiErrorBody,
  DiffResult,
  MergeResult,
  MissingFile
} from '@fixture-automation/fixture-studio-api/contract';

import type { PartialInvoice } from '../common/playwright.type.ts';

/** The value of `test/fixtures/partial-invoice.json` and `partial-invoice.fixture.ts`: no `memo`, no `customer`. */
export const PARTIAL_INVOICE_STUB: PartialInvoice = { id: 'in_123', amount_due: 4200, status: 'open' };

const STRING_SCHEMA = { type: 'string' };

const OBJECT_SCHEMA = { type: 'object' };

const MISSING_PROPERTIES = { memo: STRING_SCHEMA, customer: OBJECT_SCHEMA };

const MISSING_SCHEMA_STUB = { type: 'object', properties: MISSING_PROPERTIES };

const NO_COMPONENTS = { schemas: {} };

export const MISSING_FILE_STUB: MissingFile = {
  schemaName: 'invoice',
  dialect: 'openapi-30',
  paths: ['memo', 'customer.id', 'customer.address.city'],
  schema: MISSING_SCHEMA_STUB,
  components: NO_COMPONENTS
};

export const DIFF_RESULT_STUB: DiffResult = {
  missing: MISSING_FILE_STUB,
  missingPaths: MISSING_FILE_STUB.paths,
  replacedPaths: [],
  broken: [],
  baseline: PARTIAL_INVOICE_STUB,
  completeJson:
    '{\n  "id": "in_123",\n  "amount_due": 4200,\n  "status": "open",\n  "memo": "string",\n' +
    '  "customer": {\n    "id": "cus_1",\n    "address": {\n      "city": "Oslo"\n    }\n  }\n}\n'
};

const NOTHING_MISSING_FILE_STUB: MissingFile = { ...MISSING_FILE_STUB, paths: [] };

export const COMPLETE_DIFF_RESULT_STUB: DiffResult = {
  missing: NOTHING_MISSING_FILE_STUB,
  missingPaths: [],
  replacedPaths: [],
  broken: [],
  baseline: PARTIAL_INVOICE_STUB,
  completeJson: '{\n  "id": "in_123",\n  "amount_due": 4200,\n  "status": "open"\n}\n'
};

export const MERGED_JSON_STUB: string =
  '{\n  "id": "in_123",\n  "amount_due": 4200,\n  "status": "open",\n  "memo": "Net 30",\n' +
  '  "customer": {\n    "id": "cus_42",\n    "address": {\n      "city": "Berlin"\n    }\n  }\n}\n';

export const MERGE_RESULT_STUB: MergeResult = {
  mergedJson: MERGED_JSON_STUB,
  filled: MISSING_FILE_STUB.paths,
  valid: true,
  errors: []
};

export const INVALID_MERGE_RESULT_STUB: MergeResult = {
  mergedJson: MERGED_JSON_STUB,
  filled: MISSING_FILE_STUB.paths,
  valid: false,
  errors: ['customer.address: must have required property city', 'memo: must be string']
};

export const AI_MODELS_STUB: AiModelsResult = { models: ['sonnet'], source: 'claude-cli' };

const INSTALLED_TOOLS: AiToolStatus[] = [
  { tool: 'claude', installed: true },
  { tool: 'codex', installed: true },
  { tool: 'antigravity', installed: true },
  { tool: 'copilot', installed: true },
  { tool: 'gemini', installed: true }
];

const CLAUDE_MISSING_TOOLS: AiToolStatus[] = [
  { tool: 'claude', installed: false },
  { tool: 'codex', installed: true },
  { tool: 'antigravity', installed: false },
  { tool: 'copilot', installed: false },
  { tool: 'gemini', installed: false }
];

/** Every CLI on the API's PATH and no mock: the install check changes nothing. */
export const AI_TOOLS_STUB: AiToolsResult = { tools: INSTALLED_TOOLS, mock: false };

export const CLAUDE_MISSING_TOOLS_STUB: AiToolsResult = { tools: CLAUDE_MISSING_TOOLS, mock: false };

/** `STUDIO_AI_MOCK=1`: the mock reports every CLI installed. */
export const MOCK_AI_TOOLS_STUB: AiToolsResult = { tools: INSTALLED_TOOLS, mock: true };

const RESPONSE_SCHEMA_STUB = { type: 'object' };

export const AI_PROMPT_STUB: AiPromptResult = {
  system: 'You fill missing fixture properties.',
  prompt: 'Fill memo, customer.id and customer.address.city.',
  responseSchema: RESPONSE_SCHEMA_STUB
};

const CUSTOMER_ADDRESS_STUB = { city: 'Berlin' };

const CUSTOMER_STUB = { id: 'cus_42', address: CUSTOMER_ADDRESS_STUB };

export const POPULATED_STUB: AiFillResultEvent['populated'] = { memo: 'Net 30', customer: CUSTOMER_STUB };

export const PROGRESS_EVENT_STUB: AiFillProgressEvent = {
  type: 'progress',
  stream: 'stdout',
  text: 'claude: reading the missing schema'
};

export const RESULT_EVENT_STUB: AiFillResultEvent = { type: 'result', populated: POPULATED_STUB };

export const ERROR_EVENT_STUB: AiFillErrorEvent = {
  type: 'error',
  message: 'claude exited with code 1.',
  fix: 'Run claude once in a terminal to sign in, then retry.'
};

export const FILL_EVENTS_STUB: AiFillEvent[] = [PROGRESS_EVENT_STUB, RESULT_EVENT_STUB];

/** The API's 429 body when every AI CLI slot is taken. */
export const TOO_MANY_RUNS_ERROR_STUB: ApiErrorBody = {
  message: 'too many AI CLI runs at once',
  fix: 'wait for a running fill or model lookup to finish'
};
