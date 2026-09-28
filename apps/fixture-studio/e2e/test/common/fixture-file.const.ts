import { fileURLToPath } from 'node:url';

export const NOT_JSON_PATH = fileURLToPath(new URL('../fixtures/not-json.json', import.meta.url));

export const PARTIAL_INVOICE_JSON_PATH = fileURLToPath(new URL('../fixtures/partial-invoice.json', import.meta.url));

export const PARTIAL_INVOICE_TS_PATH = fileURLToPath(new URL('../fixtures/partial-invoice.fixture.ts', import.meta.url));

export const BROKEN_INVOICE_TS_PATH = fileURLToPath(new URL('../fixtures/broken-invoice.fixture.ts', import.meta.url));

/** A partial invoice for the API's own sample spec, used by the live project. */
export const SAMPLE_PARTIAL_INVOICE_TS_PATH = fileURLToPath(new URL('../fixtures/sample-partial-invoice.fixture.ts', import.meta.url));

/** `export default invoice;` after an unrelated const: only resolving the identifier yields the invoice. */
export const DEFAULT_EXPORT_INVOICE_TS_PATH = fileURLToPath(new URL('../fixtures/default-export-invoice.fixture.ts', import.meta.url));
