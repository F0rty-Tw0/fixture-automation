import type { SpecSchema } from '@fixture-automation/openapi-fixture-diff';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { fixtureEnvelope } from './fixture-envelope.util.ts';
import type { EnvelopeResult } from '../../contract/common/studio-api.type.ts';
import { studioSpec } from '../../test/utils/studio-spec.spec.util.ts';

const CUSTOMER = { id: 'cus_9' };
const INVOICE = { id: 'in_9', amount_due: 5, status: 'open' };
const ROOT_INVOICE = { ...INVOICE, customer: CUSTOMER };
const META = { page: 1 };
const ENVELOPED = { meta: META, data: INVOICE };
const LISTED = { count: 1, items: [INVOICE] };
const TIED = { id: 'in_9', data: CUSTOMER };
const NONE: EnvelopeResult = { candidates: [], detected: undefined };
const INVOICE_REFERENCE: SpecSchema = { $ref: '#/components/schemas/invoice' };
const INVOICE_LIST: SpecSchema = { type: 'array', items: INVOICE_REFERENCE };

describe('FEATURE: fixture envelope detection', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = await studioSpec();
  });

  describe('GIVEN the payload at the fixture root', (): void => {
    it('WHEN detected THEN the nested object is a candidate but none is detected', (): void => {
      const result = fixtureEnvelope(spec, 'invoice', ROOT_INVOICE);

      expect(result).toStrictEqual({ candidates: ['customer'], detected: undefined });
    });
  });

  describe('GIVEN the payload under an envelope key', (): void => {
    it('WHEN detected THEN that key is detected and listed first', (): void => {
      const result = fixtureEnvelope(spec, 'invoice', ENVELOPED);

      expect(result).toStrictEqual({ candidates: ['data', 'meta'], detected: 'data' });
    });
  });

  describe('GIVEN the payload as an array of objects under an envelope key', (): void => {
    it('WHEN detected THEN the first element decides and that key is detected', (): void => {
      const result = fixtureEnvelope(spec, 'invoice', LISTED);

      expect(result).toStrictEqual({ candidates: ['items'], detected: 'items' });
    });
  });

  describe('GIVEN a candidate that fits no better than the root', (): void => {
    it('WHEN detected THEN it is listed but not detected', (): void => {
      const result = fixtureEnvelope(spec, 'invoice', TIED);

      expect(result).toStrictEqual({ candidates: ['data'], detected: undefined });
    });
  });

  describe('GIVEN an array schema', (): void => {
    it('WHEN detected THEN its items name the payload properties', (): void => {
      const specComponents = spec.components;
      const specSchemas = specComponents?.schemas;
      const schemas = { ...specSchemas, invoices: INVOICE_LIST };
      const components = { ...specComponents, schemas };
      const listSpec: OpenApiSpec = { ...spec, components };

      const result = fixtureEnvelope(listSpec, 'invoices', LISTED);

      expect(result.detected).toBe('items');
    });
  });

  describe('GIVEN a fixture that is not an object', (): void => {
    it.each([[[INVOICE]], ['invoice'], [null]])('WHEN %j is detected THEN there are no candidates', (fixture: unknown): void => {
      const result = fixtureEnvelope(spec, 'invoice', fixture);

      expect(result).toStrictEqual(NONE);
    });
  });

  describe('GIVEN a schema name the spec lacks', (): void => {
    it('WHEN detected THEN throws', (): void => {
      const detect = (): EnvelopeResult => fixtureEnvelope(spec, 'ghost', ENVELOPED);

      expect(detect).toThrow('schema "ghost" is unavailable');
    });
  });
});
