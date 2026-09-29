import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

const INVOICE_SCHEMA = { type: 'object' } as const;
const SCHEMAS = { invoice: INVOICE_SCHEMA };
const COMPONENTS = { schemas: SCHEMAS };

export const OPENAPI_SPEC_STUB: OpenApiSpec = { openapi: '3.1.0', components: COMPONENTS };
