import type {
  ApiErrorBody,
  Endpoint,
  GenerateResult,
  GeneratedFixture,
  LoadedSpec
} from '@fixture-automation/fixture-studio-api/contract';

export const INVOICE_ENDPOINT_STUB: Endpoint = {
  id: 'GET /v1/invoices/{id}',
  method: 'GET',
  path: '/v1/invoices/{id}',
  summary: 'Retrieve an invoice',
  tags: ['Invoices'],
  schemaName: 'invoice',
  unsupportedReason: undefined
};

export const INVOICE_CREATE_ENDPOINT_STUB: Endpoint = {
  id: 'POST /v1/invoices',
  method: 'POST',
  path: '/v1/invoices',
  summary: 'Create an invoice',
  tags: ['Invoices'],
  schemaName: 'invoice',
  unsupportedReason: undefined
};

export const CUSTOMER_ENDPOINT_STUB: Endpoint = {
  id: 'GET /v1/customers/{id}',
  method: 'GET',
  path: '/v1/customers/{id}',
  summary: 'Retrieve a customer',
  tags: ['Customers'],
  schemaName: 'customer',
  unsupportedReason: undefined
};

export const REPORT_ENDPOINT_STUB: Endpoint = {
  id: 'GET /v1/report',
  method: 'GET',
  path: '/v1/report',
  summary: 'Download the report',
  tags: ['Reports'],
  schemaName: null,
  unsupportedReason: 'No JSON response to sample'
};

export const LOADED_SPEC_STUB: LoadedSpec = {
  specId: 'spec-e2e',
  title: 'Billing API',
  version: '3.2.0',
  endpoints: [INVOICE_ENDPOINT_STUB, INVOICE_CREATE_ENDPOINT_STUB, CUSTOMER_ENDPOINT_STUB, REPORT_ENDPOINT_STUB]
};

export const INVOICE_FIXTURE_STUB: GeneratedFixture = {
  endpointId: INVOICE_ENDPOINT_STUB.id,
  schemaName: 'invoice',
  json: '{\n  "id": "in_123",\n  "amount_due": 4200,\n  "status": "open"\n}\n',
  stub: "export const INVOICE_STUB = {\n  id: 'in_123',\n  amount_due: 4200,\n  status: 'open'\n};\n",
  types: undefined
};

export const CUSTOMER_FIXTURE_STUB: GeneratedFixture = {
  endpointId: CUSTOMER_ENDPOINT_STUB.id,
  schemaName: 'customer',
  json: '{\n  "id": "cus_1",\n  "address": { "city": "Oslo" }\n}\n',
  stub: "export const CUSTOMER_STUB = {\n  id: 'cus_1',\n  address: { city: 'Oslo' }\n};\n",
  types: undefined
};

export const GENERATE_RESULT_STUB: GenerateResult = {
  fixtures: [INVOICE_FIXTURE_STUB, CUSTOMER_FIXTURE_STUB]
};

export const SPEC_ERROR_STUB: ApiErrorBody = {
  message: 'The spec at https://api.example.com/openapi.json answered 404 Not Found.',
  fix: 'Check the URL, or drop the JSON file instead.'
};

export const UNMOCKED_ERROR_STUB: ApiErrorBody = {
  message: 'e2e: this API route has no mock.',
  fix: 'Route it in the scenario with a mock from e2e/test/mocks.'
};

/** What the UI shows, not what the API sends: the proxy's 502 has no body. */
export const UNREACHABLE_ERROR_STUB: ApiErrorBody = {
  message: 'The Fixture Studio API did not answer.',
  fix: 'Start it with pnpm studio (it listens on 127.0.0.1:3333), then retry.'
};

/** The invoice operation of the API's own sample spec, as the live API lists it. */
export const SAMPLE_INVOICE_ENDPOINT_STUB: Endpoint = {
  id: 'GET /v1/invoices/{id}',
  method: 'GET',
  path: '/v1/invoices/{id}',
  summary: 'Retrieve an invoice',
  tags: ['Invoices'],
  schemaName: 'invoice',
  unsupportedReason: undefined
};
