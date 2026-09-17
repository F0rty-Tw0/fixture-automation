import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';

import { pruneSpec } from './prune-spec.util.ts';
import type { OpenApiSpec } from '../common/openapi.type.ts';

const CUSTOMER_REF: JSONSchema7 = { $ref: '#/components/schemas/customer' };
const TEXT: JSONSchema7 = { type: 'string' };
const INVOICE_PROPERTIES = { customer: CUSTOMER_REF };
const CUSTOMER_PROPERTIES = { name: TEXT };
const invoice: JSONSchema7 = { type: 'object', properties: INVOICE_PROPERTIES };
const customer: JSONSchema7 = { type: 'object', properties: CUSTOMER_PROPERTIES };
const refund: JSONSchema7 = { type: 'object' };
const INFO = { title: 'Prune API', version: '1.0.0' };
const DIALECT = 'https://json-schema.org/draft/2020-12/schema';
const ALL_SCHEMAS = { invoice, customer, refund };
const REACHABLE_SCHEMAS = { invoice, customer };
const ALL_COMPONENTS = { schemas: ALL_SCHEMAS };
const REACHABLE_COMPONENTS = { schemas: REACHABLE_SCHEMAS };
const REFUND_SCHEMAS = { refund };
const REFUND_COMPONENTS = { schemas: REFUND_SCHEMAS };
const PATHS = { '/v1/invoices': {} };

const spec: OpenApiSpec = { openapi: '3.1.0', info: INFO, jsonSchemaDialect: DIALECT, components: ALL_COMPONENTS };
const UNKNOWN_KEYS: Record<string, unknown> = { servers: [] };
const withPaths: OpenApiSpec = { ...spec, paths: PATHS, ...UNKNOWN_KEYS };
const bare: OpenApiSpec = { components: REFUND_COMPONENTS };

describe('FEATURE: spec pruning', (): void => {
  describe('GIVEN a root schema that references one component', (): void => {
    it('WHEN pruning THEN keeps the header, records the root, and drops everything unreachable', (): void => {
      const pruned = pruneSpec(withPaths, 'invoice');
      const expected: OpenApiSpec = {
        openapi: '3.1.0',
        info: INFO,
        jsonSchemaDialect: DIALECT,
        'x-root-schema': 'invoice',
        components: REACHABLE_COMPONENTS
      };

      expect(pruned).toStrictEqual(expected);
      expect(Object.keys(pruned)).not.toContain('paths');
    });
  });

  describe('GIVEN a spec without optional header keys', (): void => {
    it('WHEN pruning THEN leaves those keys absent', (): void => {
      const pruned = pruneSpec(bare, 'refund');

      expect(Object.keys(pruned)).toStrictEqual(['x-root-schema', 'components']);
    });
  });

  describe('GIVEN a schema name the spec lacks', (): void => {
    it('WHEN pruning THEN fails like the sampler with a suggestion', (): void => {
      const failure = (): unknown => pruneSpec(spec, 'invoic');

      expect(failure).toThrow('schema not found: invoic');
      expect(failure).toThrow(expect.objectContaining({ fix: 'did you mean invoice?' }));
    });
  });
});
