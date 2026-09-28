import type { DiffResult, MissingFile } from '@fixture-automation/fixture-studio-api/contract';

import { CUSTOMER_ENDPOINT_STUB, INVOICE_ENDPOINT_STUB } from './studio-api.stub.ts';
import { BROKEN_DIFF_RESULT_STUB } from './workbench.stub.ts';
import type { DiffByEndpoint } from '../common/playwright.type.ts';

type PartialCustomer = {
  readonly id: string;
  readonly address: Record<string, string>;
};

const BERGEN = { city: 'Bergen' };

/** A customer fixture with its address but no email and no street. */
export const PARTIAL_CUSTOMER_STUB: PartialCustomer = { id: 'cus_7', address: BERGEN };

const EMAIL_SCHEMA = { type: 'string' };

const CUSTOMER_MISSING_PROPERTIES = { email: EMAIL_SCHEMA };

const CUSTOMER_MISSING_SCHEMA = { type: 'object', properties: CUSTOMER_MISSING_PROPERTIES };

const NO_COMPONENTS = { schemas: {} };

const CUSTOMER_MISSING_FILE_STUB: MissingFile = {
  schemaName: 'customer',
  dialect: 'openapi-30',
  paths: ['email', 'address.street'],
  schema: CUSTOMER_MISSING_SCHEMA,
  components: NO_COMPONENTS
};

export const CUSTOMER_DIFF_RESULT_STUB: DiffResult = {
  missing: CUSTOMER_MISSING_FILE_STUB,
  missingPaths: CUSTOMER_MISSING_FILE_STUB.paths,
  replacedPaths: [],
  broken: [],
  baseline: PARTIAL_CUSTOMER_STUB,
  completeJson:
    '{\n  "id": "cus_7",\n  "email": "ada@example.com",\n  "address": {\n    "city": "Bergen",\n    "street": "Bryggen 1"\n  }\n}\n'
};

/** The invoice keeps a broken value, so switching away and back must also keep the broken list. */
export const DIFF_BY_ENDPOINT_STUB: DiffByEndpoint = {
  [INVOICE_ENDPOINT_STUB.id]: BROKEN_DIFF_RESULT_STUB,
  [CUSTOMER_ENDPOINT_STUB.id]: CUSTOMER_DIFF_RESULT_STUB
};
